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

// ============================================================
// Funciones principales
// ============================================================

function quitarAsignatura(sigla) {
    // Obtenemos los datos ANTES de eliminar para el toast
    const asignaturaEliminada = getAsignaturaSeleccionada(sigla);

    removeSeleccionada(sigla);
    actualizarHorario();

    document.querySelectorAll(`.seleccionar-btn[data-sigla="${sigla}"]`).forEach(btn => {
        btn.disabled = false;
        btn.innerHTML = iconoPlus;
    });

    // Mostramos el toast
    if (asignaturaEliminada) {
        mostrarNotificacion(
            `${asignaturaEliminada.nombre} (${asignaturaEliminada.seccion}) eliminada`, 
            'info' 
        );
    }
}

function seleccionarAsignatura(btn) {
    const { sigla, seccion, nombre, id, virtual, docente } = btn.dataset;
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
        virtual: ['true', 'sí'].includes((virtual || '').toLowerCase()),
        docente : docente
    };

    if (hasAsignaturaSeleccionada(sigla)) {
        const actual = getAsignaturaSeleccionada(sigla);
        setConfirmCallback(() => {
            addSeleccionada(sigla, asignaturaData);
            actualizarHorario();
            actualizarBotones(sigla, seccion);
            
            // Toast de reemplazo
            mostrarNotificacion(
                `${nombre} (Sec. ${seccion}) agregada`, 
                'success'
            );
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

    // Toast de nueva asignatura
    mostrarNotificacion(
        `${nombre} (Sec. ${seccion}) agregada`, 
        'success'
    );
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

    // === Acciones en Asignaturas Seleccionadas (delegación) ===
    // (Esta sección usa el ID del contenedor definido en lista_asignaturas.html)
    const seleccionadasDiv = document.getElementById('seleccionadas-container'); 
    if (seleccionadasDiv) {
        seleccionadasDiv.addEventListener('click', e => {
            // Quitar asignatura
            const botonQuitar = e.target.closest('button[data-accion="quitar-asignatura"]');
            if (botonQuitar) {
                quitarAsignatura(botonQuitar.dataset.sigla);
                return;
            }

            // Ver/Ocultar detalles de horarios
            const botonDetalles = e.target.closest('button[data-accion="ver-detalles-asignatura"]');
            if (botonDetalles) {
                const sigla = botonDetalles.dataset.sigla;
                // Buscamos el div de detalles DENTRO del contenedor de seleccionadas
                const detalleDiv = seleccionadasDiv.querySelector(`.detalle-horarios[data-sigla="${sigla}"]`);
                
                if (detalleDiv) {
                    const estaOculto = detalleDiv.classList.contains('hidden');
                    detalleDiv.classList.toggle('hidden');
                    
                    // Cambiar icono del botón
                    const svg = botonDetalles.querySelector('svg');
                    if (svg) {
                        if (estaOculto) {
                            // Mostrar icono de ojo cerrado (ocultar)
                            svg.innerHTML = `
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            `;
                            botonDetalles.title = 'Ocultar horarios';
                        } else {
                            // Mostrar icono de ojo (ver)
                            svg.innerHTML = `
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            `;
                            botonDetalles.title = 'Ver horarios';
                        }
                    }
                }
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

// Exportar para uso desde generadorModal.js
export { actualizarHorario };