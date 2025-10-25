// ============================================================
// savedSchedules.js
// Gestión de horarios guardados: guardar, cargar, eliminar y listar
// ============================================================

import { getSeleccionadas, setSeleccionadas } from './state.js';
// Importamos los helpers desde ui.js (notificación, token, etc)
import { actualizarHorario, getCsrfToken, mostrarNotificacion } from './ui.js';
import { diasLargos } from './constants.js';

// ============================================================
// Guardar el horario actual (Muestra el modal)
// ============================================================
export function guardarHorarioActual() {
    const seleccionadas = getSeleccionadas();

    if (Object.keys(seleccionadas).length === 0) {
        mostrarNotificacion('No hay asignaturas seleccionadas para guardar', 'error');
        return;
    }

    // Busca y muestra el modal de guardar
    const modal = document.getElementById('modal-guardar-horario');
    const input = document.getElementById('guardar-horario-nombre');
    const errorEl = document.getElementById('guardar-modal-error');

    if (modal) modal.classList.remove('hidden');
    if (input) {
        input.value = ''; // Limpia el input
        input.focus();
    }
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }
    
    // La lógica de 'fetch' para guardar se maneja en main.js
}

// ============================================================
// Cargar un horario guardado
// ============================================================
export async function cargarHorario(horarioData) {
    const nuevasSeleccionadas = {};

    for (const asig of horarioData.asignaturas) {
        nuevasSeleccionadas[asig.sigla] = {
            id: asig.id,
            nombre: asig.nombre,
            seccion: asig.seccion,
            virtual: asig.virtual_sincronica === 'True' || asig.virtual_sincronica === true,
            horarios: asig.horarios.map(h => ({
                dia: diasLargos[h.dia] || h.dia,
                inicio: h.inicio,
                fin: h.fin
            }))
        };
    }

    setSeleccionadas(nuevasSeleccionadas);
    actualizarHorario();
    actualizarBotonesSeleccionados();
    mostrarNotificacion(`Horario "${horarioData.nombre}" cargado`, 'success');
}

// ============================================================
// Cargar lista de horarios guardados (Fetch y render)
// ============================================================
export async function cargarListaHorariosGuardados() {
    const container = document.getElementById('horarios-guardados-container');

    if (!container) {
        console.error('No se encontró el contenedor #horarios-guardados-container');
        return;
    }

    try {
        const response = await fetch('/api/horarios/listar/');
        const data = await response.json();

        if (!data.horarios || data.horarios.length === 0) {
            container.innerHTML = `
                <p class="text-gray-400 text-sm italic">
                    No tienes horarios guardados. Selecciona asignaturas y haz clic en "Guardar Horario" para comenzar.
                </p>`;
            return;
        }

        // Renderiza la lista de horarios guardados
        container.innerHTML = data.horarios
            .map(
                h => `
            <div class="group flex items-center gap-2 bg-gray-700 hover:bg-gray-600 rounded-full px-4 py-2 transition-all cursor-pointer">
                <button 
                    onclick="window.cargarHorarioGuardado(${h.id})" 
                    class="flex-1 text-left text-sm font-medium text-white">
                    ${h.nombre}
                </button>
                <button 
                    onclick="window.eliminarHorarioGuardado(${h.id}, '${h.nombre.replace(/'/g, "\\'")}')" 
                    class="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                    title="Eliminar">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        `
            )
            .join('');

        // Almacena los datos en 'window' para que los botones 'onclick' puedan acceder a ellos
        window.__horariosGuardadosData = data.horarios;
    } catch (error) {
        container.innerHTML = '<p class="text-red-400 text-sm">Error al cargar horarios guardados</p>';
    }
}

// ============================================================
// Funciones globales accesibles desde HTML (onclick)
// ============================================================

// Esta función es llamada por el botón de cargar horario
window.cargarHorarioGuardado = async function (horarioId) {
    const horario = window.__horariosGuardadosData?.find(h => h.id === horarioId);
    if (horario) {
        await cargarHorario(horario);
    } else {
        console.error('No se encontró el horario con ID:', horarioId);
    }
};

// --- ESTA ES LA FUNCIÓN CORREGIDA ---
// Esta función ahora solo muestra el modal y guarda los datos en él
window.eliminarHorarioGuardado = function (horarioId, nombre) {
    const modal = document.getElementById('modal-eliminar-horario');
    const mensaje = document.getElementById('eliminar-modal-mensaje');
    const btnAceptar = document.getElementById('eliminar-modal-btn-aceptar');

    if (!modal || !mensaje || !btnAceptar) {
        console.error('No se encontró el HTML del modal de eliminación.');
        // Fallback al confirm nativo si el modal no existe
        if (confirm(`Error: Modal no encontrado. ¿Desea eliminar "${nombre}" de todas formas?`)) {
             console.error("Ejecutando eliminación de fallback. Revisa el HTML de 'modal-eliminar-horario'.");
             // Esto es solo un fallback de emergencia, la lógica real se movió a main.js
             // Para que este fallback funcione, tendrías que re-añadir la función 'eliminarHorario'
        }
        return;
    }
    
    // Personaliza el mensaje del modal
    mensaje.textContent = `¿Estás seguro de que quieres eliminar el horario "${nombre}"? Esta acción no se puede deshacer.`;
    
    // Almacenamos el ID en el botón "Eliminar" para que main.js lo pueda leer
    btnAceptar.dataset.horarioId = horarioId;
    
    // Muestra el modal
    modal.classList.remove('hidden');
};
// --- FIN DE LA CORRECCIÓN ---


// ============================================================
// Actualiza el estado visual de los botones de selección
// ============================================================
function actualizarBotonesSeleccionados() {
    const seleccionadas = getSeleccionadas();
    const botones = document.querySelectorAll('.seleccionar-btn');

    botones.forEach(btn => {
        const sigla = btn.dataset.sigla;
        const seccion = btn.dataset.seccion;

        if (seleccionadas[sigla] && seleccionadas[sigla].seccion === seccion) {
            btn.disabled = true;
            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m4.5 12.75 6 6 9-13.5" />
                </svg>`;
        } else {
            btn.disabled = false;
            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>`;
        }
    });
}

console.log('savedSchedules.js cargado correctamente');