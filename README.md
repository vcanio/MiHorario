# MiHorario – App de horario para estudiantes de Duoc UC

MiHorario es una aplicación web pensada para estudiantes de Duoc UC. Permite cargar el archivo Excel con la oferta académica oficial de tu sede y armar tu horario personalizado de forma visual e interactiva, evitando solapamientos de ramos.

---

## 🛠 Tecnologías

- **Backend:** Django (Python)
- **Frontend:** HTML5, Tailwind CSS, JavaScript (vanilla)
- **Base de datos:** SQLite (por defecto de Django)
- **Dependencias clave:** `pandas`, `openpyxl`
- **Persistencia cliente:** `localStorage` (horario del estudiante)

---

## 🚀 Funcionalidades principales

-  Carga de asignaturas y horarios desde un archivo Excel.
-  Visualización tabular filtrable por carrera, jornada, nivel y nombre de asignatura.
-  Prevención de solapamientos de horarios al seleccionar asignaturas.
-  Generación de horario semanal visual y dinámico.
-  Persistencia local del horario mediante `localStorage`.
-  Interfaz interactiva con selección/deselección de secciones por asignatura.

---

## ⚙️ Instalación y ejecución

### 1. Clona el repositorio

```bash
git clone https://github.com/tuusuario/oferta-academica.git
cd oferta-academica
```
### 2. Crea y activa un entorno virtual

```bash
python -m venv env
source env/bin/activate  # En Windows usa: env\Scripts\activate
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
