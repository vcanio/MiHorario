# oferta/views/generador.py
"""
Vistas del generador automático de horarios
"""

import json
from collections import defaultdict

from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse

from ..models import Asignatura
from .generador_utils import (
    generar_combinaciones_optimizado,    calcular_puntuacion_normalizada
)

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
        
        # Generar combinaciones (OPTIMIZADO - Explora todas las opciones)
        horarios_generados = generar_combinaciones_optimizado(
            por_sigla, 
            preferencias,
            max_resultados=10  # Mostramos las 10 mejores
        )
        
        if not horarios_generados:
            return JsonResponse({
                'error': 'No se encontraron combinaciones válidas sin solapamientos. Intenta con otra jornada o menos asignaturas.'
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