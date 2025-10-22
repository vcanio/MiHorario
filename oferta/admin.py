from django.contrib import admin
from .models import Asignatura, Horario

# Registra los modelos para que aparezcan en el panel de admin
admin.site.register(Asignatura)
admin.site.register(Horario)