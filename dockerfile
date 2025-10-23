# 1. Usar una imagen base de Python
FROM python:3.11-slim

# 2. Configurar variables de entorno
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# 3. Instalar dependencias del sistema
# ACTUALIZACIÓN: Necesitamos 'build-essential' y 'libpq-dev' para compilar psycopg2 (el driver de Postgres)
# y 'curl' para chequeos de salud (opcional pero recomendado).
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 4. Crear un usuario no-root para seguridad
# ACTUALIZACIÓN: Correr como 'root' en producción es un riesgo de seguridad.
WORKDIR /app
RUN addgroup --system app && adduser --system --group app

# 5. Instalar las dependencias de Python
# Copiamos solo requirements.txt primero para aprovechar el caché de Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 6. Copiar todo el código de tu proyecto
COPY . .

# 7. Recolectar archivos estáticos
# ACTUALIZACIÓN: 'collectstatic' debe correrse al *construir* la imagen.
# Esto usa el STATIC_ROOT que definiste en settings.py.
RUN python manage.py collectstatic --noinput

# 8. Cambiar el propietario de los archivos al usuario no-root
RUN chown -R app:app /app

# 9. Cambiar al usuario no-root
USER app

# 10. Exponer el puerto que usará Gunicorn
EXPOSE 8000

# NOTA: El comando de inicio (CMD) lo definiremos en el docker-compose.yml
# (Tu nota original es 100% correcta)