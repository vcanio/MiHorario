from django.db.models import Q
from django.core.paginator import Paginator
from django.shortcuts import render, redirect
from .forms import ExcelUploadForm
from .models import Asignatura, Horario
import pandas as pd
from datetime import datetime
from django.db import transaction
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger

@transaction.atomic
def cargar_excel(request):
    if request.method == 'POST':
        form = ExcelUploadForm(request.POST, request.FILES)
        if form.is_valid():
            excel_file = request.FILES['archivo_excel']
            df = pd.read_excel(excel_file, sheet_name='Hoja1')

            # 🧹 Limpiar datos antiguos
            Horario.objects.all().delete()
            Asignatura.objects.all().delete()

            # Agrupar por sección
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
                    virtual_sincronica=not pd.isna(fila.get('ASIGNATURA VIRTUAL SINCRONICA'))
                )
                asignaturas_bulk.append(asignatura)
                asignatura_temp_info.append((asignatura, grupo))

            Asignatura.objects.bulk_create(asignaturas_bulk)

            # Refrescar IDs
            asignaturas_creadas = Asignatura.objects.filter(
                sigla__in=[a.sigla for a in asignaturas_bulk],
                seccion__in=[a.seccion for a in asignaturas_bulk]
            )
            asignaturas_dict = {
                (a.sigla, a.seccion): a for a in asignaturas_creadas
            }

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

                        horarios_bulk.append(Horario(
                            asignatura=asignatura,
                            dia=dia,
                            hora_inicio=hora_inicio,
                            hora_fin=hora_fin
                        ))
                    except Exception as e:
                        print(f"Error procesando horario: {fila_horario.get('Horario', '')} → {e}")

            Horario.objects.bulk_create(horarios_bulk)

            return redirect('lista_asignaturas')
    else:
        form = ExcelUploadForm()

    return render(request, 'cargar_excel.html', {'form': form})

def lista_asignaturas(request):
    asignaturas = Asignatura.objects.all()

    carrera = request.GET.get('carrera')
    jornada = request.GET.get('jornada')
    nivel = request.GET.get('nivel')
    busqueda = request.GET.get('busqueda')

    if carrera:
        asignaturas = asignaturas.filter(carrera=carrera)
    if jornada:
        asignaturas = asignaturas.filter(jornada=jornada)
    if nivel:
        asignaturas = asignaturas.filter(nivel=nivel)
    if busqueda:
        asignaturas = asignaturas.filter(
            Q(nombre__icontains=busqueda) | Q(sigla__icontains=busqueda)
        )

    asignaturas = asignaturas.order_by('sigla', 'seccion')

    # Para mostrar en tabla (sin duplicados de sigla+seccion)
    vistos = set()
    asignaturas_list = []
    for a in asignaturas:
        key = (a.sigla, a.seccion)
        if key not in vistos:
            vistos.add(key)
            asignaturas_list.append(a)

    page = request.GET.get('page', 1)
    paginator = Paginator(asignaturas_list, 20)
    try:
        page_obj = paginator.page(page)
    except (PageNotAnInteger, EmptyPage):
        page_obj = paginator.page(1)

    # Opciones únicas para filtros carrera, jornada, nivel
    carreras = Asignatura.objects.values_list('carrera', flat=True).distinct()
    jornadas = Asignatura.objects.values_list('jornada', flat=True).distinct()
    niveles = Asignatura.objects.values_list('nivel', flat=True).distinct()

    # Opciones únicas de asignaturas para el filtro desplegable,
    # tomando en cuenta los filtros carrera y nivel, porque quieres que se filtre según esos.
    asignaturas_filtro = Asignatura.objects.all()
    if carrera:
        asignaturas_filtro = asignaturas_filtro.filter(carrera=carrera)
    if nivel:
        asignaturas_filtro = asignaturas_filtro.filter(nivel=nivel)

    asignaturas_unicas = asignaturas_filtro.values('nombre', 'sigla').distinct().order_by('nombre')

    return render(request, 'lista_asignaturas.html', {
        'asignaturas': page_obj,
        'carreras': carreras,
        'jornadas': jornadas,
        'niveles': niveles,
        'asignaturas_unicas': asignaturas_unicas,  # <-- Aquí
    })

