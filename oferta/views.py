from django.db import transaction
from django.db.models import Q
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import user_passes_test

import pandas as pd
from datetime import datetime

from .forms import ExcelUploadForm
from .models import Asignatura, Horario

from django.urls import reverse 

def seleccionar_sede(request):
    """
    Vista para la página de inicio, donde el usuario selecciona su sede.
    """
    sedes = Asignatura.objects.values_list('sede', flat=True).distinct().order_by('sede')
    return render(request, 'seleccionar_sede.html', {'sedes': sedes})

@transaction.atomic
def cargar_excel(request):
    if not request.user.is_superuser:
        return redirect('inicio')
    mensaje_error = None
    if request.method == 'POST':
        form = ExcelUploadForm(request.POST, request.FILES)

        if form.is_valid():
            excel_file = request.FILES['archivo_excel']
            
            try:
                df = pd.read_excel(excel_file, sheet_name='Hoja1')

                # 1. Identificar la sede del archivo
                if 'Sede' not in df.columns or df.empty:
                    mensaje_error = 'El archivo Excel no tiene la columna "Sede" o está vacío.'
                    raise ValueError(mensaje_error)
                
                sede_a_cargar = df['Sede'].iloc[0]

                if not sede_a_cargar or pd.isna(sede_a_cargar):
                    mensaje_error = 'No se pudo identificar la Sede en la primera fila del archivo.'
                    raise ValueError(mensaje_error)

                # 2. Limpiar datos antiguos SÓLO para esa sede
                print(f"Limpiando datos antiguos para la sede: {sede_a_cargar}...")
                Asignatura.objects.filter(sede=sede_a_cargar).delete()
                print("Datos antiguos de la sede eliminados.")
                

                # Agrupar datos por Sección
                agrupadas = df.groupby('Sección')
                asignaturas_bulk = []
                asignatura_temp_info = []  # Guarda (asignatura, grupo) para luego agregar horarios

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

                # Insertar todas las asignaturas
                Asignatura.objects.bulk_create(asignaturas_bulk)

                # Obtener IDs reales desde la base de datos
                asignaturas_creadas = Asignatura.objects.filter(
                    sede=sede_a_cargar, # Filtramos por sede para optimizar
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

                            # Parsear horas
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

                # Insertar todos los horarios
                Horario.objects.bulk_create(horarios_bulk)

                # Redirigimos a la lista, pero ahora filtrada por la sede que se acaba de cargar
                return redirect(f"{reverse('lista_asignaturas')}?sede={sede_a_cargar}")

            except Exception as e:
                # Si algo falla (ej. lectura de Excel, columna 'Sede' no encontrada)
                mensaje_error = f"Error al procesar el archivo: {e}"
                # Hacemos rollback manual de la transacción si es necesario
                Asignatura.objects.filter(sede=sede_a_cargar).delete()
                print(f"Error: {e}")

    else:
        form = ExcelUploadForm()

    return render(request, 'cargar_excel.html', {'form': form, 'mensaje_error': mensaje_error})


def lista_asignaturas(request):
    """
    Vista para listar asignaturas, con filtros por sede, carrera, jornada, nivel y búsqueda.
    """
    # Query base
    asignaturas_query = Asignatura.objects.all()

    
    # 1. Filtro principal: Sede
    sedes = Asignatura.objects.values_list('sede', flat=True).distinct().order_by('sede')
    sede = request.GET.get('sede')
    if sede:
        asignaturas_query = asignaturas_query.filter(sede=sede)
    

    # 2. Filtros dependientes
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
            Q(nombre__icontains=busqueda) |
            Q(sigla__icontains=busqueda)
        )

    # Ordenar y quitar duplicados por sigla + sección
    asignaturas_query = asignaturas_query.order_by('sigla', 'seccion')
    vistos = set()
    asignaturas_list = []

    for a in asignaturas_query:
        key = (a.sigla, a.seccion)
        if key not in vistos:
            vistos.add(key)
            asignaturas_list.append(a)

    # Paginación
    page = request.GET.get('page', 1)
    paginator = Paginator(asignaturas_list, 10)
    try:
        page_obj = paginator.page(page)
    except (PageNotAnInteger, EmptyPage):
        page_obj = paginator.page(1)
    
    # 3. Datos para filtros desplegables (dependientes de la Sede)
    
    # Query base para los desplegables (filtrada por sede si existe)
    query_filtros = Asignatura.objects.all()
    if sede:
        query_filtros = query_filtros.filter(sede=sede)

    carreras = query_filtros.values_list('carrera', flat=True).distinct().order_by('carrera')
    jornadas = query_filtros.values_list('jornada', flat=True).distinct().order_by('jornada')
    niveles = query_filtros.values_list('nivel', flat=True).distinct().order_by('nivel')

    # Filtro de asignaturas únicas (también depende de sede, carrera y nivel)
    asignaturas_filtro = query_filtros.all()
    if carrera:
        asignaturas_filtro = asignaturas_filtro.filter(carrera=carrera)
    if nivel:
        asignaturas_filtro = asignaturas_filtro.filter(nivel=nivel)
    
    asignaturas_unicas = asignaturas_filtro.values('nombre', 'sigla').distinct().order_by('nombre')
    
    # --- FIN MODIFICACIÓN ---

    return render(request, 'lista_asignaturas.html', {
        'asignaturas': page_obj,
        'sedes': sedes,
        'carreras': carreras,
        'jornadas': jornadas,
        'niveles': niveles,
        'asignaturas_unicas': asignaturas_unicas,
    })