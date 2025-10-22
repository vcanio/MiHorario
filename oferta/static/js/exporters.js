import { getSeleccionadas } from './state.js';
import { dias } from './constants.js';
import { parseTime } from './schedule.js';

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

export function exportarComoICS() {
    let contenido = `BEGIN:VCALENDAR\nVERSION:2.0\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n`;
    const seleccionadas = getSeleccionadas();

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

export async function exportarComoPDF() {
    // Verificar que jspdf y html2canvas están cargados
    if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
        console.error('jsPDF o html2canvas no están cargados.');
        alert('Error al exportar PDF: librerías no encontradas.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const seleccionadas = getSeleccionadas();

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
    const carreraEl = document.getElementById('carrera');
    const carrera = carreraEl ? carreraEl.value : '';

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
        pdf.setTextColor(0, 0, 0);

        pdf.rect(x, yPos, HORA_COL_WIDTH, ROW_HEADER_HEIGHT, 'FD');
        pdf.text("Hora", x + HORA_COL_WIDTH / 2, yPos + ROW_HEADER_HEIGHT / 2 + 2, { align: 'center' });
        x += HORA_COL_WIDTH;

        for (const dia of DIAS_SEMANA) {
            pdf.setFillColor(230, 230, 230);
            pdf.rect(x, yPos, DIA_COL_WIDTH, ROW_HEADER_HEIGHT, 'FD');
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
        pdf.setTextColor(0, 0, 0);
        pdf.rect(x, y, HORA_COL_WIDTH, ROW_MODULE_HEIGHT, 'D');
        pdf.text(`${modulo.inicio}\n${modulo.fin}`, x + HORA_COL_WIDTH / 2, y + 6, { align: 'center' });
        x += HORA_COL_WIDTH;

        // Días
        for (const dia of DIAS_SEMANA) {
            pdf.rect(x, y, DIA_COL_WIDTH, ROW_MODULE_HEIGHT, 'D');
            const asignatura = findAsignaturaInModulo(dia, modulo.inicio, modulo.fin);

            if (asignatura) {
                pdf.setFontSize(7);
                pdf.setFont(undefined, 'bold');
                pdf.setTextColor(0, 0, 0);

                const nombre = pdf.splitTextToSize(asignatura.nombre, DIA_COL_WIDTH - 4);
                let texto = [...nombre, `${asignatura.seccion}`];

                if (texto.length * 3 > ROW_MODULE_HEIGHT) pdf.setFontSize(6);

                const textY = y + 5;
                pdf.text(texto, x + DIA_COL_WIDTH / 2, textY, { align: 'center', lineHeightFactor: 1.1 });
            }

            x += DIA_COL_WIDTH;
        }

        y += ROW_MODULE_HEIGHT;

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