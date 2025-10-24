from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect
from oferta import views
# Importa las vistas de autenticación de Django
from django.contrib.auth import views as auth_views

urlpatterns = [
    path('admin/', admin.site.urls),
    
    path('', views.seleccionar_sede, name='inicio'),
    
    path('lista_asignaturas/', views.lista_asignaturas, name='lista_asignaturas'),
    
    path('cargar/', views.cargar_excel, name='cargar_excel'),

    # 1. Inicio de Sesión
    path('login/', auth_views.LoginView.as_view(
        template_name='registration/login.html'
    ), name='login'),

    # 2. Cierre de Sesión
    path('logout/', auth_views.LogoutView.as_view(
        next_page='inicio' # Redirige a la página de seleccionar sede
    ), name='logout'),

    # 3. Registro de Usuario
    path('registro/', views.registro, name='registro'),
]