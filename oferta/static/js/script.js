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

// === ESTADO ===
let seleccionadas = JSON.parse(localStorage.getItem('seleccionadas')) || {};
let asignaciones = {};
let indiceActual = 0;

// === UTILIDADES ===

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

const iconoEquis = `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
</svg>
`;

function renderClases(horarioBase) {
    setTimeout(() => {
        const overlay = document.getElementById('class-overlay');
        overlay.innerHTML = '';

        const table = document.querySelector('#horario-container table');
        const timeHeader = table.querySelector('th:first-child');
        const dayHeaders = table.querySelectorAll('thead th:not(:first-child)');

        const baseTop = timeHeader.offsetHeight;
        const baseLeft = timeHeader.offsetWidth;
        const pxPorMin = 50 / 30;
        const startMin = parseTime('08:30');

        let left = baseLeft;

        dias.forEach((dia, i) => {
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
        });
    }, 0);
}

// === EVENTOS ===

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
            alert("Error al procesar los horarios.");
            return;
        }

        const solapado = haySolapamiento(horarios);
        if (solapado) {
            alert(`No puedes seleccionar esta sección porque se solapa con ${solapado.nombre} (${solapado.seccion}).`);
            return;
        }

        if (seleccionadas[sigla]) {
            const confirmar = confirm(`Ya seleccionaste la sección ${seleccionadas[sigla].seccion} para ${nombre}.\n¿Cambiar por ${seccion}?`);
            if (!confirmar) return;
            quitarAsignatura(sigla);
        }

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

    // 1. Encabezado y asignaturas
    pdf.setFontSize(18);
    pdf.text("Horario semanal", 105, 15, { align: 'center' });

    pdf.setFontSize(12);
    let y = 25;
    if (Object.keys(seleccionadas).length > 0) {
        for (const [sigla, datos] of Object.entries(seleccionadas)) {
            pdf.text(`• ${datos.nombre} (${datos.seccion})${datos.virtual ? " [Virtual]" : ""}`, 10, y);
            y += 6;
        }
    } else {
        pdf.text("No hay asignaturas seleccionadas", 10, y);
        y += 6;
    }

    y += 4;

    // 2. Clonar el horario para quitar scroll y capturarlo completo
    const original = document.getElementById('horario-container');
    if (!original) {
        alert("No se encontró el horario para exportar.");
        return;
    }

    const clone = original.cloneNode(true);
    clone.style.maxHeight = 'none'; // sin límite
    clone.style.overflow = 'visible';
    clone.style.height = 'auto';
    clone.id = 'horario-clone';

    // Insertar fuera de pantalla para no alterar la vista
    const tempWrapper = document.createElement('div');
    tempWrapper.style.position = 'absolute';
    tempWrapper.style.top = '-9999px';
    tempWrapper.appendChild(clone);
    document.body.appendChild(tempWrapper);

    // 3. Capturar la tabla completa
    const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true
    });

    // Eliminar el clon temporal
    document.body.removeChild(tempWrapper);

    // 4. Pasar imagen al PDF
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 190; // mm
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = y;

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - position);

    while (heightLeft > 0) {
        pdf.addPage();
        position = 10;
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
    }

    // 5. Descargar
    pdf.save("horario.pdf");
}


// Inicializar
actualizarHorario();
