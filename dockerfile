# Imagen base ligera de Python
FROM python:3.12-slim

# Evita que Python genere archivos .pyc y fuerza el buffer de logs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Crea y usa un directorio de trabajo
WORKDIR /app

# Instala dependencias del sistema necesarias para psycopg2 y pandas
RUN apt-get update && apt-get install -y \
    build-essential libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Copia los archivos de requerimientos e instálalos
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copia todo el proyecto
COPY . .

# Expone el puerto
EXPOSE 8000

# Ejecuta collectstatic (sin entrada interactiva)
RUN python manage.py collectstatic --noinput

# Comando de inicio usando gunicorn
CMD ["gunicorn", "horario.wsgi:application", "--bind", "0.0.0.0:8000"]
