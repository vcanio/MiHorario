// --- Estado Interno ---
let seleccionadas = JSON.parse(localStorage.getItem('seleccionadas')) || {};
let asignaciones = {};
let indiceActual = 0;
let confirmCallback = null;

console.log('🗄️ Estado inicial cargado:', {
    seleccionadas: Object.keys(seleccionadas),
    cantidadAsignaturas: Object.keys(seleccionadas).length
});

// --- Funciones de Estado ---
function guardarEnLocalStorage() {
    localStorage.setItem('seleccionadas', JSON.stringify(seleccionadas));
    console.log('💾 Estado guardado en localStorage:', Object.keys(seleccionadas).length, 'asignaturas');
}

// --- Interfaz Pública (Getters y Setters) ---
export const getSeleccionadas = () => seleccionadas;
export const getAsignaturaSeleccionada = (sigla) => seleccionadas[sigla];
export const hasAsignaturaSeleccionada = (sigla) => sigla in seleccionadas;

export function addSeleccionada(sigla, data) {
    console.log('➕ Añadiendo asignatura al estado:', sigla);
    seleccionadas[sigla] = data;
    guardarEnLocalStorage();
}

export function removeSeleccionada(sigla) {
    console.log('➖ Eliminando asignatura del estado:', sigla);
    delete seleccionadas[sigla];
    guardarEnLocalStorage();
}

export function setSeleccionadas(nuevasSeleccionadas) {
    console.log('🔄 Reemplazando estado completo con', Object.keys(nuevasSeleccionadas).length, 'asignaturas');
    console.log('📋 Nuevas asignaturas:', Object.keys(nuevasSeleccionadas));
    seleccionadas = nuevasSeleccionadas;
    guardarEnLocalStorage();
}

export const getAsignaciones = () => asignaciones;
export const getAsignacion = (sigla) => asignaciones[sigla];
export const setAsignacion = (sigla, color) => { asignaciones[sigla] = color; };

export const getIndiceActual = () => indiceActual;
export const incrementIndiceActual = () => { indiceActual++; };

export const getConfirmCallback = () => confirmCallback;
export const setConfirmCallback = (callback) => { confirmCallback = callback; };

console.log('✅ state.js cargado completamente');