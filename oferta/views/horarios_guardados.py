# oferta/views/horarios_guardados.py
"""
Vistas para gestión de horarios guardados por usuario
"""

import json

from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse

from ..models import Asignatura, HorarioGuardado

# Configuración
MAX_HORARIOS_GUARDADOS = 5
MAX_NOMBRE_LENGTH = 30


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

        # Validaciones
        if not nombre:
            return JsonResponse({'error': 'El nombre es requerido'}, status=400)
        
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