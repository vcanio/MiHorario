# Usa una imagen base de Python
FROM python:3.13.5-slim

# Establece variables de entorno
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Establece el directorio de trabajo
WORKDIR /app

# Instala dependencias del sistema necesarias para psycopg2
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copia el archivo de requisitos
COPY requirements.txt .

# Instala las dependencias de Python
RUN pip install --no-cache-dir -r requirements.txt

# Copia el código de la aplicación
COPY . .

# Crea el directorio para archivos estáticos
RUN mkdir -p /app/staticfiles

# Recolecta archivos estáticos
RUN python manage.py collectstatic --noinput

# Expone el puerto 8000
EXPOSE 8000

# Script de entrada para ejecutar migraciones y servidor
CMD python manage.py migrate --noinput && \
    gunicorn horario.wsgi:application --bind 0.0.0.0:8000 --workers 3