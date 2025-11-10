# oferta/views/asignaturas.py
"""
Vistas relacionadas con la gestión de asignaturas
"""

from datetime import datetime
import pandas as pd

from django.db import transaction
from django.db.models import Q
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.shortcuts import render, redirect
from django.urls import reverse

from ..forms import ExcelUploadForm
from ..models import Asignatura, Horario


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
# --- Paginación ---
    try:
        # 1. Leer el parámetro 'per_page' de la URL. Default a 5 (móvil/tableta).
        items_por_pagina = int(request.GET.get('per_page', 5))
    except ValueError:
        items_por_pagina = 5

    # 2. Asegurarse que el valor sea 5 u 8
    if items_por_pagina not in [5, 8]:
        items_por_pagina = 5
            
    paginator = Paginator(asignaturas_list, items_por_pagina)
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