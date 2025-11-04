# horario/urls.py
from django.contrib import admin
from django.urls import path
from oferta import views
from django.contrib.auth import views as auth_views

urlpatterns = [
    path('admin/', admin.site.urls),
    
    path('', views.seleccionar_sede, name='inicio'),
    
    path('lista_asignaturas/', views.lista_asignaturas, name='lista_asignaturas'),
    
    path('cargar/', views.cargar_excel, name='cargar_excel'),

    # --- GENERADOR DE HORARIOS ---
    path('api/generador/asignaturas/', views.api_asignaturas_generador, name='api_asignaturas_generador'),
    path('api/generador/generar/', views.api_generar_horarios, name='api_generar_horarios'),

    # --- AUTENTICACIÓN (MEJORADO) ---
    path('login/', auth_views.LoginView.as_view(
        template_name='registration/login.html',
        # Si hay un parámetro 'next', redirige ahí; si no, a 'inicio'
        redirect_authenticated_user=True  # Evita que usuarios logueados accedan al login
    ), name='login'),

    path('logout/', auth_views.LogoutView.as_view(
        next_page='inicio'
    ), name='logout'),

    path('registro/', views.registro, name='registro'),
    
    # --- HORARIOS GUARDADOS ---
    path('api/horarios/guardar/', views.guardar_horario, name='guardar_horario'),
    path('api/horarios/listar/', views.listar_horarios_guardados, name='listar_horarios'),
    path('api/horarios/eliminar/<int:horario_id>/', views.eliminar_horario_guardado, name='eliminar_horario'),
]