import { diasLargos, iconoPlus, iconoTicket } from './constants.js';
import { haySolapamiento } from './schedule.js';
import { 
    addSeleccionada, removeSeleccionada, hasAsignaturaSeleccionada, 
    getAsignaturaSeleccionada, setConfirmCallback, getConfirmCallback
} from './state.js';
import {
    modal, modalBtnCerrar, modalConfirm, confirmModalBtnCancelar, 
    confirmModalBtnAceptar, mostrarModal, ocultarModal, 
    mostrarModalConfirmacion, ocultarModalConfirmacion, actualizarHorario
} from './ui.js';
import { exportarComoICS, exportarComoPDF } from './exporters.js';
import { guardarHorarioActual, cargarListaHorariosGuardados } from './savedSchedules.js';

console.log('🚀 main.js iniciado');

// === MANEJO DE EVENTOS ===

/**
 * Quita una asignatura de la selección y actualiza la UI.
 * @param {string} sigla - La sigla de la asignatura a quitar.
 */
function quitarAsignatura(sigla) {
    console.log('➖ Quitando asignatura:', sigla);
    removeSeleccionada(sigla);
    actualizarHorario();
    // Re-habilitar todos los botones para esa sigla
    document.querySelectorAll(`.seleccionar-btn[data-sigla="${sigla}"]`).forEach(btn => {
        btn.disabled = false;
        btn.innerHTML = iconoPlus;
    });
}

/**
 * Añade o reemplaza una asignatura en la selección.
 * @param {HTMLElement} btn - El botón que fue presionado.
 */
function seleccionarAsignatura(btn) {
    console.log('✨ Seleccionando asignatura desde botón:', btn.dataset);
    const { sigla, seccion, nombre, id, virtual } = btn.dataset;
    let horarios;

    try {
        horarios = JSON.parse(btn.dataset.horarios.replace(/&quot;/g, '"')).map(h => ({
            dia: diasLargos[h.dia] || h.dia,
            inicio: h.inicio,
            fin: h.fin
        }));
        console.log('📅 Horarios parseados:', horarios);
    } catch (e) {
        console.error("💥 Error leyendo horarios", e);
        mostrarModal('Error', 'No se pudieron procesar los horarios de esta asignatura.');
        return;
    }

    // Pasamos la 'sigla' de la asignatura actual a la función de solapamiento.
    const solapado = haySolapamiento(horarios, sigla);

    if (solapado) {
        console.warn('⚠️ Conflicto de horario detectado:', solapado);
        mostrarModal(
            'Conflicto de Horario',
            `No puedes seleccionar esta sección porque se solapa con ${solapado.nombre} (${solapado.seccion}).`
        );
        return;
    }

    const asignaturaData = {
        id,
        nombre,
        seccion,
        horarios,
        virtual: ['true', 'sí'].includes((virtual || '').toLowerCase())
    };

    if (hasAsignaturaSeleccionada(sigla)) {
        const actual = getAsignaturaSeleccionada(sigla);
        console.log('🔄 Ya existe esta asignatura, pidiendo confirmación para reemplazar');
        // Guardar el callback en el estado
        setConfirmCallback(() => {
            console.log('✅ Usuario confirmó reemplazo');
            addSeleccionada(sigla, asignaturaData);
            actualizarHorario();
            actualizarBotones(sigla, seccion);
        });
        // Mostrar modal de confirmación
        mostrarModalConfirmacion(
            'Confirmar Reemplazo',
            `Ya tienes seleccionada la sección ${actual.seccion} para ${nombre}. ¿Deseas reemplazarla por la sección ${seccion}?`
        );
        return; // Detener ejecución, esperar confirmación
    }

    // Flujo normal (añadir sin reemplazo)
    console.log('➕ Añadiendo asignatura sin conflictos');
    addSeleccionada(sigla, asignaturaData);
    actualizarHorario();
    actualizarBotones(sigla, seccion);
}

/**
 * Actualiza el estado visual de los botones (habilitado/deshabilitado).
 * @param {string} sigla - La sigla de la asignatura.
 * @param {string} seccionSeleccionada - La sección que ahora está seleccionada.
 */
function actualizarBotones(sigla, seccionSeleccionada) {
    console.log('🔘 Actualizando botones para:', sigla, seccionSeleccionada);
    document.querySelectorAll(`.seleccionar-btn[data-sigla="${sigla}"]`).forEach(b => {
        b.disabled = b.dataset.seccion === seccionSeleccionada;
        b.innerHTML = b.disabled ? iconoTicket : iconoPlus;
    });
}

/**
 * Configura todos los event listeners iniciales de la aplicación.
 */
function inicializarListeners() {
    console.log('🎧 Inicializando event listeners...');
    
    // Modales de Alerta y Confirmación
    if (modalBtnCerrar) {
        modalBtnCerrar.addEventListener('click', ocultarModal);
        console.log('✅ Listener modal cerrar');
    }
    
    if (modal) {
        modal.addEventListener('click', (e) => e.target === modal && ocultarModal());
        console.log('✅ Listener modal backdrop');
    }
    
    if (confirmModalBtnCancelar) {
        confirmModalBtnCancelar.addEventListener('click', ocultarModalConfirmacion);
        console.log('✅ Listener confirm cancelar');
    }
    
    if (modalConfirm) {
        modalConfirm.addEventListener('click', (e) => e.target === modalConfirm && ocultarModalConfirmacion());
        console.log('✅ Listener confirm backdrop');
    }
    
    if (confirmModalBtnAceptar) {
        confirmModalBtnAceptar.addEventListener('click', () => {
            const callback = getConfirmCallback();
            if (callback) {
                callback(); // Ejecutamos la acción guardada
            }
            ocultarModalConfirmacion();
            setConfirmCallback(null); // Limpiamos la acción
        });
        console.log('✅ Listener confirm aceptar');
    }

    // Botones de Seleccionar Asignatura
    const botonesSeleccionar = document.querySelectorAll('.seleccionar-btn');
    console.log('🔘 Botones de selección encontrados:', botonesSeleccionar.length);
    
    botonesSeleccionar.forEach(btn => {
        const { sigla, seccion } = btn.dataset;
        // Marcar botones ya seleccionados al cargar la página
        if (hasAsignaturaSeleccionada(sigla) && getAsignaturaSeleccionada(sigla).seccion === seccion) {
            btn.disabled = true;
            btn.innerHTML = iconoTicket;
        }
        btn.addEventListener('click', () => seleccionarAsignatura(btn));
    });

    // Botones de Exportar
    const btnIcs = document.querySelector('button[class*="bg-green-600"]');
    if (btnIcs && btnIcs.textContent.includes('Google Calendar')) {
        btnIcs.onclick = null;
        btnIcs.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('📅 Exportando a ICS...');
            exportarComoICS();
        });
        console.log('✅ Listener exportar ICS');
    }

    const btnPdf = document.querySelector('button[class*="bg-blue-600"]');
    if (btnPdf && btnPdf.textContent.includes('PDF')) {
        btnPdf.onclick = null;
        btnPdf.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('📄 Exportando a PDF...');
            exportarComoPDF();
        });
        console.log('✅ Listener exportar PDF');
    }

    // Delegación de eventos para "Quitar Asignatura"
    const horarioDiv = document.getElementById('horario');
    if (horarioDiv) {
        horarioDiv.addEventListener('click', (e) => {
            const botonQuitar = e.target.closest('button[data-accion="quitar-asignatura"]');
            if (botonQuitar) {
                const sigla = botonQuitar.dataset.sigla;
                quitarAsignatura(sigla);
            }
        });
        console.log('✅ Listener quitar asignatura (delegación)');
    }

    // Botón de Guardar Horario
    const btnGuardarHorario = document.getElementById('btn-guardar-horario');
    if (btnGuardarHorario) {
        console.log('✅ Botón guardar horario encontrado');
        btnGuardarHorario.addEventListener('click', (e) => {
            console.log('💾 Click en guardar horario');
            e.preventDefault();
            guardarHorarioActual();
        });
    } else {
        console.log('ℹ️ Botón guardar horario NO encontrado (probablemente usuario no autenticado)');
    }
}

// === INICIALIZACIÓN ===
console.log('⏳ Esperando DOMContentLoaded...');

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM cargado, iniciando aplicación...');
    
    // 1. Renderizar el horario inicial desde el localStorage
    console.log('🎨 Actualizando horario inicial...');
    actualizarHorario();
    
    // 2. Activar todos los event listeners
    inicializarListeners();
    
    // 3. Cargar horarios guardados si el usuario está autenticado
    const contenedorHorarios = document.getElementById('horarios-guardados-container');
    if (contenedorHorarios) {
        console.log('👤 Usuario autenticado, cargando horarios guardados...');
        cargarListaHorariosGuardados();
    } else {
        console.log('👤 Usuario NO autenticado o contenedor no encontrado');
    }
    
    console.log('🎉 Aplicación inicializada completamente');
});