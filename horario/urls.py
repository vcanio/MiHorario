from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect
from oferta import views

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # La página de inicio ahora es el selector de sede
    path('', views.seleccionar_sede, name='inicio'),
    
    # La lista de asignaturas mantiene su URL
    path('lista_asignaturas/', views.lista_asignaturas, name='lista_asignaturas'),
    
    # La URL de carga para el admin se mantiene
    path('cargar/', views.cargar_excel, name='cargar_excel'),
]