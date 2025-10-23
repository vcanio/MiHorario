# 1. Usar una imagen base de Python
FROM python:3.11-slim

# 2. Configurar variables de entorno
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# 3. Crear y establecer el directorio de trabajo
WORKDIR /app

# 4. Instalar las dependencias
# Copiamos solo requirements.txt primero para aprovechar el caché de Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copiar todo el código de tu proyecto
COPY . .

# 6. Exponer el puerto que usará Gunicorn
EXPOSE 8000

# NOTA: El comando de inicio (CMD) lo definiremos en el docker-compose.yml
# para tener más control sobre las migraciones y collectstatic.