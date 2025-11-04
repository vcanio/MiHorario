# oferta/views/auth.py
"""
Vistas de autenticación y registro de usuarios
"""

from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.contrib import messages
from django.http import QueryDict

from ..forms import RegistroForm


def registro(request):
    """
    Registro de nuevos usuarios.
    Ya NO inicia sesión automáticamente - el usuario debe hacer login manualmente.
    Preserva el parámetro 'next' para mantener el contexto después del login.
    """
    if request.method == 'POST':
        form = RegistroForm(request.POST)
        if form.is_valid():
            user = form.save()
            
            # Mostrar mensaje de éxito
            messages.success(
                request, 
                f'¡Cuenta creada exitosamente! Ya puedes iniciar sesión con tu usuario "{user.username}".'
            )
            
            # NUEVO: Preservar el parámetro 'next' al redirigir al login
            next_url = request.GET.get('next') or request.POST.get('next')
            if next_url:
                return redirect(f"/login/?next={next_url}")
            else:
                return redirect('login')
    else:
        form = RegistroForm()

    return render(request, 'registration/registro.html', {'form': form})