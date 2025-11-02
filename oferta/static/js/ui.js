import { dias, iconoEquis } from './constants.js';
import { getSeleccionadas } from './state.js';
import { colorDeFondo, parseTime, generarHoras } from './schedule.js';

// ================================
// Referencias a Modales (Exportadas para main.js)
// ================================
export const modal = document.getElementById('modal-solapamiento');
export const modalTitulo = document.getElementById('modal-titulo');
export const modalMensaje = document.getElementById('modal-mensaje');
export const modalBtnCerrar = document.getElementById('modal-btn-cerrar');

export const modalConfirm = document.getElementById('modal-confirmacion');
export const confirmModalTitulo = document.getElementById('confirm-modal-titulo');
export const confirmModalMensaje = document.getElementById('confirm-modal-mensaje');
export const confirmModalBtnCancelar = document.getElementById('confirm-modal-btn-cancelar');
export const confirmModalBtnAceptar = document.getElementById('confirm-modal-btn-aceptar');

// ================================
// Funciones de Modales
// ================================
export function mostrarModal(titulo, mensaje) {
    if (modalTitulo) modalTitulo.textContent = titulo;
    if (modalMensaje) modalMensaje.textContent = mensaje;
    if (modal) modal.classList.remove('hidden');
}

export function ocultarModal() {
    if (modal) modal.classList.add('hidden');
}

export function mostrarModalConfirmacion(titulo, mensaje) {
    if (confirmModalTitulo) confirmModalTitulo.textContent = titulo;
    if (confirmModalMensaje) confirmModalMensaje.textContent = mensaje;
    if (modalConfirm) modalConfirm.classList.remove('hidden');
    // El callback se maneja desde main.js con setConfirmCallback
}

export function ocultarModalConfirmacion() {
    if (modalConfirm) modalConfirm.classList.add('hidden');
}

// ================================
// Funciones de Renderizado
// ================================
function renderClases(horarioBase) {
    setTimeout(() => {
        const overlay = document.getElementById('class-overlay');
        if (!overlay) return;
        overlay.innerHTML = '';

        const table = document.querySelector('#horario-container table');
        if (!table) return;
        
        const timeHeader = table.querySelector('th:first-child');
        const dayHeaders = table.querySelectorAll('thead th:not(:first-child)');

        if (!timeHeader || dayHeaders.length === 0) return;

        const baseTop = timeHeader.offsetHeight;
        const baseLeft = timeHeader.offsetWidth;
        const pxPorMin = 50 / 30; // 50px por 30 minutos
        const startMin = parseTime('08:30');
        let left = baseLeft;

        dias.forEach((dia, i) => {
            if (dayHeaders[i]) {
                const colW = dayHeaders[i].offsetWidth;
                horarioBase[dia]?.forEach(materia => {
                    const top = (parseTime(materia.inicio) - startMin) * pxPorMin + baseTop;
                    const height = (parseTime(materia.fin) - parseTime(materia.inicio)) * pxPorMin;
                    const color = colorDeFondo(materia.sigla);

                    overlay.insertAdjacentHTML('beforeend', `
                        <div class="absolute ${color} text-white p-1 rounded text-xs leading-tight pointer-events-auto overflow-hidden"
                            style="top: ${top}px; left: ${left}px; width: ${colW}px; height: ${height}px;">
                            <div class="font-semibold">
                                ${materia.nombre}${materia.virtual ? ' <span class="text-green-300">(virtual sincrónica)</span>' : ''}
                            </div>
                            <div class="text-[11px] text-gray-200">${materia.inicio} - ${materia.fin}</div>
                        </div>
                    `);
                });
                left += colW;
            }
        });
    }, 0);
}

// ==================================================
//         FUNCIÓN: generarHTMLSeleccionadas (MODIFICADA)
// ==================================================
function generarHTMLSeleccionadas() {
    const seleccionadas = getSeleccionadas();
    const cantidad = Object.keys(seleccionadas).length;

    // Si no hay asignaturas seleccionadas (Sin cambios)
    if (cantidad === 0) {
        return `
            <div class="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 shadow-xl overflow-hidden">
                <div class="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-gray-700/50 p-5">
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Mis Asignaturas
                        </h3>
                        <span class="px-2.5 py-1 bg-gray-700/50 text-gray-400 text-xs font-medium rounded-full">
                            0
                        </span>
                    </div>
                </div>

                <div class="p-8 text-center">
                    <div class="inline-flex items-center justify-center w-16 h-16 bg-gray-800/50 rounded-full mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </div>
                    <p class="text-gray-400 text-sm">No has seleccionado ninguna asignatura</p>
                    <p class="text-gray-500 text-xs mt-1">Haz clic en "Agregar" para comenzar</p>
                </div>
            </div>
        `;
    }

    // Si hay asignaturas seleccionadas
    const items = Object.entries(seleccionadas).map(([sigla, datos]) => `
        <div class="group relative bg-gradient-to-br from-blue-600/10 to-purple-600/10 hover:from-blue-600/20 hover:to-purple-600/20 rounded-xl p-3 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-200">
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                    <span class="px-2.5 py-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold rounded-lg shadow-sm whitespace-nowrap">
                        ${datos.seccion}
                    </span>
                    
                    </div>

                <div class="flex items-center gap-1">
                    <button 
                        data-accion="ver-detalles-asignatura" 
                        data-sigla="${sigla}"
                        class="p-1.5 bg-gray-700/50 hover:bg-blue-600 text-gray-400 hover:text-white rounded-lg transition-all duration-200"
                        title="Ver horarios de ${datos.nombre}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>

                    <button 
                        data-accion="quitar-asignatura" 
                        data-sigla="${sigla}" 
                        class="p-1.5 bg-gray-700/50 hover:bg-red-600 text-gray-400 hover:text-white rounded-lg transition-all duration-200"
                        title="Eliminar ${datos.nombre}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <div class="detalle-horarios hidden mt-3 pt-3 border-t border-gray-700/30 space-y-2" data-sigla="${sigla}">
                
                <div class="text-sm font-semibold text-white">${datos.nombre}</div>
                
                ${(datos.docente && datos.docente.toLowerCase() !== 'nan') ? `
                    <div class="text-xs text-gray-400">${datos.docente}</div>
                ` : ''}

                ${datos.virtual ? `
                    <div class="text-xs text-green-400 font-medium pt-1">
                        Modalidad: Virtual Sincrónica
                    </div>
                ` : `
                    <div class="text-xs text-gray-400 font-medium pt-1">
                        Modalidad: Presencial
                    </div>
                `}
                
                <div class="pt-2"></div> 

                ${datos.horarios.map(h => `
                    <div class="flex items-center gap-2 text-xs">
                        <span class="px-2 py-0.5 bg-gray-700/50 text-gray-300 rounded font-medium min-w-[55px] text-center">
                            ${h.dia.slice(0, 3)}
                        </span>
                        <span class="text-gray-400">
                            ${h.inicio} - ${h.fin}
                        </span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    // HTML del contenedor (Sin cambios)
    return `
        <div class="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 shadow-xl overflow-hidden">
            <div class="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-gray-700/50 p-5">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        Mis Asignaturas
                    </h3>
                    <span class="px-3 py-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold rounded-full shadow-lg">
                        ${cantidad}
                    </span>
                </div>
            </div>

            <div class="p-4 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar" id="lista-seleccionadas">
                ${items}
            </div>
        </div>

        <style>
            .custom-scrollbar::-webkit-scrollbar {
                width: 8px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
                background: rgba(17, 24, 39, 0.5);
                border-radius: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
                background: rgba(59, 130, 246, 0.5);
                border-radius: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: rgba(59, 130, 246, 0.7);
            }
        </style>
    `;
}


// ==================================================
//         FUNCIÓN: generarHTMLHorario (Mejorado)
// ==================================================
function generarHTMLHorario(horarioBase) {
    const horas = generarHoras('08:30', '23:00');
    const rowHeightPx = 50;

    return `
        <div class="mb-6">
            <!-- Header del Horario -->
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-2xl font-bold text-white flex items-center gap-3">
                    <div class="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    Horario Semanal
                </h2>
            </div>

            <!-- Tabla del Horario -->
            <div class="relative overflow-x-auto max-h-[600px] overflow-y-auto border border-gray-700/50 rounded-2xl shadow-2xl bg-gray-900/50 backdrop-blur-sm" id="horario-container">
                <table class="min-w-full text-sm text-white border-separate border-spacing-0">
                    <thead class="bg-gradient-to-r from-gray-800 to-gray-900 text-xs uppercase text-gray-400 sticky top-0 z-10 shadow-lg">
                        <tr>
                            <th class="px-4 py-3 sticky left-0 bg-gradient-to-r from-gray-800 to-gray-900 z-20 w-20 border-r border-gray-700/50">
                                <div class="flex items-center justify-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Hora
                                </div>
                            </th>
                            ${dias.map(d => `
                                <th class="px-4 py-3 text-center border-l border-gray-700/30">
                                    <div class="min-w-[120px] font-semibold">${d}</div>
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody class="bg-gray-900/80">
                        ${horas.map((h, idx) => `
                            <tr class="hover:bg-gray-800/30 transition-colors">
                                <td class="h-[${rowHeightPx}px] px-4 py-2 border-r border-gray-700/50 sticky left-0 bg-gray-900/90 backdrop-blur-sm z-10 align-top font-medium text-gray-400">
                                    ${h || '<div class="h-full border-t border-gray-700/30 border-dotted"></div>'}
                                </td>
                                ${dias.map(() => `
                                    <td class="h-[${rowHeightPx}px] border-l border-b border-gray-700/20 ${idx % 2 === 0 ? 'bg-gray-800/10' : ''}"></td>
                                `).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="absolute inset-0 pointer-events-none" id="class-overlay"></div>
            </div>
        </div>
    `;
}

// ==================================================
//         FUNCIÓN: actualizarHorario
// ==================================================
export function actualizarHorario() {
    const seleccionadas = getSeleccionadas();
    const horarioBase = Object.fromEntries(dias.map(d => [d, []]));

    for (const sigla in seleccionadas) {
        const { nombre, seccion, horarios, virtual } = seleccionadas[sigla];
        horarios.forEach(h => {
            if (horarioBase[h.dia]) {
                horarioBase[h.dia].push({ sigla, nombre: `${nombre} (${seccion})`, ...h, virtual });
            }
        });
    }

    // 1. Actualiza el contenedor de asignaturas seleccionadas
    const seleccionadasContainer = document.getElementById('seleccionadas-container');
    if (seleccionadasContainer) {
        seleccionadasContainer.innerHTML = generarHTMLSeleccionadas();
    }

    // 2. Actualiza el contenedor del horario
    const horarioContainer = document.getElementById('horario');
    if (horarioContainer) {
        horarioContainer.innerHTML = generarHTMLHorario(horarioBase);
        renderClases(horarioBase);
    }
}

// ================================
// Funciones de Utilidad
// ================================

// Obtener token CSRF de Django
export function getCsrfToken() {
    const token =
        document.querySelector('[name=csrfmiddlewaretoken]')?.value ||
        document.querySelector('input[name="csrfmiddlewaretoken"]')?.value ||
        document.querySelector('meta[name="csrf-token"]')?.content ||
        '';
    return token;
}

// Sistema de notificaciones
export function mostrarNotificacion(mensaje, tipo = 'info') {
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
    const container = document.createElement('div');
    container.id = 'notificaciones-container';
    container.className = 'fixed top-4 right-4 z-50 space-y-2';
    document.body.appendChild(container);
    return container;
}