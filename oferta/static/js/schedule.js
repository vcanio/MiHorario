// ==================================================
//                 IMPORTACIONES
// ==================================================
import {
    getAsignaciones,
    getAsignacion,
    setAsignacion,
    getIndiceActual,
    incrementIndiceActual,
    getSeleccionadas
} from './state.js';

import { colores } from './constants.js';


// ==================================================
//           FUNCIÓN: Asignar color de fondo
// ==================================================
/**
 * Devuelve un color asociado a una asignatura según su sigla.
 * Si no existe un color asignado, se toma uno de la lista de colores y se incrementa el índice.
 */
export function colorDeFondo(sigla) {
    let asignacion = getAsignacion(sigla);

    if (!asignacion) {
        const indice = getIndiceActual();
        asignacion = colores[indice % colores.length];
        setAsignacion(sigla, asignacion);
        incrementIndiceActual();
    }

    return asignacion;
}


// ==================================================
//             FUNCIÓN: Parsear hora (HH:MM → minutos)
// ==================================================
/**
 * Convierte una hora en formato "HH:MM" a minutos totales.
 * Ejemplo: "08:30" → 510
 */
export function parseTime(hora) {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
}


// ==================================================
//             FUNCIÓN: Generar intervalo de horas
// ==================================================
/**
 * Genera un arreglo de horas desde una hora de inicio hasta una de fin,
 * avanzando en intervalos de 30 minutos.
 */
export function generarHoras(inicio, fin) {
    const resultado = [];
    let [h, m] = inicio.split(':').map(Number);
    const [fh, fm] = fin.split(':').map(Number);

    while (h < fh || (h === fh && m < fm)) {
        resultado.push(m === 0 ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` : '');
        m += 30;
        if (m >= 60) {
            h += 1;
            m = 0;
        }
    }

    return resultado;
}


// ==================================================
//         FUNCIÓN: Verificar solapamientos
// ==================================================
/**
 * Verifica si un conjunto de horarios nuevos se solapan con las asignaturas ya seleccionadas.
 * Si hay conflicto, devuelve { sigla, seccion, nombre } del ramo en conflicto.
 * Si no hay conflicto, devuelve null.
 */
export function haySolapamiento(nuevosHorarios, siglaDelNuevo) {
    const seleccionadas = getSeleccionadas();

    for (const [sigla, { horarios, seccion, nombre }] of Object.entries(seleccionadas)) {
        // Saltar la misma asignatura (evita falso positivo al reemplazar sección)
        if (sigla === siglaDelNuevo) continue;

        for (const existente of horarios) {
            for (const nuevo of nuevosHorarios) {
                const mismoDia = nuevo.dia === existente.dia;
                const solapaHoras =
                    parseTime(nuevo.inicio) < parseTime(existente.fin) &&
                    parseTime(nuevo.fin) > parseTime(existente.inicio);

                if (mismoDia && solapaHoras) {
                    return { sigla, seccion, nombre };
                }
            }
        }
    }

    return null; // No hay conflictos
}
