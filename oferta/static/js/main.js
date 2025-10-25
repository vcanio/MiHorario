// ============================================================
// main.js
// Lógica principal: selección de asignaturas, modales, eventos y exportaciones
// ============================================================

import { diasLargos, iconoPlus, iconoTicket } from './constants.js';
import { haySolapamiento } from './schedule.js';
import {
    addSeleccionada,
    removeSeleccionada,
    hasAsignaturaSeleccionada,
    getAsignaturaSeleccionada,
    setConfirmCallback,
    getConfirmCallback
} from './state.js';
import {
    modal,
    modalBtnCerrar,
    modalConfirm,
    confirmModalBtnCancelar,
    confirmModalBtnAceptar,
    mostrarModal,
    ocultarModal,
    mostrarModalConfirmacion,
    ocultarModalConfirmacion,
    actualizarHorario
} from './ui.js';
import { exportarComoICS, exportarComoPDF } from './exporters.js';
import { guardarHorarioActual, cargarListaHorariosGuardados } from './savedSchedules.js';

window.exportarComoICS = exportarComoICS;
window.exportarComoPDF = exportarComoPDF;

console.log('main.js cargado correctamente');

// ============================================================
// Quitar asignatura seleccionada
// ============================================================
function quitarAsignatura(sigla) {
    removeSeleccionada(sigla);
    actualizarHorario();

    document.querySelectorAll(`.seleccionar-btn[data-sigla="${sigla}"]`).forEach(btn => {
        btn.disabled = false;
        btn.innerHTML = iconoPlus;
    });
}

// ============================================================
// Seleccionar o reemplazar una asignatura
// ============================================================
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
        console.error('Error al leer horarios', e);
        mostrarModal('Error', 'No se pudieron procesar los horarios de esta asignatura.');
        return;
    }

    const solapado = haySolapamiento(horarios, sigla);
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
        setConfirmCallback(() => {
            addSeleccionada(sigla, asignaturaData);
            actualizarHorario();
            actualizarBotones(sigla, seccion);
        });

        mostrarModalConfirmacion(
            'Confirmar Reemplazo',
            `Ya tienes seleccionada la sección ${actual.seccion} para ${nombre}. ¿Deseas reemplazarla por la sección ${seccion}?`
        );
        return;
    }

    addSeleccionada(sigla, asignaturaData);
    actualizarHorario();
    actualizarBotones(sigla, seccion);
}

// ============================================================
// Actualizar botones de selección visualmente
// ============================================================
function actualizarBotones(sigla, seccionSeleccionada) {
    document.querySelectorAll(`.seleccionar-btn[data-sigla="${sigla}"]`).forEach(b => {
        b.disabled = b.dataset.seccion === seccionSeleccionada;
        b.innerHTML = b.disabled ? iconoTicket : iconoPlus;
    });
}

// ============================================================
// Inicializar todos los listeners de la aplicación
// ============================================================
function inicializarListeners() {
    // === Modales ===
    if (modalBtnCerrar) modalBtnCerrar.addEventListener('click', ocultarModal);
    if (modal) modal.addEventListener('click', e => e.target === modal && ocultarModal());
    if (confirmModalBtnCancelar) confirmModalBtnCancelar.addEventListener('click', ocultarModalConfirmacion);
    if (modalConfirm) modalConfirm.addEventListener('click', e => e.target === modalConfirm && ocultarModalConfirmacion());

    if (confirmModalBtnAceptar) {
        confirmModalBtnAceptar.addEventListener('click', () => {
            const callback = getConfirmCallback();
            if (callback) callback();
            ocultarModalConfirmacion();
            setConfirmCallback(null);
        });
    }

    // === Botones Seleccionar Asignatura ===
    const botonesSeleccionar = document.querySelectorAll('.seleccionar-btn');
    botonesSeleccionar.forEach(btn => {
        const { sigla, seccion } = btn.dataset;
        if (hasAsignaturaSeleccionada(sigla) && getAsignaturaSeleccionada(sigla).seccion === seccion) {
            btn.disabled = true;
            btn.innerHTML = iconoTicket;
        }
        btn.addEventListener('click', () => seleccionarAsignatura(btn));
    });

    // === Botones Exportar ===
    const btnIcs = document.querySelector('button[class*="bg-green-600"]');
    if (btnIcs && btnIcs.textContent.includes('Google Calendar')) {
        btnIcs.onclick = null;
        btnIcs.addEventListener('click', e => {
            e.preventDefault();
            exportarComoICS();
        });
    }

    const btnPdf = document.querySelector('button[class*="bg-blue-600"]');
    if (btnPdf && btnPdf.textContent.includes('PDF')) {
        btnPdf.onclick = null;
        btnPdf.addEventListener('click', e => {
            e.preventDefault();
            exportarComoPDF();
        });
    }

    // === Quitar Asignatura (delegación) ===
    const horarioDiv = document.getElementById('horario');
    if (horarioDiv) {
        horarioDiv.addEventListener('click', e => {
            const botonQuitar = e.target.closest('button[data-accion="quitar-asignatura"]');
            if (botonQuitar) {
                quitarAsignatura(botonQuitar.dataset.sigla);
            }
        });
    }

    // === Guardar Horario ===
    const btnGuardarHorario = document.getElementById('btn-guardar-horario');
    if (btnGuardarHorario) {
        btnGuardarHorario.addEventListener('click', e => {
            e.preventDefault();
            guardarHorarioActual();
        });
    }
}

// ============================================================
// Inicialización principal al cargar el DOM
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    actualizarHorario();
    inicializarListeners();

    const contenedorHorarios = document.getElementById('horarios-guardados-container');
    if (contenedorHorarios) {
        cargarListaHorariosGuardados();
    }
});
