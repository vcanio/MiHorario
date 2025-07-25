from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect
from oferta import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.cargar_excel, name='inicio'),
    path('lista_asignaturas/', views.lista_asignaturas, name='lista_asignaturas'),
]
