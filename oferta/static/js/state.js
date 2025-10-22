// --- Estado Interno ---
let seleccionadas = JSON.parse(localStorage.getItem('seleccionadas')) || {};
let asignaciones = {};
let indiceActual = 0;
let confirmCallback = null;

// --- Funciones de Estado ---
function guardarEnLocalStorage() {
    localStorage.setItem('seleccionadas', JSON.stringify(seleccionadas));
}

// --- Interfaz Pública (Getters y Setters) ---
export const getSeleccionadas = () => seleccionadas;
export const getAsignaturaSeleccionada = (sigla) => seleccionadas[sigla];
export const hasAsignaturaSeleccionada = (sigla) => sigla in seleccionadas;

export function addSeleccionada(sigla, data) {
    seleccionadas[sigla] = data;
    guardarEnLocalStorage();
}

export function removeSeleccionada(sigla) {
    delete seleccionadas[sigla];
    guardarEnLocalStorage();
}

export const getAsignaciones = () => asignaciones;
export const getAsignacion = (sigla) => asignaciones[sigla];
export const setAsignacion = (sigla, color) => { asignaciones[sigla] = color; };

export const getIndiceActual = () => indiceActual;
export const incrementIndiceActual = () => { indiceActual++; };

export const getConfirmCallback = () => confirmCallback;
export const setConfirmCallback = (callback) => { confirmCallback = callback; };