// ============================================================
// savedSchedules.js
// Gestión de horarios guardados: guardar, cargar, eliminar y listar
// ============================================================

import { getSeleccionadas, setSeleccionadas } from './state.js';
import { actualizarHorario } from './ui.js';
import { diasLargos } from './constants.js';

// ============================================================
// Obtener token CSRF de Django
// ============================================================
function getCsrfToken() {
    const token =
        document.querySelector('[name=csrfmiddlewaretoken]')?.value ||
        document.querySelector('input[name="csrfmiddlewaretoken"]')?.value ||
        document.querySelector('meta[name="csrf-token"]')?.content ||
        '';
    return token;
}

// ============================================================
// Guardar el horario actual
// ============================================================
export async function guardarHorarioActual() {
    const seleccionadas = getSeleccionadas();

    if (Object.keys(seleccionadas).length === 0) {
        mostrarNotificacion('No hay asignaturas seleccionadas para guardar', 'error');
        return;
    }

    const nombre = prompt('Nombre del horario:');
    if (!nombre || nombre.trim() === '') {
        return;
    }

    const payload = {
        nombre: nombre.trim(),
        asignaturas_ids: Object.values(seleccionadas).map(a => a.id)
    };

    try {
        const response = await fetch('/api/horarios/guardar/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            mostrarNotificacion(data.mensaje, 'success');
            await cargarListaHorariosGuardados();
        } else {
            mostrarNotificacion(data.error || 'Error al guardar', 'error');
        }
    } catch (error) {
        mostrarNotificacion('Error de conexión', 'error');
    }
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
// Eliminar un horario guardado
// ============================================================
export async function eliminarHorario(horarioId, nombreHorario) {
    if (!confirm(`¿Eliminar el horario "${nombreHorario}"?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/horarios/eliminar/${horarioId}/`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': getCsrfToken() }
        });

        const data = await response.json();

        if (response.ok) {
            mostrarNotificacion(data.mensaje, 'success');
            await cargarListaHorariosGuardados();
        } else {
            mostrarNotificacion(data.error || 'Error al eliminar', 'error');
        }
    } catch (error) {
        mostrarNotificacion('Error de conexión', 'error');
    }
}

// ============================================================
// Cargar lista de horarios guardados
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

        window.__horariosGuardadosData = data.horarios;
    } catch (error) {
        container.innerHTML = '<p class="text-red-400 text-sm">Error al cargar horarios guardados</p>';
    }
}

// ============================================================
// Funciones globales accesibles desde HTML
// ============================================================
window.cargarHorarioGuardado = async function (horarioId) {
    const horario = window.__horariosGuardadosData?.find(h => h.id === horarioId);
    if (horario) {
        await cargarHorario(horario);
    } else {
        console.error('No se encontró el horario con ID:', horarioId);
    }
};

window.eliminarHorarioGuardado = async function (horarioId, nombre) {
    await eliminarHorario(horarioId, nombre);
};

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

// ============================================================
// Sistema de notificaciones
// ============================================================
function mostrarNotificacion(mensaje, tipo = 'info') {
    const container =
        document.getElementById('notificaciones-container') || crearContenedorNotificaciones();

    const colores = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        info: 'bg-blue-600'
    };

    const notif = document.createElement('div');
    notif.className = `${colores[tipo]} text-white px-4 py-3 rounded-lg shadow-lg mb-2 animate-fade-in`;
    notif.textContent = mensaje;

    container.appendChild(notif);

    setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.transform = 'translateY(-10px)';
        notif.style.transition = 'all 0.3s ease';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

function crearContenedorNotificaciones() {
    const container = document.createElement('div');
    container.id = 'notificaciones-container';
    container.className = 'fixed top-4 right-4 z-50 space-y-2';
    document.body.appendChild(container);
    return container;
}

console.log('savedSchedules.js cargado correctamente');
