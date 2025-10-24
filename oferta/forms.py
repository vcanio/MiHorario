from django import forms
# Importa el formulario de creación de usuario
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User

class ExcelUploadForm(forms.Form):
    archivo_excel = forms.FileField(label="Archivo Excel")

# --- NUEVO FORMULARIO DE REGISTRO ---
class RegistroForm(UserCreationForm):
    # Puedes añadir campos extra aquí si quieres (ej. email)
    
    class Meta(UserCreationForm.Meta):
        model = User
        # Define los campos que el usuario verá
        fields = ('username', 'email') 

    def __init__(self, *args, **kwargs):
        super(RegistroForm, self).__init__(*args, **kwargs)
        # Opcional: añade clases de Tailwind a los campos
        for field_name in self.fields:
            self.fields[field_name].widget.attrs['class'] = 'w-full px-4 py-3 rounded-lg border border-gray-600 bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500'