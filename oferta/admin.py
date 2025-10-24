from django.contrib import admin
from .models import Asignatura, Horario, HorarioGuardado

# 1. Define una clase ModelAdmin personalizada para Asignatura
@admin.register(Asignatura)
class AsignaturaAdmin(admin.ModelAdmin):
    """
    Configuración personalizada para el modelo Asignatura en el admin.
    """
    # Campos que se mostrarán en la vista de lista
    list_display = ('nombre', 'sigla', 'seccion', 'sede', 'carrera', 'jornada', 'nivel')
    
    # --- AQUÍ ESTÁN LOS FILTROS ---
    # Añade filtros en la barra lateral derecha
    list_filter = ('sede', 'carrera', 'jornada', 'nivel', 'virtual_sincronica')
    
    # Habilita una barra de búsqueda
    search_fields = ('nombre', 'sigla', 'docente', 'seccion')
    
    # Mejora el rendimiento para campos relacionados
    list_select_related = True

# 2. Define una clase ModelAdmin personalizada para Horario
@admin.register(Horario)
class HorarioAdmin(admin.ModelAdmin):
    """
    Configuración personalizada para el modelo Horario en el admin.
    """
    list_display = ('get_asignatura_nombre', 'dia', 'hora_inicio', 'hora_fin')
    
    # Filtro por día
    list_filter = ('dia',)
    
    # Búsqueda por campos de la asignatura relacionada
    search_fields = ('asignatura__nombre', 'asignatura__sigla')

    def get_asignatura_nombre(self, obj):
        return obj.asignatura
    get_asignatura_nombre.short_description = 'Asignatura'
    get_asignatura_nombre.admin_order_field = 'asignatura'

admin.site.register(HorarioGuardado)