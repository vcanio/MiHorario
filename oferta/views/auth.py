# oferta/views/auth.py
"""
Vistas de autenticación y registro de usuarios
"""

from django.shortcuts import render, redirect
from django.contrib.auth import login

from ..forms import RegistroForm


def registro(request):
    """
    Registro de nuevos usuarios y login automático.
    """
    if request.method == 'POST':
        form = RegistroForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('inicio')
    else:
        form = RegistroForm()

    return render(request, 'registration/registro.html', {'form': form})