# oferta/views/auth.py
"""
Vistas de autenticación y registro de usuarios
"""

from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.contrib import messages

from ..forms import RegistroForm


def registro(request):
    """
    Registro de nuevos usuarios.
    Ya NO inicia sesión automáticamente - el usuario debe hacer login manualmente.
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
            
            # Redirigir al login (sin iniciar sesión automáticamente)
            return redirect('login')
    else:
        form = RegistroForm()

    return render(request, 'registration/registro.html', {'form': form})