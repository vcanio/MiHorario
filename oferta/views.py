from datetime import datetime
import pandas as pd
from django.db import transaction
from django.db.models import Q
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.contrib.auth.decorators import user_passes_test
from django.urls import reverse

from .forms import ExcelUploadForm, RegistroForm
from .models import Asignatura, Horario, HorarioGuardado


# --------------------------------------------------
# VISTA: Seleccionar Sede
# --------------------------------------------------
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


# --------------------------------------------------
# VISTA: Cargar Excel (solo superusuario)
# --------------------------------------------------
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
                df = pd.read_excel(excel_file, sheet_name='Hoja1')

                # 1. Validar existencia de columna Sede
                if 'Sede' not in df.columns or df.empty:
                    raise ValueError('El archivo no tiene la columna "Sede" o está vacío.')

                sede_a_cargar = df['Sede'].iloc[0]
                if not sede_a_cargar or pd.isna(sede_a_cargar):
                    raise ValueError('No se pudo identificar la sede en la primera fila.')

                # 2. Eliminar datos antiguos de esa sede
                print(f"Eliminando datos antiguos de la sede: {sede_a_cargar}")
                Asignatura.objects.filter(sede=sede_a_cargar).delete()

                # 3. Agrupar por sección
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

                # 4. Insertar asignaturas
                Asignatura.objects.bulk_create(asignaturas_bulk)

                # 5. Obtener asignaturas reales con IDs
                asignaturas_creadas = Asignatura.objects.filter(
                    sede=sede_a_cargar,
                    sigla__in=[a.sigla for a in asignaturas_bulk],
                    seccion__in=[a.seccion for a in asignaturas_bulk],
                )
                asignaturas_dict = {(a.sigla, a.seccion): a for a in asignaturas_creadas}

                # 6. Procesar horarios
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

                # 7. Insertar horarios
                Horario.objects.bulk_create(horarios_bulk)

                # 8. Redirigir a la lista filtrada por sede
                return redirect(f"{reverse('lista_asignaturas')}?sede={sede_a_cargar}")

            except Exception as e:
                mensaje_error = f"Error al procesar el archivo: {e}"
                Asignatura.objects.filter(sede=sede_a_cargar).delete()
                print(f"Error: {e}")

    else:
        form = ExcelUploadForm()

    return render(request, 'cargar_excel.html', {'form': form, 'mensaje_error': mensaje_error})


# --------------------------------------------------
# VISTA: Lista de Asignaturas
# --------------------------------------------------
def lista_asignaturas(request):
    """
    Lista de asignaturas con filtros por sede, carrera, jornada, nivel y búsqueda.
    Incluye paginación y desplegables dependientes.
    """
    asignaturas_query = Asignatura.objects.all()

    # 1. Filtro por sede
    sedes = Asignatura.objects.values_list('sede', flat=True).distinct().order_by('sede')
    sede = request.GET.get('sede')
    if sede:
        asignaturas_query = asignaturas_query.filter(sede=sede)

    # 2. Filtros adicionales
    carrera = request.GET.get('carrera')
    jornada = request.GET.get('jornada')
    nivel = request.GET.get('nivel')
    busqueda = request.GET.get('busqueda')

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

    # 3. Quitar duplicados (sigla + sección)
    asignaturas_query = asignaturas_query.order_by('sigla', 'seccion')
    vistos = set()
    asignaturas_list = []
    for a in asignaturas_query:
        key = (a.sigla, a.seccion)
        if key not in vistos:
            vistos.add(key)
            asignaturas_list.append(a)

    # 4. Paginación
    paginator = Paginator(asignaturas_list, 10)
    page = request.GET.get('page', 1)
    try:
        page_obj = paginator.page(page)
    except (PageNotAnInteger, EmptyPage):
        page_obj = paginator.page(1)

    # 5. Filtros desplegables (dependen de sede)
    query_filtros = Asignatura.objects.all()
    if sede:
        query_filtros = query_filtros.filter(sede=sede)

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

    return render(
        request,
        'lista_asignaturas.html',
        {
            'asignaturas': page_obj,
            'sedes': sedes,
            'carreras': carreras,
            'jornadas': jornadas,
            'niveles': niveles,
            'asignaturas_unicas': asignaturas_unicas,
        },
    )


# --------------------------------------------------
# VISTA: Registro de Usuario
# --------------------------------------------------
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

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
import json

# --------------------------------------------------
# API: Guardar Horario
# --------------------------------------------------
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

        if not asignaturas_ids:
            return JsonResponse({'error': 'Debes seleccionar al menos una asignatura'}, status=400)

        # Crear o actualizar el horario
        horario, created = HorarioGuardado.objects.update_or_create(
            usuario=request.user,
            nombre=nombre,
            defaults={}
        )

        # Limpiar y añadir asignaturas
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


# --------------------------------------------------
# API: Listar Horarios Guardados
# --------------------------------------------------
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


# --------------------------------------------------
# API: Eliminar Horario Guardado
# --------------------------------------------------
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