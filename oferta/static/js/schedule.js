import { getAsignacion, setAsignacion, getIndiceActual, incrementIndiceActual, getSeleccionadas } from './state.js';
import { colores } from './constants.js';

export function colorDeFondo(sigla) {
    let asignacion = getAsignacion(sigla); // Esta línea ahora funcionará
    if (!asignacion) {
        let indice = getIndiceActual();
        asignacion = colores[indice % colores.length];
        setAsignacion(sigla, asignacion);
        incrementIndiceActual();
    }
    return asignacion;
}

export function parseTime(hora) {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
}

export function generarHoras(inicio, fin) {
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

export function haySolapamiento(nuevosHorarios) {
    const seleccionadas = getSeleccionadas();
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