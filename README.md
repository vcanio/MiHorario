# 📘 MiHorario - Django + JavaScript

Aplicación web para cargar, visualizar y seleccionar asignaturas con horarios, permitiendo a estudiantes armar su horario personalizado de forma visual e interactiva. La información se carga desde un archivo Excel.

---

## 🛠 Tecnologías

- **Backend:** Django (Python)
- **Frontend:** HTML5, Tailwind CSS, JavaScript (vanilla)
- **Base de datos:** SQLite (por defecto de Django)
- **Dependencias clave:** `pandas`, `openpyxl`
- **Persistencia cliente:** `localStorage` (horario del estudiante)

---

## 🚀 Funcionalidades principales

- 📥 Carga de asignaturas y horarios desde un archivo Excel.
- 📄 Visualización tabular filtrable por carrera, jornada, nivel y nombre de asignatura.
- 🧠 Prevención de solapamientos de horarios al seleccionar asignaturas.
- 🎨 Generación de horario semanal visual y dinámico.
- 💾 Persistencia local del horario mediante `localStorage`.
- 🔄 Interfaz interactiva con selección/deselección de secciones por asignatura.

---

## ⚙️ Instalación y ejecución

### 1. Clona el repositorio

```bash
git clone https://github.com/tuusuario/oferta-academica.git
cd oferta-academica
