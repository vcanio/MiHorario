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
MAX_TIEMPO_GENERACION = 15  # segundos
MAX_COMBINACIONES_EVALUAR = 10000


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
                asignatura_temp_info = []

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

    # --- Eliminar duplicados ---
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

    # --- Filtros dinámicos ---
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
    """
    try:
        data = json.loads(request.body)
        nombre = data.get('nombre', '').strip()
        asignaturas_ids = data.get('asignaturas_ids', [])

        if not nombre:
            return JsonResponse({'error': 'El nombre es requerido'}, status=400)
        
        MAX_NOMBRE_LENGTH = 30
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

        # --- Crear o actualizar ---
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
    
    query_filtros = Asignatura.objects.filter(sede=sede)
    
    carreras = query_filtros.values_list('carrera', flat=True).distinct().order_by('carrera')
    niveles = query_filtros.values_list('nivel', flat=True).distinct().order_by('nivel')
    jornadas = query_filtros.values_list('jornada', flat=True).distinct().order_by('jornada')

    context = {
        'sede': sede,
        'carreras': carreras,
        'niveles': niveles,
        'jornadas': jornadas,
    }
    
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
#          API: Generar Horarios (OPTIMIZADO)
# ==================================================
@login_required
@require_http_methods(["POST"])
def api_generar_horarios(request):
    """
    Genera combinaciones de horarios óptimas usando backtracking
    """
    try:
        data = json.loads(request.body)
        siglas_seleccionadas = data.get('siglas', [])
        preferencias = data.get('preferencias', {})
        sede = data.get('sede')
        jornada = data.get('jornada')

        if not sede:
            return JsonResponse({'error': 'La sede es requerida'}, status=400)
            
        if not siglas_seleccionadas:
            return JsonResponse({'error': 'Debes seleccionar al menos una asignatura'}, status=400)
        
        # Consulta base
        asignaturas_query = Asignatura.objects.filter(
            sigla__in=siglas_seleccionadas,
            sede=sede
        )

        if jornada:
            asignaturas_query = asignaturas_query.filter(jornada=jornada)

        asignaturas = asignaturas_query.prefetch_related('horarios')
        
        # Agrupar por sigla
        por_sigla = defaultdict(list)
        for asig in asignaturas:
            por_sigla[asig.sigla].append(asig)
        
        # Verificar que existan secciones
        for sigla in siglas_seleccionadas:
            if sigla not in por_sigla:
                error_msg = f'No se encontraron secciones para {sigla} en la sede seleccionada'
                if jornada:
                    error_msg += f' y jornada {jornada}'
                return JsonResponse({'error': error_msg}, status=400)
        
        # Generar combinaciones (OPTIMIZADO)
        horarios_generados = generar_combinaciones_optimizado(
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
                    'virtual': asig.virtual_sincronica == 'True',
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
#  FUNCIÓN: Generar Combinaciones (BACKTRACKING)
# ==================================================
def generar_combinaciones_optimizado(por_sigla, preferencias, max_resultados=10):
    """
    Genera combinaciones usando backtracking con poda temprana
    MUCHO más eficiente que itertools.product
    """
    import time
    
    siglas_ordenadas = sorted(por_sigla.keys())
    secciones_por_sigla = [por_sigla[sigla] for sigla in siglas_ordenadas]
    
    horarios_validos = []
    combinaciones_evaluadas = 0
    tiempo_inicio = time.time()
    
    def backtrack(indice, combinacion_actual, horarios_ocupados):
        nonlocal combinaciones_evaluadas
        
        # Timeout de seguridad
        if time.time() - tiempo_inicio > MAX_TIEMPO_GENERACION:
            return True
        
        # Límite de combinaciones
        if combinaciones_evaluadas >= MAX_COMBINACIONES_EVALUAR:
            return True
        
        # Caso base: combinación completa
        if indice == len(secciones_por_sigla):
            combinaciones_evaluadas += 1
            
            # Calcular métricas y puntuación
            metricas = calcular_metricas_horario(combinacion_actual)
            puntuacion = calcular_puntuacion_normalizada(metricas, preferencias)
            
            horarios_validos.append({
                'asignaturas': list(combinacion_actual),
                'puntuacion': puntuacion,
                'metricas': metricas
            })
            
            # Poda: si tenemos suficientes buenos resultados
            if len(horarios_validos) >= max_resultados * 5:
                return True
            
            return False
        
        # Probar cada sección de la asignatura actual
        for seccion in secciones_por_sigla[indice]:
            # PODA 1: Verificar jornada
            if combinacion_actual:
                jornada_actual = combinacion_actual[0].jornada
                if seccion.jornada != jornada_actual:
                    continue
            
            # PODA 2: Verificar solapamientos (optimizado)
            if tiene_solapamiento_rapido(seccion, horarios_ocupados):
                continue
            
            # Añadir sección
            nuevos_horarios = actualizar_horarios_ocupados(horarios_ocupados, seccion)
            combinacion_actual.append(seccion)
            
            # Recursión
            if backtrack(indice + 1, combinacion_actual, nuevos_horarios):
                combinacion_actual.pop()
                return True
            
            # Backtrack
            combinacion_actual.pop()
        
        return False
    
    # Iniciar backtracking
    backtrack(0, [], defaultdict(list))
    
    # Ordenar por puntuación y retornar mejores
    horarios_validos.sort(key=lambda x: x['puntuacion'], reverse=True)
    return horarios_validos[:max_resultados]


# ==================================================
#   FUNCIONES AUXILIARES OPTIMIZADAS
# ==================================================
def tiene_solapamiento_rapido(asignatura, horarios_ocupados):
    """
    Verificación rápida de solapamientos
    """
    for horario in asignatura.horarios.all():
        dia = horario.dia
        inicio = datetime.combine(datetime.today(), horario.hora_inicio)
        fin = datetime.combine(datetime.today(), horario.hora_fin)
        
        for h_inicio, h_fin in horarios_ocupados[dia]:
            if inicio < h_fin and fin > h_inicio:
                return True
    
    return False


def actualizar_horarios_ocupados(horarios_ocupados, asignatura):
    """
    Copia actualizada de horarios (inmutable para backtracking)
    """
    nuevos = defaultdict(list)
    
    for dia, horarios in horarios_ocupados.items():
        nuevos[dia] = horarios.copy()
    
    for horario in asignatura.horarios.all():
        inicio = datetime.combine(datetime.today(), horario.hora_inicio)
        fin = datetime.combine(datetime.today(), horario.hora_fin)
        nuevos[horario.dia].append((inicio, fin))
    
    return nuevos


# ==================================================
#       FUNCIÓN: Calcular Métricas (MEJORADO)
# ==================================================
def calcular_metricas_horario(asignaturas):
    """
    Calcula métricas completas del horario
    """
    dias_usados = set()
    total_huecos = 0
    bloques_por_dia = defaultdict(list)
    clases_virtuales = 0
    
    for asig in asignaturas:
        if asig.virtual_sincronica == 'True':
            clases_virtuales += 1
            
        for horario in asig.horarios.all():
            dias_usados.add(horario.dia)
            inicio = datetime.combine(datetime.today(), horario.hora_inicio)
            fin = datetime.combine(datetime.today(), horario.hora_fin)
            bloques_por_dia[horario.dia].append((inicio, fin))
    
    # Calcular huecos
    for dia, bloques in bloques_por_dia.items():
        bloques.sort()
        for i in range(len(bloques) - 1):
            hueco = (bloques[i+1][0] - bloques[i][1]).total_seconds() / 60
            if hueco > 0:
                total_huecos += hueco
    
    # Horas de inicio y fin
    horas_inicio = []
    horas_fin = []
    
    for bloques in bloques_por_dia.values():
        if bloques:
            mas_temprano = min(bloques, key=lambda x: x[0])
            mas_tarde = max(bloques, key=lambda x: x[1])
            
            horas_inicio.append(mas_temprano[0].hour + mas_temprano[0].minute/60)
            horas_fin.append(mas_tarde[1].hour + mas_tarde[1].minute/60)
    
    # Balance de carga
    clases_por_dia = [len(bloques) for bloques in bloques_por_dia.values()]
    if clases_por_dia:
        promedio_clases = sum(clases_por_dia) / len(clases_por_dia)
        varianza = sum((x - promedio_clases) ** 2 for x in clases_por_dia) / len(clases_por_dia)
        balance = max(0, 1 - (varianza / 16))
    else:
        balance = 1.0
    
    return {
        'dias_usados': len(dias_usados),
        'total_huecos_minutos': total_huecos,
        'clases_virtuales': clases_virtuales,
        'hora_inicio_promedio': sum(horas_inicio) / len(horas_inicio) if horas_inicio else 0,
        'hora_fin_promedio': sum(horas_fin) / len(horas_fin) if horas_fin else 0,
        'bloques_por_dia': {dia: len(bloques) for dia, bloques in bloques_por_dia.items()},
        'balance_carga': balance
    }


# ==================================================
#   FUNCIÓN: Puntuación Normalizada (0-100)
# ==================================================
def calcular_puntuacion_normalizada(metricas, preferencias):
    """
    Sistema de puntuación normalizado en escala 0-100
    """
    puntuacion = 0.0
    
    # --- COMPONENTE 1: Huecos (40%) ---
    # 0 huecos = 40 pts, 180+ min = 0 pts
    huecos_pts = max(0, 40 - (metricas['total_huecos_minutos'] / 180) * 40)
    
    if preferencias.get('minimizar_huecos', True):
        puntuacion += huecos_pts
    else:
        puntuacion += 20  # Neutro
    
    # --- COMPONENTE 2: Clases Virtuales (20%) ---
    total_asignaturas = max(1, len(metricas.get('bloques_por_dia', {})))
    ratio_virtual = metricas['clases_virtuales'] / total_asignaturas
    
    pref_virtual = preferencias.get('preferir_virtuales', 'neutro')
    
    if pref_virtual == 'si':
        puntuacion += ratio_virtual * 20
    elif pref_virtual == 'no':
        puntuacion += (1 - ratio_virtual) * 20
    else:
        puntuacion += 10
    
    # --- COMPONENTE 3: Horario (40%) ---
    jornada = preferencias.get('jornada', '')
    
    # Definir rangos ideales según jornada
    if jornada == 'Diurno':
        inicio_ideal, fin_ideal = 8.0, 14.0
    elif jornada == 'Vespertino':
        inicio_ideal, fin_ideal = 18.0, 22.0
    else:
        inicio_ideal, fin_ideal = 12.0, 18.0
    
    inicio_real = metricas['hora_inicio_promedio']
    fin_real = metricas['hora_fin_promedio']
    
    pref_horario = preferencias.get('preferencia_horario', 'neutro')
    
    if pref_horario == 'entrar_temprano':
        desviacion = abs(inicio_real - inicio_ideal)
        puntuacion += max(0, 40 - (desviacion / 4) * 40)
        
    elif pref_horario == 'salir_temprano':
        desviacion = abs(fin_real - fin_ideal)
        puntuacion += max(0, 40 - (desviacion / 4) * 40)
        
    else:  # neutro
        desviacion_inicio = abs(inicio_real - inicio_ideal)
        desviacion_fin = abs(fin_real - fin_ideal)
        desviacion_promedio = (desviacion_inicio + desviacion_fin) / 2
        puntuacion += max(0, 40 - (desviacion_promedio / 4) * 40)
    
    # Bonus por balance de carga (hasta 5 pts extra)
    puntuacion += metricas.get('balance_carga', 0) * 5
    
    return round(min(100, puntuacion), 2)