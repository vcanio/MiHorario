from datetime import datetime
import json
import pandas as pd

from django.db import transaction
from django.db.models import Q
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required, user_passes_test
from django.urls import reverse
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .forms import ExcelUploadForm, RegistroForm
from .models import Asignatura, Horario, HorarioGuardado

from itertools import combinations
from collections import defaultdict
from django.db.models import Count, Q


# ==================================================
#                  CONFIGURACIÓN
# ==================================================
MAX_HORARIOS_GUARDADOS = 5


# ==================================================
#                 VISTA: Seleccionar Sede
# ==================================================
def seleccionar_sede(request):
    """
    Página de inicio donde el usuario selecciona su sede.
    """
    sedes = (
        Asignatura.objects.values_list('sede', flat=True)
        .distinct()
        .order_by('sede')
    )
    return render(request, 'seleccionar_sede.html', {'sedes': sedes})


# ==================================================
#              VISTA: Cargar Excel (Admin)
# ==================================================
@transaction.atomic
def cargar_excel(request):
    """
    Carga masiva de asignaturas y horarios desde un archivo Excel.
    Solo accesible para superusuarios.
    """
    if not request.user.is_superuser:
        return redirect('inicio')

    mensaje_error = None

    if request.method == 'POST':
        form = ExcelUploadForm(request.POST, request.FILES)

        if form.is_valid():
            excel_file = request.FILES['archivo_excel']

            try:
                # --- Leer Excel ---
                df = pd.read_excel(excel_file, sheet_name='Hoja1')

                if 'Sede' not in df.columns or df.empty:
                    raise ValueError('El archivo no tiene la columna "Sede" o está vacío.')

                sede_a_cargar = df['Sede'].iloc[0]
                if not sede_a_cargar or pd.isna(sede_a_cargar):
                    raise ValueError('No se pudo identificar la sede en la primera fila.')

                # --- Eliminar datos antiguos ---
                print(f"Eliminando datos antiguos de la sede: {sede_a_cargar}")
                Asignatura.objects.filter(sede=sede_a_cargar).delete()

                # --- Crear asignaturas ---
                agrupadas = df.groupby('Sección')
                asignaturas_bulk = []
                asignatura_temp_info = []  # Guarda (objeto_asig, grupo_df)

                for seccion, grupo in agrupadas:
                    fila = grupo.iloc[0]
                    asignatura = Asignatura(
                        sede=fila['Sede'],
                        carrera=fila['Carrera'],
                        plan=str(fila['Plan']),
                        jornada=fila['Jornada'],
                        nivel=fila['Nivel'],
                        sigla=fila['Sigla'],
                        nombre=fila['Asignatura'],
                        seccion=fila['Sección'],
                        docente=fila.get('Docente', ''),
                        virtual_sincronica=not pd.isna(fila.get('ASIGNATURA VIRTUAL SINCRONICA')),
                    )
                    asignaturas_bulk.append(asignatura)
                    asignatura_temp_info.append((asignatura, grupo))

                Asignatura.objects.bulk_create(asignaturas_bulk)

                # --- Asociar horarios ---
                asignaturas_creadas = Asignatura.objects.filter(
                    sede=sede_a_cargar,
                    sigla__in=[a.sigla for a in asignaturas_bulk],
                    seccion__in=[a.seccion for a in asignaturas_bulk],
                )
                asignaturas_dict = {(a.sigla, a.seccion): a for a in asignaturas_creadas}

                horarios_bulk = []
                for asig_temp, grupo in asignatura_temp_info:
                    asignatura = asignaturas_dict.get((asig_temp.sigla, asig_temp.seccion))
                    if not asignatura:
                        continue

                    for _, fila_horario in grupo.iterrows():
                        try:
                            dia_hora = fila_horario['Horario'].split(" ", 1)
                            dia = dia_hora[0]
                            hora_inicio, hora_fin = dia_hora[1].split(" - ")

                            hora_inicio = datetime.strptime(hora_inicio.strip(), "%H:%M:%S").time()
                            hora_fin = datetime.strptime(hora_fin.strip(), "%H:%M:%S").time()

                            horarios_bulk.append(
                                Horario(
                                    asignatura=asignatura,
                                    dia=dia,
                                    hora_inicio=hora_inicio,
                                    hora_fin=hora_fin,
                                )
                            )
                        except Exception as e:
                            print(f"Error procesando horario '{fila_horario.get('Horario', '')}': {e}")

                Horario.objects.bulk_create(horarios_bulk)

                # --- Redirigir a la lista filtrada por sede ---
                return redirect(f"{reverse('lista_asignaturas')}?sede={sede_a_cargar}")

            except Exception as e:
                mensaje_error = f"Error al procesar el archivo: {e}"
                Asignatura.objects.filter(sede=sede_a_cargar).delete()
                print(f"Error: {e}")

    else:
        form = ExcelUploadForm()

    return render(request, 'cargar_excel.html', {'form': form, 'mensaje_error': mensaje_error})


# ==================================================
#              VISTA: Lista de Asignaturas
# ==================================================
def lista_asignaturas(request):
    """
    Lista de asignaturas con filtros por sede, carrera, jornada, nivel y búsqueda.
    Incluye paginación y desplegables dependientes.
    """
    asignaturas_query = Asignatura.objects.all()

    # --- Filtros ---
    sedes = Asignatura.objects.values_list('sede', flat=True).distinct().order_by('sede')
    sede = request.GET.get('sede')
    carrera = request.GET.get('carrera')
    jornada = request.GET.get('jornada')
    nivel = request.GET.get('nivel')
    busqueda = request.GET.get('busqueda')

    if sede:
        asignaturas_query = asignaturas_query.filter(sede=sede)
    if carrera:
        asignaturas_query = asignaturas_query.filter(carrera=carrera)
    if jornada:
        asignaturas_query = asignaturas_query.filter(jornada=jornada)
    if nivel:
        asignaturas_query = asignaturas_query.filter(nivel=nivel)
    if busqueda:
        asignaturas_query = asignaturas_query.filter(
            Q(nombre__icontains=busqueda) | Q(sigla__icontains=busqueda)
        )

    # --- Eliminar duplicados (sigla + sección) ---
    asignaturas_query = asignaturas_query.order_by('sigla', 'seccion')
    vistos = set()
    asignaturas_list = []
    for a in asignaturas_query:
        key = (a.sigla, a.seccion)
        if key not in vistos:
            vistos.add(key)
            asignaturas_list.append(a)

    # --- Paginación ---
    paginator = Paginator(asignaturas_list, 10)
    page = request.GET.get('page', 1)
    try:
        page_obj = paginator.page(page)
    except (PageNotAnInteger, EmptyPage):
        page_obj = paginator.page(1)

    # --- Filtros dinámicos (dependen de sede) ---
    query_filtros = Asignatura.objects.filter(sede=sede) if sede else Asignatura.objects.all()
    carreras = query_filtros.values_list('carrera', flat=True).distinct().order_by('carrera')
    jornadas = query_filtros.values_list('jornada', flat=True).distinct().order_by('jornada')
    niveles = query_filtros.values_list('nivel', flat=True).distinct().order_by('nivel')

    asignaturas_filtro = query_filtros
    if carrera:
        asignaturas_filtro = asignaturas_filtro.filter(carrera=carrera)
    if nivel:
        asignaturas_filtro = asignaturas_filtro.filter(nivel=nivel)

    asignaturas_unicas = (
        asignaturas_filtro.values('nombre', 'sigla').distinct().order_by('nombre')
    )

    context = {
        'asignaturas': page_obj,
        'sedes': sedes,
        'carreras': carreras,
        'jornadas': jornadas,
        'niveles': niveles,
        'asignaturas_unicas': asignaturas_unicas,
    }

    return render(request, 'lista_asignaturas.html', context)


# ==================================================
#                VISTA: Registro Usuario
# ==================================================
def registro(request):
    """
    Registro de nuevos usuarios y login automático.
    """
    if request.method == 'POST':
        form = RegistroForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('inicio')
    else:
        form = RegistroForm()

    return render(request, 'registration/registro.html', {'form': form})


# ==================================================
#               API: Guardar Horario
# ==================================================
@login_required
@require_http_methods(["POST"])
def guardar_horario(request):
    """
    Guarda un horario con las asignaturas seleccionadas.
    Espera: { nombre: "Mi Horario", asignaturas_ids: [1, 2, 3] }
    """
    try:
        data = json.loads(request.body)
        nombre = data.get('nombre', '').strip()
        asignaturas_ids = data.get('asignaturas_ids', [])

        if not nombre:
            return JsonResponse({'error': 'El nombre es requerido'}, status=400)
        
        MAX_NOMBRE_LENGTH = 30 # Define el límite que quieras
        if len(nombre) > MAX_NOMBRE_LENGTH:
                    return JsonResponse({
                        'error': f'El nombre no puede tener más de {MAX_NOMBRE_LENGTH} caracteres'
                    }, status=400)

        if not asignaturas_ids:
            return JsonResponse({'error': 'Debes seleccionar al menos una asignatura'}, status=400)

        # --- Límite de horarios ---
        horarios_count = HorarioGuardado.objects.filter(usuario=request.user).count()
        existe = HorarioGuardado.objects.filter(usuario=request.user, nombre=nombre).exists()
        if horarios_count >= MAX_HORARIOS_GUARDADOS and not existe:
            return JsonResponse({
                'error': f'Límite de {MAX_HORARIOS_GUARDADOS} horarios alcanzado. Elimina uno antiguo para guardar uno nuevo.'
            }, status=400)

        # --- Crear o actualizar horario ---
        horario, created = HorarioGuardado.objects.update_or_create(
            usuario=request.user,
            nombre=nombre,
            defaults={}
        )

        horario.asignaturas.clear()
        asignaturas = Asignatura.objects.filter(id__in=asignaturas_ids)
        horario.asignaturas.add(*asignaturas)

        return JsonResponse({
            'success': True,
            'mensaje': f'Horario "{nombre}" guardado correctamente',
            'id': horario.id,
            'created': created
        })

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Datos inválidos'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ==================================================
#             API: Listar Horarios Guardados
# ==================================================
@login_required
@require_http_methods(["GET"])
def listar_horarios_guardados(request):
    """
    Devuelve todos los horarios guardados del usuario actual.
    """
    horarios = HorarioGuardado.objects.filter(usuario=request.user)

    data = [{
        'id': h.id,
        'nombre': h.nombre,
        'modificado_en': h.modificado_en.isoformat(),
        'asignaturas': [{
            'id': a.id,
            'sigla': a.sigla,
            'nombre': a.nombre,
            'seccion': a.seccion,
            'virtual_sincronica': a.virtual_sincronica,
            'horarios': [{
                'dia': horario.dia,
                'inicio': horario.hora_inicio.strftime('%H:%M'),
                'fin': horario.hora_fin.strftime('%H:%M')
            } for horario in a.horarios.all()]
        } for a in h.asignaturas.all()]
    } for h in horarios]

    return JsonResponse({'horarios': data})


# ==================================================
#           API: Eliminar Horario Guardado
# ==================================================
@login_required
@require_http_methods(["DELETE"])
def eliminar_horario_guardado(request, horario_id):
    """
    Elimina un horario guardado del usuario actual.
    """
    try:
        horario = HorarioGuardado.objects.get(id=horario_id, usuario=request.user)
        nombre = horario.nombre
        horario.delete()
        return JsonResponse({
            'success': True,
            'mensaje': f'Horario "{nombre}" eliminado correctamente'
        })
    except HorarioGuardado.DoesNotExist:
        return JsonResponse({'error': 'Horario no encontrado'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ==================================================
#        VISTA: Generador de Horarios
# ==================================================
@login_required
def generador_horarios(request):
    """
    Interfaz del generador automático de horarios
    """
    sede = request.GET.get('sede')
    
    if not sede:
        return redirect('inicio')
    
    # --- INICIO DE LA MODIFICACIÓN ---
    
    # Query base para los filtros de esta sede
    query_filtros = Asignatura.objects.filter(sede=sede)
    
    # Obtener filtros disponibles
    carreras = query_filtros.values_list('carrera', flat=True).distinct().order_by('carrera')
    
    # ¡AÑADE ESTAS LÍNEAS!
    niveles = query_filtros.values_list('nivel', flat=True).distinct().order_by('nivel')
    jornadas = query_filtros.values_list('jornada', flat=True).distinct().order_by('jornada')

    context = {
        'sede': sede,
        'carreras': carreras,
        'niveles': niveles,   # ¡AÑADE ESTO!
        'jornadas': jornadas, # ¡AÑADE ESTO!
    }
    
    # --- FIN DE LA MODIFICACIÓN ---
    
    return render(request, 'generador_horarios.html', context)


# ==================================================
#     API: Obtener asignaturas para generador
# ==================================================
@login_required
@require_http_methods(["GET"])
def api_asignaturas_generador(request):
    """
    Retorna asignaturas agrupadas por sigla para el generador
    """
    sede = request.GET.get('sede')
    carrera = request.GET.get('carrera')
    nivel = request.GET.get('nivel')
    jornada = request.GET.get('jornada')
    
    if not sede:
        return JsonResponse({'error': 'Sede requerida'}, status=400)
    
    query = Asignatura.objects.filter(sede=sede)
    
    if carrera:
        query = query.filter(carrera=carrera)
    if nivel:
        query = query.filter(nivel=nivel)
    if jornada:
        query = query.filter(jornada=jornada)
    
    # Agrupar por sigla
    asignaturas_dict = defaultdict(list)
    
    for asig in query.select_related().prefetch_related('horarios'):
        asignaturas_dict[asig.sigla].append({
            'id': asig.id,
            'sigla': asig.sigla,
            'nombre': asig.nombre,
            'seccion': asig.seccion,
            'docente': asig.docente,
            'virtual': asig.virtual_sincronica == 'True',
            'horarios': [{
                'dia': h.dia,
                'inicio': h.hora_inicio.strftime('%H:%M'),
                'fin': h.hora_fin.strftime('%H:%M')
            } for h in asig.horarios.all()]
        })
    
    # Convertir a lista
    result = [
        {
            'sigla': sigla,
            'nombre': secciones[0]['nombre'],
            'secciones': secciones,
            'num_secciones': len(secciones)
        }
        for sigla, secciones in asignaturas_dict.items()
    ]
    
    return JsonResponse({'asignaturas': result})


# ==================================================
#          API: Generar Horarios
# ==================================================
@login_required
@require_http_methods(["POST"])
def api_generar_horarios(request):
    """
    Genera combinaciones de horarios óptimas según preferencias
    """
    try:
        data = json.loads(request.body)
        siglas_seleccionadas = data.get('siglas', [])
        preferencias = data.get('preferencias', {})
        
        # --- ▼▼▼ CORRECCIÓN JORNADA ▼▼▼ ---
        
        # 1. Recibir la sede desde el JSON
        sede = data.get('sede')
        if not sede:
            return JsonResponse({'error': 'La sede es requerida en la solicitud'}, status=400)
            
        # 2. Recibir la jornada desde el JSON
        jornada = data.get('jornada') # Puede ser "" (Todas), "Diurno", "Vespertino"
            
        # --- ▲▲▲ FIN CORRECCIÓN JORNADA ▲▲▲ ---

        if not siglas_seleccionadas:
            return JsonResponse({'error': 'Debes seleccionar al menos una asignatura'}, status=400)
        
        # --- ▼▼▼ CORRECCIÓN JORNADA ▼▼▼ ---
        
        # 3. Construir la consulta base
        asignaturas_query = Asignatura.objects.filter(
            sigla__in=siglas_seleccionadas,
            sede=sede
        )

        # 4. Añadir el filtro de jornada SOLO SI se especificó una
        if jornada:
            asignaturas_query = asignaturas_query.filter(jornada=jornada)

        # 5. Ejecutar la consulta final
        asignaturas = asignaturas_query.prefetch_related('horarios')
        
        # --- ▲▲▲ FIN CORRECCIÓN JORNADA ▲▲▲ ---
        
        # Agrupar por sigla
        por_sigla = defaultdict(list)
        for asig in asignaturas:
            por_sigla[asig.sigla].append(asig)
        
        # Verificar que todas las siglas tengan secciones (en esta sede y jornada)
        for sigla in siglas_seleccionadas:
            if sigla not in por_sigla:
                error_msg = f'No se encontraron secciones para {sigla} en la sede seleccionada'
                if jornada:
                    error_msg += f' y jornada {jornada}'
                
                return JsonResponse({'error': error_msg}, status=400)
        
        # Generar combinaciones
        horarios_generados = generar_combinaciones_horarios(
            por_sigla, 
            preferencias,
            max_resultados=10
        )
        
        if not horarios_generados:
            return JsonResponse({
                'error': 'No se encontraron combinaciones válidas sin solapamientos'
            }, status=404)
        
        # Serializar resultados
        resultados = []
        for horario in horarios_generados:
            asignaturas_data = []
            for asig in horario['asignaturas']:
                asignaturas_data.append({
                    'id': asig.id,
                    'sigla': asig.sigla,
                    'nombre': asig.nombre,
                    'seccion': asig.seccion,
                    'docente': asig.docente,
                    
                    # --- ▼▼▼ CORRECCIÓN BUG VIRTUAL ▼▼▼ ---
                    'virtual': asig.virtual_sincronica == 'True', 
                    # --- ▲▲▲ FIN CORRECCIÓN BUG VIRTUAL ▲▲▲ ---
                    
                    'horarios': [{
                        'dia': h.dia,
                        'inicio': h.hora_inicio.strftime('%H:%M'),
                        'fin': h.hora_fin.strftime('%H:%M')
                    } for h in asig.horarios.all()]
                })
            
            resultados.append({
                'asignaturas': asignaturas_data,
                'puntuacion': horario['puntuacion'],
                'metricas': horario['metricas']
            })
        
        return JsonResponse({
            'success': True,
            'horarios': resultados
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Datos inválidos'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ==================================================
#     FUNCIÓN: Generar Combinaciones de Horarios
# ==================================================
def generar_combinaciones_horarios(por_sigla, preferencias, max_resultados=10):
    """
    Genera todas las combinaciones posibles sin solapamientos
    y las ordena según preferencias
    """
    from itertools import product
    from datetime import datetime, time
    
    # Obtener todas las secciones de cada sigla
    secciones_por_sigla = [por_sigla[sigla] for sigla in sorted(por_sigla.keys())]
    
    # Generar todas las combinaciones posibles
    combinaciones_posibles = product(*secciones_por_sigla)
    
    horarios_validos = []
    
    for combinacion in combinaciones_posibles:
        
        # --- ▼▼▼ INICIO DE LA CORRECCIÓN ▼▼▼ ---
        # NUEVA VALIDACIÓN: Asegurar que todas las asignaturas
        # de la combinación tengan la misma jornada.
        
        if not combinacion: # Omitir si la combinación está vacía
            continue
            
        # Obtenemos todas las jornadas de la combinación
        jornadas_en_combinacion = set(asig.jornada for asig in combinacion)
        
        # Si hay más de una jornada distinta, es una mezcla inválida
        if len(jornadas_en_combinacion) > 1:
            continue # Descartar esta combinación y pasar a la siguiente
        
        # --- ▲▲▲ FIN DE LA CORRECCIÓN ▲▲▲ ---

        # Verificar que no haya solapamientos de TIEMPO
        if tiene_solapamiento_combinacion(combinacion):
            continue
        
        # Calcular métricas y puntuación
        metricas = calcular_metricas_horario(combinacion)
        puntuacion = calcular_puntuacion(metricas, preferencias)
        
        horarios_validos.append({
            'asignaturas': list(combinacion),
            'puntuacion': puntuacion,
            'metricas': metricas
        })
        
        # Limitar resultados para evitar sobrecarga
        if len(horarios_validos) >= max_resultados * 10:
            break
    
    # Ordenar por puntuación y retornar los mejores
    horarios_validos.sort(key=lambda x: x['puntuacion'], reverse=True)
    return horarios_validos[:max_resultados]


# ==================================================
#   FUNCIÓN: Verificar Solapamiento en Combinación
# ==================================================
def tiene_solapamiento_combinacion(asignaturas):
    """
    Verifica si hay solapamientos en una combinación de asignaturas
    """
    from datetime import datetime
    
    horarios_ocupados = defaultdict(list)  # {dia: [(inicio, fin, sigla)]}
    
    for asig in asignaturas:
        for horario in asig.horarios.all():
            inicio = datetime.combine(datetime.today(), horario.hora_inicio)
            fin = datetime.combine(datetime.today(), horario.hora_fin)
            
            # Verificar solapamiento con horarios existentes en ese día
            for h_inicio, h_fin, sigla in horarios_ocupados[horario.dia]:
                if inicio < h_fin and fin > h_inicio:
                    return True
            
            horarios_ocupados[horario.dia].append((inicio, fin, asig.sigla))
    
    return False


# ==================================================
#       FUNCIÓN: Calcular Métricas de Horario
# ==================================================
def calcular_metricas_horario(asignaturas):
    """
    Calcula métricas para evaluar la calidad de un horario
    """
    from datetime import datetime, timedelta
    
    dias_usados = set()
    total_huecos = 0
    bloques_por_dia = defaultdict(list)
    clases_virtuales = 0
    
    # Organizar horarios por día
    for asig in asignaturas:
        # --- ▼▼▼ CORRECCIÓN DE BUG VIRTUAL EN MÉTRICAS ▼▼▼ ---
        # Aseguramos que la comprobación sea contra el string 'True'
        if asig.virtual_sincronica == 'True':
            clases_virtuales += 1
        # --- ▲▲▲ FIN DE LA CORRECCIÓN ▲▲▲ ---
            
        for horario in asig.horarios.all():
            dias_usados.add(horario.dia)
            inicio = datetime.combine(datetime.today(), horario.hora_inicio)
            fin = datetime.combine(datetime.today(), horario.hora_fin)
            bloques_por_dia[horario.dia].append((inicio, fin))
    
    # Calcular huecos (tiempo libre entre clases)
    for dia, bloques in bloques_por_dia.items():
        bloques.sort()
        for i in range(len(bloques) - 1):
            hueco = (bloques[i+1][0] - bloques[i][1]).total_seconds() / 60
            if hueco > 0:
                total_huecos += hueco
    
    # --- ▼▼▼ REWORK DE MÉTRICAS (INICIO/FIN) ▼▼▼ ---
    horas_inicio = []
    horas_fin = [] # Nueva métrica
    
    for bloques in bloques_por_dia.values():
        if bloques:
            # Hora de inicio de ese día (en decimal, ej: 8.5 = 8:30)
            bloque_mas_temprano = min(bloques)
            horas_inicio.append(bloque_mas_temprano[0].hour + bloque_mas_temprano[0].minute/60)
            
            # Hora de fin de ese día (en decimal)
            bloque_mas_tarde = max(bloques)
            horas_fin.append(bloque_mas_tarde[1].hour + bloque_mas_tarde[1].minute/60)
    
    hora_inicio_promedio = sum(horas_inicio) / len(horas_inicio) if horas_inicio else 0
    hora_fin_promedio = sum(horas_fin) / len(horas_fin) if horas_fin else 0
    # --- ▲▲▲ FIN REWORK DE MÉTRICAS ▲▲▲ ---
    
    return {
        'dias_usados': len(dias_usados),
        'total_huecos_minutos': total_huecos,
        'clases_virtuales': clases_virtuales,
        'hora_inicio_promedio': hora_inicio_promedio,
        'hora_fin_promedio': hora_fin_promedio, # Nueva métrica
        'bloques_por_dia': {dia: len(bloques) for dia, bloques in bloques_por_dia.items()}
    }


# ==================================================
#      FUNCIÓN: Calcular Puntuación de Horario
# ==================================================
def calcular_puntuacion(metricas, preferencias):
    """
    Calcula una puntuación basada en métricas y preferencias del usuario
    """
    puntuacion = 100.0
    
    # --- ▼▼▼ REWORK PUNTUACIÓN (PREFERENCIAS ADAPTABLES) ▼▼▼ ---

    # Preferencia: Menos huecos (Peso: 40 puntos)
    if preferencias.get('minimizar_huecos', True):
        puntuacion -= (metricas['total_huecos_minutos'] / 60) * 10
    
    # Preferencia: Clases virtuales (Peso: 10 puntos)
    preferencia_virtual = preferencias.get('preferir_virtuales', 'neutro')
    if preferencia_virtual == 'si':
        puntuacion += metricas['clases_virtuales'] * 5
    elif preferencia_virtual == 'no':
        puntuacion -= metricas['clases_virtuales'] * 3
    
    
    # Preferencia de Horario (Peso: 50 puntos)
    preferencia_horario = preferencias.get('preferencia_horario', 'neutro')
    
    # --- LÓGICA DE JORNADA ADAPTABLE ---
    # Leemos la jornada que envió el JS
    jornada_seleccionada = preferencias.get('jornada')
    
    # Definimos horas "ideales" dinámicamente
    hora_ideal_inicio = 12.0 # Neutral (mediodía)
    hora_ideal_fin = 16.0    # Neutral
    
    if jornada_seleccionada == 'Diurno':
        hora_ideal_inicio = 8.0  # 8 AM
        hora_ideal_fin = 14.0    # 2 PM
    elif jornada_seleccionada == 'Vespertino':
        hora_ideal_inicio = 18.0 # 6 PM
        hora_ideal_fin = 22.0    # 10 PM
        
    # --- FIN LÓGICA JORNADA ---

    if preferencia_horario == 'entrar_temprano':
        # Penaliza basado en la hora ideal de *inicio* de esa jornada
        # Ej: Si es vespertino, penaliza (19.0 - 18.0) * 8
        # Ej: Si es diurno, penaliza (9.0 - 8.0) * 8
        puntuacion -= (metricas['hora_inicio_promedio'] - hora_ideal_inicio) * 8
        
    elif preferencia_horario == 'salir_temprano':
        # Penaliza basado en la hora ideal de *fin* de esa jornada
        # Ej: Si es vespertino, penaliza (23.0 - 22.0) * 8
        # Ej: Si es diurno, penaliza (15.0 - 14.0) * 8
        puntuacion -= (metricas['hora_fin_promedio'] - hora_ideal_fin) * 8

    # --- ▲▲▲ FIN REWORK PUNTUACIÓN ▲▲▲ ---
    
    return max(0, puntuacion)