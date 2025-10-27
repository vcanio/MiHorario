# oferta/views/__init__.py
"""
Vistas principales de la aplicación MiHorario
"""

from .asignaturas import (
    seleccionar_sede,
    lista_asignaturas,
    cargar_excel
)

from .horarios_guardados import (
    guardar_horario,
    listar_horarios_guardados,
    eliminar_horario_guardado
)

from .generador import (
    generador_horarios,
    api_asignaturas_generador,
    api_generar_horarios
)

from .auth import registro

__all__ = [
    # Asignaturas
    'seleccionar_sede',
    'lista_asignaturas',
    'cargar_excel',
    
    # Horarios guardados
    'guardar_horario',
    'listar_horarios_guardados',
    'eliminar_horario_guardado',
    
    # Generador
    'generador_horarios',
    'api_asignaturas_generador',
    'api_generar_horarios',
    
    # Autenticación
    'registro',
]