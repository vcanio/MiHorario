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

function generarHTMLSeleccionadas() {
    const seleccionadas = getSeleccionadas();
    const items = Object.entries(seleccionadas).map(([sigla, datos]) => `
        <li class="flex justify-between items-center px-4 py-3 bg-gray-800 rounded-lg mb-2 hover:bg-gray-700 transition-colors shadow-sm">
            <div class="flex flex-col">
                <span class="font-medium text-white">${datos.nombre} (${datos.seccion})</span>
                ${datos.virtual ? '<span class="text-green-400 text-sm mt-1">Virtual sincrónica</span>' : ''}
            </div>
            <button data-accion="quitar-asignatura" data-sigla="${sigla}" 
                    class="p-2 text-red-500 hover:text-red-400 rounded-full transition-colors"
                    title="Quitar asignatura">
                ${iconoEquis}
            </button>
        </li>
    `).join('');

    return `
        <h5 class="text-xl font-semibold mb-4 text-white">Asignaturas seleccionadas</h5>
        <ul class="bg-gray-900 p-4 rounded-2xl border border-gray-700 shadow-inner overflow-hidden" id="lista-seleccionadas">
            ${items || `<li class="px-4 py-3 text-gray-400 text-center">No hay asignaturas seleccionadas</li>`}
        </ul>
    `;
}


function generarHTMLHorario(horarioBase) {
    const horas = generarHoras('08:30', '23:00');
    const rowHeightPx = 50;

    return `
        <div class="mb-6">${generarHTMLSeleccionadas()}</div>
        <div class="mb-4">
            <h5 class="text-xl font-semibold mb-2">Horario semanal</h5>
            <div class="relative overflow-x-auto max-h-[500px] overflow-y-auto border border-gray-700 rounded-lg shadow" id="horario-container">
                <table class="min-w-full text-sm text-white border-separate border-spacing-0">
                    <thead class="bg-gray-800 text-xs uppercase text-gray-400 sticky top-0 z-10">
                        <tr>
                            <th class="px-4 py-2 sticky left-0 bg-gray-800 z-20 w-20">Hora</th>
                            ${dias.map(d => `<th class="px-4 py-2 text-center"><div class="min-w-[120px]">${d}</div></th>`).join('')}
                        </tr>
                    </thead>
                    <tbody class="bg-gray-900">
                        ${horas.map(h => `
                            <tr>
                                <td class="h-[${rowHeightPx}px] px-4 py-2 border-r border-gray-700 sticky left-0 bg-gray-900 z-10 align-top">
                                    ${h || '<div class="h-full border-t border-gray-700 border-dotted"></div>'}
                                </td>
                                ${dias.map(() => `<td class="h-[${rowHeightPx}px] border-l border-b border-gray-700"></td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="absolute inset-0 pointer-events-none" id="class-overlay"></div>
            </div>
        </div>
    `;
}

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
