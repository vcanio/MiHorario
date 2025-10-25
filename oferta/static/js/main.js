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
    getSeleccionadas, 
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
    actualizarHorario,
    getCsrfToken, 
    mostrarNotificacion 
} from './ui.js';
import { exportarComoICS, exportarComoPDF } from './exporters.js';
// Importamos las funciones que MUESTRAN los modales
import { guardarHorarioActual, cargarListaHorariosGuardados } from './savedSchedules.js';

window.exportarComoICS = exportarComoICS;
window.exportarComoPDF = exportarComoPDF;

console.log('main.js cargado correctamente');

// ... (Las funciones quitarAsignatura, seleccionarAsignatura, actualizarBotones no cambian) ...

function quitarAsignatura(sigla) {
    removeSeleccionada(sigla);
    actualizarHorario();

    document.querySelectorAll(`.seleccionar-btn[data-sigla="${sigla}"]`).forEach(btn => {
        btn.disabled = false;
        btn.innerHTML = iconoPlus;
    });
}

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
    // === Modales (Solapamiento y Confirmación) ===
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

    // === Guardar Horario (Botón principal) ===
    const btnGuardarHorario = document.getElementById('btn-guardar-horario');
    if (btnGuardarHorario) {
        btnGuardarHorario.addEventListener('click', e => {
            e.preventDefault();
            guardarHorarioActual(); // <-- Esto ahora muestra el modal
        });
    }
    
    // === Listeners para Modal Guardar (Lógica Fetch) ===
    const modalGuardar = document.getElementById('modal-guardar-horario');
    const btnGuardarAceptar = document.getElementById('guardar-modal-btn-aceptar');
    const btnGuardarCancelar = document.getElementById('guardar-modal-btn-cancelar');
    const inputNombre = document.getElementById('guardar-horario-nombre');
    const errorEl = document.getElementById('guardar-modal-error');

    function hideModalGuardar() {
        if (modalGuardar) modalGuardar.classList.add('hidden');
        if (errorEl) errorEl.classList.add('hidden');
    }

    if (btnGuardarCancelar) btnGuardarCancelar.addEventListener('click', hideModalGuardar);
    if (modalGuardar) modalGuardar.addEventListener('click', e => e.target === modalGuardar && hideModalGuardar());

    if (btnGuardarAceptar) {
        btnGuardarAceptar.addEventListener('click', async () => {
            const nombre = inputNombre.value.trim();
            if (!nombre) {
                errorEl.textContent = 'Por favor, introduce un nombre.';
                errorEl.classList.remove('hidden');
                return;
            }
            
            errorEl.classList.add('hidden');
            const seleccionadas = getSeleccionadas();
            const payload = {
                nombre: nombre,
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
                    hideModalGuardar();
                    mostrarNotificacion(data.mensaje, 'success');
                    await cargarListaHorariosGuardados();
                } else {
                    errorEl.textContent = data.error || 'Error desconocido al guardar';
                    errorEl.classList.remove('hidden');
                }
            } catch (error) {
                errorEl.textContent = 'Error de conexión con el servidor.';
                errorEl.classList.remove('hidden');
            }
        });
    }
    
    // === Listeners para Modal Eliminar (Lógica Fetch) ===
    const modalEliminar = document.getElementById('modal-eliminar-horario');
    const btnEliminarAceptar = document.getElementById('eliminar-modal-btn-aceptar');
    const btnEliminarCancelar = document.getElementById('eliminar-modal-btn-cancelar');

    function hideModalEliminar() {
        if (modalEliminar) modalEliminar.classList.add('hidden');
    }

    if (btnEliminarCancelar) btnEliminarCancelar.addEventListener('click', hideModalEliminar);
    if (modalEliminar) modalEliminar.addEventListener('click', e => e.target === modalEliminar && hideModalEliminar());

    if (btnEliminarAceptar) {
        btnEliminarAceptar.addEventListener('click', async (e) => {
            // Leemos el ID guardado en el botón por savedSchedules.js
            const horarioId = e.currentTarget.dataset.horarioId;
            if (!horarioId) {
                mostrarNotificacion('Error: No se encontró el ID del horario a eliminar', 'error');
                return;
            }

            try {
                const response = await fetch(`/api/horarios/eliminar/${horarioId}/`, {
                    method: 'DELETE',
                    headers: { 'X-CSRFToken': getCsrfToken() }
                });

                const data = await response.json();

                hideModalEliminar();

                if (response.ok) {
                    mostrarNotificacion(data.mensaje, 'success');
                    await cargarListaHorariosGuardados(); // Recarga la lista
                } else {
                    mostrarNotificacion(data.error || 'Error al eliminar', 'error');
                }
            } catch (error) {
                hideModalEliminar();
                mostrarNotificacion('Error de conexión', 'error');
            }
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