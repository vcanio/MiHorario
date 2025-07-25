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

const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
let seleccionadas = JSON.parse(localStorage.getItem('seleccionadas')) || {};
let asignaciones = {};
let indiceActual = 0;

function guardarEnLocalStorage() {
    localStorage.setItem('seleccionadas', JSON.stringify(seleccionadas));
}

function colorDeFondo(sigla) {
    if (!asignaciones[sigla]) {
        asignaciones[sigla] = colores[indiceActual++ % colores.length];
    }
    return asignaciones[sigla];
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
    return Object.values(seleccionadas).some(({ horarios }) =>
        horarios.some(existente =>
            nuevosHorarios.some(nuevo =>
                nuevo.dia === existente.dia &&
                parseTime(nuevo.inicio) < parseTime(existente.fin) &&
                parseTime(nuevo.fin) > parseTime(existente.inicio)
            )
        )
    );
}

function parseTime(hora) {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
}

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
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
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

const iconoPlus = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
    `;

const iconoTicket = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
    <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
    `;

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
            horarios = JSON.parse(btn.dataset.horarios.replace(/&quot;/g,'"')).map(h => ({
                dia: diasLargos[h.dia] || h.dia,
                inicio: h.inicio,
                fin: h.fin
            }));
        } catch (e) {
            console.error("Error leyendo horarios", e);
            alert("Error al procesar los horarios.");
            return;
        }

        if (seleccionadas[sigla]) {
            const confirmar = confirm(`Ya seleccionaste la sección ${seleccionadas[sigla].seccion} para ${nombre}.\n¿Cambiar por ${seccion}?`);
            if (!confirmar) return;
            quitarAsignatura(sigla);
        }

        if (haySolapamiento(horarios)) {
            alert("Esta sección se solapa con otra.");
            return;
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
            if (b.disabled) {
                b.innerHTML = iconoTicket;
            } else {
                b.innerHTML = iconoPlus;
            }
        });
    });
});

actualizarHorario();
