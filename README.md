# 🗓 MiHorario – App de Horario para Estudiantes de Duoc UC

[![Python](https://img.shields.io/badge/Python-3.11-blue)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-4.2-green)](https://www.djangoproject.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

**MiHorario** es una aplicación web que ayuda a los estudiantes de Duoc UC a crear su horario académico de manera visual, interactiva y sin solapamientos. Permite cargar el Excel oficial de tu sede, filtrar asignaturas, construir tu horario y exportarlo a PDF o Google Calendar.  

---

## 🚀 Características Principales

- **📂 Carga por Sede:** Procesa automáticamente el Excel oficial y separa la información por sede.  
- **🔍 Filtros Dinámicos:** Filtra asignaturas por Carrera, Jornada, Nivel y Nombre de la Asignatura.  
- **🗓 Constructor Visual de Horarios:** Añade secciones con un clic; previene solapamientos de ramos.  
- **💾 Persistencia Local:** Guarda tu horario en el navegador (localStorage), evitando pérdida de datos.  
- **📤 Exportación Rápida:** Exporta tu horario a `.pdf` o `.ics` (compatible con Google Calendar y Outlook).  

---

## 🛠 Tecnologías Utilizadas

**Backend:** Django (Python)  
**Frontend:** HTML5, Tailwind CSS, JavaScript (vanilla)  
**Base de Datos:** SQLite  

**Dependencias Python clave:**  
- `pandas` – Lectura y procesamiento de Excel  
- `openpyxl` – Lectura de archivos `.xlsx`  

**Dependencias Frontend clave:**  
- `jsPDF` y `html2canvas` – Generación y exportación de PDF  

---

## ⚙️ Instalación y ejecución

### 1. Clona el repositorio

```bash
git clone https://github.com/vcanio/MiHorario.git
cd MiHorario
```
### 2. Crea y activa un entorno virtual

```bash
python -m venv env
# En Linux/macOS:
source env/bin/activate
# En Windows:
env\Scripts\activate
```
### 3. Instala las dependencias

```bash
pip install -r requirements.txt
```
### 4. Aplica migraciones

```bash
python manage.py migrate
```
### 5. Ejecuta el servidor de desarrollo

```bash
python manage.py runserver
```
💡 **Nota:** En entornos Windows, es posible ejecutar el servidor de desarrollo rápidamente mediante el comando run, el cual invoca el script run.bat incluido en el repositorio.
