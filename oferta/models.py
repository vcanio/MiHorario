from django.db import models
from django.contrib.auth.models import User


# --- MODELO PRINCIPAL DE ASIGNATURAS ---
class Asignatura(models.Model):
    sede = models.CharField(max_length=100)
    carrera = models.CharField(max_length=100)
    plan = models.CharField(max_length=20)
    jornada = models.CharField(max_length=50)
    nivel = models.CharField(max_length=50)
    sigla = models.CharField(max_length=10)
    nombre = models.CharField(max_length=200)
    seccion = models.CharField(max_length=20)
    docente = models.CharField(max_length=200, blank=True, null=True)
    virtual_sincronica = models.CharField(max_length=200, blank=True, null=True)

    def __str__(self):
        return f"{self.sigla} - {self.nombre} ({self.seccion})"


# --- MODELO DE HORARIOS DE CADA ASIGNATURA ---
class Horario(models.Model):
    asignatura = models.ForeignKey(
        Asignatura, on_delete=models.CASCADE, related_name="horarios"
    )
    dia = models.CharField(max_length=20)
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()

    def __str__(self):
        return f"{self.dia} {self.hora_inicio}-{self.hora_fin}"


# --- MODELO PARA HORARIOS GUARDADOS POR USUARIO ---
class HorarioGuardado(models.Model):
    # Usuario dueño del horario
    usuario = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="horarios_guardados"
    )

    # Nombre identificador (ej: “Horario Ideal”, “Vespertino”)
    nombre = models.CharField(max_length=100)

    # Secciones (Asignaturas) que componen el horario
    asignaturas = models.ManyToManyField(
        Asignatura, related_name="en_horarios_guardados"
    )

    # Fecha de última modificación (para orden automático)
    modificado_en = models.DateTimeField(auto_now=True)

    class Meta:
        # Evita duplicados de nombre por usuario
        unique_together = ("usuario", "nombre")
        ordering = ["-modificado_en"]

    def __str__(self):
        return f"'{self.nombre}' de {self.usuario.username}"
