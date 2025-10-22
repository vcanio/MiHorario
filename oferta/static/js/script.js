// === CONSTANTES ===
const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const diasLargos = {
    'Lu': 'Lunes', 'Ma': 'Martes', 'Mi': 'Miércoles',
    'Ju': 'Jueves', 'Vi': 'Viernes', 'Sa': 'Sábado',
    'Lunes': 'Lunes', 'Martes': 'Martes', 'Miércoles': 'Miércoles',
    'Jueves': 'Jueves', 'Viernes': 'Viernes', 'Sábado': 'Sábado',
};

const colores = [
    'bg-red-500', 'bg-amber-500', 'bg-green-500', 'bg-emerald-500',
    'bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500',
    'bg-violet-500', 'bg-pink-500'
];

const iconoPlus = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>`;

const iconoTicket = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>`;

const iconoEquis = `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
</svg>
`;

// === REFERENCIAS A LOS MODALES ===

// Modal de Alerta/Solapamiento
const modal = document.getElementById('modal-solapamiento');
const modalTitulo = document.getElementById('modal-titulo');
const modalMensaje = document.getElementById('modal-mensaje');
const modalBtnCerrar = document.getElementById('modal-btn-cerrar');

// Modal de Confirmación
const modalConfirm = document.getElementById('modal-confirmacion');
const confirmModalTitulo = document.getElementById('confirm-modal-titulo');
const confirmModalMensaje = document.getElementById('confirm-modal-mensaje');
const confirmModalBtnCancelar = document.getElementById('confirm-modal-btn-cancelar');
const confirmModalBtnAceptar = document.getElementById('confirm-modal-btn-aceptar');

// === ESTADO ===
let seleccionadas = JSON.parse(localStorage.getItem('seleccionadas')) || {};
let asignaciones = {};
let indiceActual = 0;
// Variable para guardar la acción a ejecutar (callback)
let confirmCallback = null;

// === UTILIDADES ===

// --- Funciones del Modal de Alerta ---
function mostrarModal(titulo, mensaje) {
    if (modalTitulo) modalTitulo.textContent = titulo;
    if (modalMensaje) modalMensaje.textContent = mensaje;
    if (modal) modal.classList.remove('hidden');
}

function ocultarModal() {
    if (modal) modal.classList.add('hidden');
}

// --- Funciones del Modal de Confirmación ---
function mostrarModalConfirmacion(titulo, mensaje, callback) {
    if (confirmModalTitulo) confirmModalTitulo.textContent = titulo;
    if (confirmModalMensaje) confirmModalMensaje.textContent = mensaje;
    confirmCallback = callback; // Guardamos la acción a ejecutar
    if (modalConfirm) modalConfirm.classList.remove('hidden');
}

function ocultarModalConfirmacion() {
    if (modalConfirm) modalConfirm.classList.add('hidden');
    confirmCallback = null; // Limpiamos la acción
}

// --- Otras Utilidades ---
function guardarEnLocalStorage() {
    localStorage.setItem('seleccionadas', JSON.stringify(seleccionadas));
}

function colorDeFondo(sigla) {
    if (!asignaciones[sigla]) {
        asignaciones[sigla] = colores[indiceActual++ % colores.length];
    }
    return asignaciones[sigla];
}

function parseTime(hora) {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
}

function generarHoras(inicio, fin) {
    const resultado = [];
    let [h, m] = inicio.split(':').map(Number);
    const [fh, fm] = fin.split(':').map(Number);

    while (h < fh || (h === fh && m < fm)) {
        resultado.push(m === 0 ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` : '');
        m += 30;
        if (m >= 60) { h += 1; m = 0; }
    }
    return resultado;
}

function haySolapamiento(nuevosHorarios) {
    for (const [sigla, { horarios, seccion, nombre }] of Object.entries(seleccionadas)) {
        for (const existente of horarios) {
            for (const nuevo of nuevosHorarios) {
                if (
                    nuevo.dia === existente.dia &&
                    parseTime(nuevo.inicio) < parseTime(existente.fin) &&
                    parseTime(nuevo.fin) > parseTime(existente.inicio)
                ) {
                    return { sigla, seccion, nombre };
                }
            }
        }
    }
    return null;
}

// === RENDER ===

function actualizarHorario() {
    const horarioBase = Object.fromEntries(dias.map(d => [d, []]));

    for (const sigla in seleccionadas) {
        const { nombre, seccion, horarios, virtual } = seleccionadas[sigla];
        horarios.forEach(h => {
            horarioBase[h.dia]?.push({ sigla, nombre: `${nombre} (${seccion})`, ...h, virtual });
        });
    }

    document.getElementById('horario').innerHTML = generarHTMLHorario(horarioBase);
    renderClases(horarioBase);
}

function generarHTMLHorario(horarioBase) {
    const horas = generarHoras('08:30', '23:00');
    const rowHeightPx = 50;

    let html = `
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
                    ${horas.map(h =>
                        `<tr>
                            <td class="h-[${rowHeightPx}px] px-4 py-2 border-r border-gray-700 sticky left-0 bg-gray-900 z-10 align-top">
                                ${h || '<div class="h-full border-t border-gray-700 border-dotted"></div>'}
                            </td>
                            ${dias.map(() => `<td class="h-[${rowHeightPx}px] border-l border-b border-gray-700"></td>`).join('')}
                        </tr>`).join('')}
                </tbody>
            </table>
            <div class="absolute inset-0 pointer-events-none" id="class-overlay"></div>
        </div>
    </div>`;
    return html;
}

function generarHTMLSeleccionadas() {
    const items = Object.entries(seleccionadas).map(([sigla, datos]) => `
        <li class="flex justify-between items-center px-4 py-3 bg-gray-800 hover:bg-gray-700">
            <span>${datos.nombre} (${datos.seccion})${datos.virtual ? ' <span class="text-green-400">(virtual sincrónica)</span>' : ''}</span>
            <button onclick="quitarAsignatura('${sigla}')" class="p-1 text-red-500 hover:text-red-400" title="Quitar asignatura">
                ${iconoEquis}
            </button>
        </li>`).join('');

    return `
        <h5 class="text-xl font-semibold mb-2">Asignaturas seleccionadas</h5>
        <ul class="divide-y divide-gray-700 rounded border border-gray-700 overflow-hidden">
            ${items || `<li class="px-4 py-3 text-gray-400 bg-gray-800">No hay asignaturas seleccionadas</li>`}
        </ul>`;
}

function renderClases(horarioBase) {
    setTimeout(() => {
        const overlay = document.getElementById('class-overlay');
        if (!overlay) return; // Añadido chequeo de seguridad
        overlay.innerHTML = '';

        const table = document.querySelector('#horario-container table');
        if (!table) return; // Añadido chequeo de seguridad
        
        const timeHeader = table.querySelector('th:first-child');
        const dayHeaders = table.querySelectorAll('thead th:not(:first-child)');

        if (!timeHeader || dayHeaders.length === 0) return; // Añadido chequeo de seguridad

        const baseTop = timeHeader.offsetHeight;
        const baseLeft = timeHeader.offsetWidth;
        const pxPorMin = 50 / 30;
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
                            <div class="font-semibold">${materia.nombre}${materia.virtual ? ' <span class="text-green-300">(virtual sincrónica)</span>' : ''}</div>
                            <div class="text-[11px] text-gray-200">${materia.inicio} - ${materia.fin}</div>
                        </div>`);
                });

                left += colW;
            }
        });
    }, 0);
}

// === EVENTOS ===

// --- Listeners del Modal de Alerta ---
if (modalBtnCerrar) {
    modalBtnCerrar.addEventListener('click', ocultarModal);
}
if (modal) {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            ocultarModal();
        }
    });
}

// --- Listeners del Modal de Confirmación ---
if (confirmModalBtnCancelar) {
    confirmModalBtnCancelar.addEventListener('click', ocultarModalConfirmacion);
}
if (modalConfirm) {
    modalConfirm.addEventListener('click', (e) => {
        if (e.target === modalConfirm) {
            ocultarModalConfirmacion();
        }
    });
}
if (confirmModalBtnAceptar) {
    confirmModalBtnAceptar.addEventListener('click', () => {
        if (confirmCallback) {
            confirmCallback(); // Ejecutamos la acción guardada
        }
        ocultarModalConfirmacion(); // Cerramos el modal
    });
}


// --- Otros Eventos ---
function quitarAsignatura(sigla) {
    delete seleccionadas[sigla];
    guardarEnLocalStorage();
    actualizarHorario();
    document.querySelectorAll(`.seleccionar-btn[data-sigla="${sigla}"]`).forEach(btn => {
        btn.disabled = false;
        btn.innerHTML = iconoPlus;
    });
}

document.querySelectorAll('.seleccionar-btn').forEach(btn => {
    const sigla = btn.dataset.sigla;
    const seccion = btn.dataset.seccion;

    if (seleccionadas[sigla]?.seccion === seccion) {
        btn.disabled = true;
        btn.innerHTML = iconoTicket;
    }

    btn.addEventListener('click', () => {
        const nombre = btn.dataset.nombre;
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

        const solapado = haySolapamiento(horarios);
        if (solapado) {
            // *** ¡CAMBIO 1! ***
            // Usamos el modal de alerta en lugar de alert()
            mostrarModal(
                'Conflicto de Horario',
                `No puedes seleccionar esta sección porque se solapa con ${solapado.nombre} (${solapado.seccion}).`
            );
            return;
        }

        // *** ¡CAMBIO 2! ***
        // Usamos el modal de confirmación en lugar de confirm()
        if (seleccionadas[sigla]) {
            mostrarModalConfirmacion(
                'Confirmar Reemplazo',
                `Ya tienes seleccionada la sección ${seleccionadas[sigla].seccion} para ${nombre}. ¿Deseas reemplazarla por la sección ${seccion}?`,
                () => {
                    // Esta función (callback) se ejecuta si el usuario presiona "Reemplazar"
                    quitarAsignatura(sigla);
                    
                    // Movemos la lógica de añadir la nueva asignatura aquí dentro
                    seleccionadas[sigla] = {
                        id: btn.dataset.id,
                        nombre,
                        seccion,
                        horarios,
                        virtual: ['true', 'sí'].includes((btn.dataset.virtual || '').toLowerCase())
                    };

                    guardarEnLocalStorage();
                    actualizarHorario();

                    // Actualizamos los botones
                    document.querySelectorAll(`.seleccionar-btn[data-sigla="${sigla}"]`).forEach(b => {
                        b.disabled = b.dataset.seccion === seccion;
                        b.innerHTML = b.disabled ? iconoTicket : iconoPlus;
                    });
                }
            );
            
            // Detenemos la ejecución aquí; la lógica continúa (o no) en el callback
            return;
        }

        // Esta parte solo se ejecuta si no había una asignatura previa (flujo normal)
        seleccionadas[sigla] = {
            id: btn.dataset.id,
            nombre,
            seccion,
            horarios,
            virtual: ['true', 'sí'].includes((btn.dataset.virtual || '').toLowerCase())
        };

        guardarEnLocalStorage();
        actualizarHorario();

        document.querySelectorAll(`.seleccionar-btn[data-sigla="${sigla}"]`).forEach(b => {
            b.disabled = b.dataset.seccion === seccion;
            b.innerHTML = b.disabled ? iconoTicket : iconoPlus;
        });
    });
});

function exportarComoICS() {
    let contenido = `BEGIN:VCALENDAR\nVERSION:2.0\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n`;

    for (const [sigla, datos] of Object.entries(seleccionadas)) {
        for (const h of datos.horarios) {
            const fechaInicio = obtenerProximoDia(h.dia, h.inicio);
            const fechaFin = obtenerProximoDia(h.dia, h.fin);

            contenido += `BEGIN:VEVENT\n`;
            contenido += `SUMMARY:${datos.nombre} (${datos.seccion})\n`;
            contenido += `DTSTART:${formatearICSDate(fechaInicio)}\n`;
            contenido += `DTEND:${formatearICSDate(fechaFin)}\n`;
            contenido += `RRULE:FREQ=WEEKLY\n`;
            contenido += `DESCRIPTION:${datos.virtual ? 'Clase virtual sincrónica' : 'Clase presencial'}\n`;
            contenido += `END:VEVENT\n`;
        }
    }

    contenido += `END:VCALENDAR`;

    const blob = new Blob([contenido], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'horario.ics';
    link.click();
}

function obtenerProximoDia(diaNombre, hora) {
    const diasMap = {
        'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6
    };

    const hoy = new Date();
    const hoyDia = hoy.getDay(); // 0 (domingo) a 6 (sábado)
    let objetivo = diasMap[diaNombre];

    if (objetivo === undefined) return hoy;

    const diferencia = (objetivo - hoyDia + 7) % 7 || 7;
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + diferencia);

    const [h, m] = hora.split(':').map(Number);
    fecha.setHours(h, m, 0, 0);

    return fecha;
}

function formatearICSDate(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

async function exportarComoPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');

    // --- 1. Configuración de Módulos ---
    const DUOC_MODULOS = [
        { inicio: '08:31', fin: '09:10' },
        { inicio: '09:11', fin: '09:50' },
        { inicio: '10:01', fin: '10:40' },
        { inicio: '10:41', fin: '11:20' },
        { inicio: '11:31', fin: '12:10' },
        { inicio: '12:11', fin: '12:50' },
        { inicio: '13:01', fin: '13:40' },
        { inicio: '13:41', fin: '14:20' },
        { inicio: '14:31', fin: '15:10' },
        { inicio: '15:11', fin: '15:50' },
        { inicio: '16:01', fin: '16:40' },
        { inicio: '16:41', fin: '17:20' },
        { inicio: '17:31', fin: '18:10' },
    ];

    // --- 2. Geometría ---
    const MARGIN_LEFT = 10;
    const MARGIN_TOP = 15;
    const MARGIN_RIGHT = 10;
    const MARGIN_BOTTOM = 10;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;

    const DIAS_SEMANA = dias; // ['Lunes', 'Martes', ...]
    const HORA_COL_WIDTH = 25;
    const DIA_COL_WIDTH = (contentWidth - HORA_COL_WIDTH) / DIAS_SEMANA.length;
    const ROW_HEADER_HEIGHT = 10;
    const ROW_MODULE_HEIGHT = 15;

    let y = MARGIN_TOP;

    // --- 3. Encabezado ---
    pdf.setFontSize(16).setFont(undefined, 'bold');
    pdf.text("Duoc UC", MARGIN_LEFT, y);

    const urlParams = new URLSearchParams(window.location.search);
    const sede = urlParams.get('sede');
    const carrera = document.getElementById('carrera') ? document.getElementById('carrera').value : '';

    pdf.setFontSize(10).setFont(undefined, 'normal');
    if (sede) {
        y += 6;
        pdf.text(`SEDE: ${sede.toUpperCase()}`, MARGIN_LEFT, y);
    }
    if (carrera) {
        y += 5;
        pdf.text(`CARRERA: ${carrera.toUpperCase()}`, MARGIN_LEFT, y);
    }

    y += 8;
    pdf.setFontSize(12).setFont(undefined, 'bold');
    pdf.text("Horario Personal (MiHorario)", pageWidth / 2, y, { align: 'center' });
    y += 10;

    // --- 4. Función Auxiliar ---
    function findAsignaturaInModulo(dia, inicio, fin) {
        const modStart = parseTime(inicio);
        const modEnd = parseTime(fin);

        for (const [sigla, datos] of Object.entries(seleccionadas)) {
            for (const h of datos.horarios) {
                if (h.dia !== dia) continue;
                const asigStart = parseTime(h.inicio);
                const asigEnd = parseTime(h.fin);
                if (asigStart <= modStart && asigEnd >= modEnd) {
                    return { ...datos, sigla };
                }
            }
        }
        return null;
    }

    // --- 5. Función para dibujar encabezado de tabla ---
    function drawTableHeader(yPos) {
        let x = MARGIN_LEFT;
        pdf.setFontSize(9).setFont(undefined, 'bold');
        pdf.setDrawColor(100, 100, 100);
        pdf.setFillColor(230, 230, 230);

        pdf.rect(x, yPos, HORA_COL_WIDTH, ROW_HEADER_HEIGHT, 'FD');
        pdf.text("Hora", x + HORA_COL_WIDTH / 2, yPos + ROW_HEADER_HEIGHT / 2 + 2, { align: 'center' });
        x += HORA_COL_WIDTH;

        for (const dia of DIAS_SEMANA) {
            pdf.setFillColor(230, 230, 230);
            pdf.rect(x, yPos, DIA_COL_WIDTH, ROW_HEADER_HEIGHT, 'FD');

            pdf.setTextColor(0, 0, 0); // 🔹 importante
            pdf.text(dia, x + DIA_COL_WIDTH / 2, yPos + ROW_HEADER_HEIGHT / 2 + 2, { align: 'center' });
            x += DIA_COL_WIDTH;
        }

        return yPos + ROW_HEADER_HEIGHT;
    }

    y = drawTableHeader(y);

    // --- 6. Celdas ---
    for (const modulo of DUOC_MODULOS) {
        let x = MARGIN_LEFT;

        // Columna Hora
        pdf.setFontSize(8).setFont(undefined, 'normal');
        pdf.rect(x, y, HORA_COL_WIDTH, ROW_MODULE_HEIGHT);
        pdf.text(`${modulo.inicio}\n${modulo.fin}`, x + HORA_COL_WIDTH / 2, y + 6, { align: 'center' });
        x += HORA_COL_WIDTH;

        // Días
        for (const dia of DIAS_SEMANA) {
            pdf.rect(x, y, DIA_COL_WIDTH, ROW_MODULE_HEIGHT);
            const asignatura = findAsignaturaInModulo(dia, modulo.inicio, modulo.fin);

            if (asignatura) {
                pdf.setFontSize(7);
                pdf.setFont(undefined, 'bold');

                // Texto apilado con ajuste dinámico
                const nombre = pdf.splitTextToSize(asignatura.nombre, DIA_COL_WIDTH - 4);
                let texto = [...nombre, `${asignatura.seccion}`];

                // Si el texto es muy largo, reducir fuente
                if (texto.length * 3 > ROW_MODULE_HEIGHT) pdf.setFontSize(6);

                const textY = y + 5;
                pdf.text(texto, x + DIA_COL_WIDTH / 2, textY, { align: 'center', lineHeightFactor: 1.1 });
            }

            x += DIA_COL_WIDTH;
        }

        y += ROW_MODULE_HEIGHT;

        // Control de salto de página
        if (y + ROW_MODULE_HEIGHT > pageHeight - MARGIN_BOTTOM) {
            pdf.addPage();
            y = MARGIN_TOP;
            y = drawTableHeader(y);
        }
    }

    // --- 7. Pie ---
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    const fechaGeneracion = new Date().toLocaleString('es-CL');
    pdf.text(`Generado por MiHorario el ${fechaGeneracion}`, MARGIN_LEFT, pageHeight - 8);
    pdf.text(`Página 1 de 1`, pageWidth - MARGIN_RIGHT, pageHeight - 8, { align: 'right' });

    // --- 8. Guardar ---
    pdf.save("horario_estilo_duoc.pdf");
}


// Inicializar
actualizarHorario();