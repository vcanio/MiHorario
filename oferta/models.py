from django.db import models

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

class Horario(models.Model):
    asignatura = models.ForeignKey(Asignatura, on_delete=models.CASCADE, related_name="horarios")
    dia = models.CharField(max_length=20)
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()

    def __str__(self):
        return f"{self.dia} {self.hora_inicio}-{self.hora_fin}"
