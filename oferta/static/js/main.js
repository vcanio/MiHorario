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

// === MANEJO DE EVENTOS ===

/**
 * Quita una asignatura de la selección y actualiza la UI.
 * @param {string} sigla - La sigla de la asignatura a quitar.
 */
function quitarAsignatura(sigla) {
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
    const { sigla, seccion, nombre, id, virtual } = btn.dataset;
    let horarios;

    try {
        horarios = JSON.parse(btn.dataset.horarios.replace(/&quot;/g, '"')).map(h => ({
            dia: diasLargos[h.dia] || h.dia,
            inicio: h.inicio,
            fin: h.fin
        }));
    } catch (e) {
        console.error("Error leyendo horarios", e);
        mostrarModal('Error', 'No se pudieron procesar los horarios de esta asignatura.');
        return;
    }

    // --- INICIO DE LA CORRECCIÓN ---
    // Pasamos la 'sigla' de la asignatura actual a la función de solapamiento.
    const solapado = haySolapamiento(horarios, sigla);
    // --- FIN DE LA CORRECCIÓN ---

    if (solapado) {
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
        // Guardar el callback en el estado
        setConfirmCallback(() => {
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
    document.querySelectorAll(`.seleccionar-btn[data-sigla="${sigla}"]`).forEach(b => {
        b.disabled = b.dataset.seccion === seccionSeleccionada;
        b.innerHTML = b.disabled ? iconoTicket : iconoPlus;
    });
}

/**
 * Configura todos los event listeners iniciales de la aplicación.
 */
function inicializarListeners() {
    // Modales de Alerta y Confirmación
    if (modalBtnCerrar) modalBtnCerrar.addEventListener('click', ocultarModal);
    if (modal) modal.addEventListener('click', (e) => e.target === modal && ocultarModal());
    if (confirmModalBtnCancelar) confirmModalBtnCancelar.addEventListener('click', ocultarModalConfirmacion);
    if (modalConfirm) modalConfirm.addEventListener('click', (e) => e.target === modalConfirm && ocultarModalConfirmacion());
    
    if (confirmModalBtnAceptar) {
        confirmModalBtnAceptar.addEventListener('click', () => {
            const callback = getConfirmCallback();
            if (callback) {
                callback(); // Ejecutamos la acción guardada
            }
            ocultarModalConfirmacion();
            setConfirmCallback(null); // Limpiamos la acción
        });
    }

    // Botones de Seleccionar Asignatura
    document.querySelectorAll('.seleccionar-btn').forEach(btn => {
        const { sigla, seccion } = btn.dataset;
        // Marcar botones ya seleccionados al cargar la página
        if (hasAsignaturaSeleccionada(sigla) && getAsignaturaSeleccionada(sigla).seccion === seccion) {
            btn.disabled = true;
            btn.innerHTML = iconoTicket;
        }
        btn.addEventListener('click', () => seleccionarAsignatura(btn));
    });

    // Botones de Exportar (reemplazando los 'onclick' del HTML)
    const btnIcs = document.querySelector('button[class*="bg-green-600"]'); // Selector más robusto
    if (btnIcs && btnIcs.textContent.includes('Google Calendar')) {
        btnIcs.onclick = null; // Limpiar atributo antiguo
        btnIcs.addEventListener('click', (e) => {
            e.preventDefault();
            exportarComoICS();
        });
    }

    const btnPdf = document.querySelector('button[class*="bg-blue-600"]'); // Selector más robusto
    if (btnPdf && btnPdf.textContent.includes('PDF')) {
        btnPdf.onclick = null; // Limpiar atributo antiguo
        btnPdf.addEventListener('click', (e) => {
            e.preventDefault();
            exportarComoPDF();
        });
    }

    // Delegación de eventos para "Quitar Asignatura"
    const horarioDiv = document.getElementById('horario');
    if (horarioDiv) {
        horarioDiv.addEventListener('click', (e) => {
            // Buscamos el botón más cercano que coincida
            const botonQuitar = e.target.closest('button[data-accion="quitar-asignatura"]');
            if (botonQuitar) {
                const sigla = botonQuitar.dataset.sigla;
                quitarAsignatura(sigla);
            }
        });
    }
}

// === INICIALIZACIÓN ===
// Asegurarse que el DOM esté cargado para no tener problemas
document.addEventListener('DOMContentLoaded', () => {
    // 1. Renderizar el horario inicial desde el localStorage
    actualizarHorario();
    // 2. Activar todos los event listeners
    inicializarListeners();
});