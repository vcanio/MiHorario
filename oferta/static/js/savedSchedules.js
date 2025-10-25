import { getSeleccionadas, setSeleccionadas } from './state.js';
import { actualizarHorario } from './ui.js';
import { diasLargos } from './constants.js';

/**
 * Obtiene el token CSRF de Django
 */
function getCsrfToken() {
    const token = document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
                  document.querySelector('input[name="csrfmiddlewaretoken"]')?.value ||
                  document.querySelector('meta[name="csrf-token"]')?.content || '';
    console.log('🔑 CSRF Token encontrado:', token ? 'SÍ' : 'NO', token.substring(0, 10) + '...');
    return token;
}

/**
 * Guarda el horario actual
 */
export async function guardarHorarioActual() {
    console.log('💾 Intentando guardar horario...');
    const seleccionadas = getSeleccionadas();
    console.log('📋 Asignaturas seleccionadas:', seleccionadas);
    
    if (Object.keys(seleccionadas).length === 0) {
        console.warn('⚠️ No hay asignaturas seleccionadas');
        mostrarNotificacion('No hay asignaturas seleccionadas para guardar', 'error');
        return;
    }

    const nombre = prompt('Nombre del horario:');
    console.log('✏️ Nombre ingresado:', nombre);
    
    if (!nombre || nombre.trim() === '') {
        console.log('❌ Usuario canceló o no ingresó nombre');
        return;
    }

    const asignaturas_ids = Object.values(seleccionadas).map(a => a.id);
    console.log('🆔 IDs de asignaturas a guardar:', asignaturas_ids);

    const payload = {
        nombre: nombre.trim(),
        asignaturas_ids
    };
    console.log('📤 Payload a enviar:', payload);

    try {
        console.log('🌐 Enviando petición POST a /api/horarios/guardar/');
        const response = await fetch('/api/horarios/guardar/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify(payload)
        });

        console.log('📥 Respuesta recibida:', response.status, response.statusText);
        const data = await response.json();
        console.log('📊 Datos de respuesta:', data);

        if (response.ok) {
            console.log('✅ Horario guardado exitosamente');
            mostrarNotificacion(data.mensaje, 'success');
            await cargarListaHorariosGuardados();
        } else {
            console.error('❌ Error en respuesta:', data.error);
            mostrarNotificacion(data.error || 'Error al guardar', 'error');
        }
    } catch (error) {
        console.error('💥 Error de conexión:', error);
        mostrarNotificacion('Error de conexión', 'error');
    }
}

/**
 * Carga un horario guardado
 */
export async function cargarHorario(horarioData) {
    console.log('📂 Cargando horario:', horarioData);
    const nuevasSeleccionadas = {};

    for (const asig of horarioData.asignaturas) {
        console.log('➕ Procesando asignatura:', asig.sigla, asig.nombre);
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

    console.log('📝 Nuevas seleccionadas:', nuevasSeleccionadas);
    setSeleccionadas(nuevasSeleccionadas);
    actualizarHorario();
    actualizarBotonesSeleccionados();
    mostrarNotificacion(`Horario "${horarioData.nombre}" cargado`, 'success');
}

/**
 * Elimina un horario guardado
 */
export async function eliminarHorario(horarioId, nombreHorario) {
    console.log('🗑️ Intentando eliminar horario:', horarioId, nombreHorario);
    
    if (!confirm(`¿Eliminar el horario "${nombreHorario}"?`)) {
        console.log('❌ Usuario canceló eliminación');
        return;
    }

    try {
        console.log('🌐 Enviando petición DELETE a /api/horarios/eliminar/' + horarioId);
        const response = await fetch(`/api/horarios/eliminar/${horarioId}/`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': getCsrfToken()
            }
        });

        console.log('📥 Respuesta recibida:', response.status);
        const data = await response.json();
        console.log('📊 Datos de respuesta:', data);

        if (response.ok) {
            console.log('✅ Horario eliminado exitosamente');
            mostrarNotificacion(data.mensaje, 'success');
            await cargarListaHorariosGuardados();
        } else {
            console.error('❌ Error en respuesta:', data.error);
            mostrarNotificacion(data.error || 'Error al eliminar', 'error');
        }
    } catch (error) {
        console.error('💥 Error de conexión:', error);
        mostrarNotificacion('Error de conexión', 'error');
    }
}

/**
 * Carga la lista de horarios guardados
 */
export async function cargarListaHorariosGuardados() {
    console.log('📋 Intentando cargar lista de horarios guardados...');
    const container = document.getElementById('horarios-guardados-container');
    
    if (!container) {
        console.error('❌ No se encontró el contenedor #horarios-guardados-container');
        return;
    }
    console.log('✅ Contenedor encontrado');

    try {
        console.log('🌐 Enviando petición GET a /api/horarios/listar/');
        const response = await fetch('/api/horarios/listar/');
        console.log('📥 Respuesta recibida:', response.status);
        
        const data = await response.json();
        console.log('📊 Datos recibidos:', data);
        console.log('📊 Cantidad de horarios:', data.horarios.length);

        if (data.horarios.length === 0) {
            console.log('ℹ️ No hay horarios guardados');
            container.innerHTML = `
                <p class="text-gray-400 text-sm italic">
                    No tienes horarios guardados. Selecciona asignaturas y haz clic en "Guardar Horario" para comenzar.
                </p>
            `;
            return;
        }

        console.log('🎨 Renderizando', data.horarios.length, 'horarios');
        container.innerHTML = data.horarios.map(h => {
            console.log('  - Horario:', h.nombre, '(ID:', h.id + ')');
            return `
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
        `}).join('');

        // Guardar datos en memoria para acceso rápido
        window.__horariosGuardadosData = data.horarios;
        console.log('💾 Datos guardados en window.__horariosGuardadosData');

    } catch (error) {
        console.error('💥 Error cargando horarios:', error);
        container.innerHTML = '<p class="text-red-400 text-sm">Error al cargar horarios guardados</p>';
    }
}

/**
 * Funciones globales para usar desde HTML
 */
window.cargarHorarioGuardado = async function(horarioId) {
    console.log('🔄 window.cargarHorarioGuardado llamado con ID:', horarioId);
    console.log('📦 Datos disponibles:', window.__horariosGuardadosData);
    const horario = window.__horariosGuardadosData?.find(h => h.id === horarioId);
    console.log('🔍 Horario encontrado:', horario);
    
    if (horario) {
        await cargarHorario(horario);
    } else {
        console.error('❌ No se encontró el horario con ID:', horarioId);
    }
};

window.eliminarHorarioGuardado = async function(horarioId, nombre) {
    console.log('🗑️ window.eliminarHorarioGuardado llamado:', horarioId, nombre);
    await eliminarHorario(horarioId, nombre);
};

console.log('✅ Funciones globales registradas:', {
    cargarHorarioGuardado: typeof window.cargarHorarioGuardado,
    eliminarHorarioGuardado: typeof window.eliminarHorarioGuardado
});

/**
 * Actualiza los botones de las asignaturas según el horario cargado
 */
function actualizarBotonesSeleccionados() {
    console.log('🔄 Actualizando botones seleccionados...');
    const seleccionadas = getSeleccionadas();
    console.log('📋 Seleccionadas actuales:', Object.keys(seleccionadas));
    
    const botones = document.querySelectorAll('.seleccionar-btn');
    console.log('🔘 Botones encontrados:', botones.length);
    
    botones.forEach(btn => {
        const sigla = btn.dataset.sigla;
        const seccion = btn.dataset.seccion;
        
        if (seleccionadas[sigla] && seleccionadas[sigla].seccion === seccion) {
            console.log('  ✓ Marcando como seleccionado:', sigla, seccion);
            btn.disabled = true;
            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
            `;
        } else {
            btn.disabled = false;
            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
            `;
        }
    });
}

/**
 * Muestra una notificación temporal
 */
function mostrarNotificacion(mensaje, tipo = 'info') {
    console.log('🔔 Mostrando notificación:', tipo, mensaje);
    const container = document.getElementById('notificaciones-container') || crearContenedorNotificaciones();
    
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
    console.log('📦 Creando contenedor de notificaciones');
    const container = document.createElement('div');
    container.id = 'notificaciones-container';
    container.className = 'fixed top-4 right-4 z-50 space-y-2';
    document.body.appendChild(container);
    return container;
}

console.log('✅ savedSchedules.js cargado completamente');