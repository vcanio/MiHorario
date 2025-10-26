// oferta/static/js/generador.js - VERSIÓN OPTIMIZADA

import { diasLargos } from './constants.js';
import { getCsrfToken, mostrarNotificacion } from './ui.js';

// Estado del generador
let asignaturasDisponibles = [];
let asignaturasSeleccionadas = new Map();
let horariosGenerados = [];
let horarioActualVista = 0;

// ==================================================
//            Inicialización
// ==================================================
export function initGenerador() {
    cargarAsignaturasDisponibles();
    setupEventListeners();
}

// ==================================================
//       Cargar Asignaturas Disponibles
// ==================================================
async function cargarAsignaturasDisponibles() {
    const urlParams = new URLSearchParams(window.location.search);
    const sede = urlParams.get('sede');
    const carrera = document.getElementById('generador-carrera')?.value;
    const nivel = document.getElementById('generador-nivel')?.value;
    const jornada = document.getElementById('generador-jornada')?.value;

    if (!sede) {
        mostrarNotificacion('Error: Sede no especificada', 'error');
        return;
    }

    const params = new URLSearchParams({ sede });
    if (carrera) params.append('carrera', carrera);
    if (nivel) params.append('nivel', nivel);
    if (jornada) params.append('jornada', jornada);

    try {
        const response = await fetch(`/api/generador/asignaturas/?${params}`);
        const data = await response.json();

        if (response.ok) {
            asignaturasDisponibles = data.asignaturas;
            renderizarListaAsignaturas();
        } else {
            mostrarNotificacion(data.error || 'Error al cargar asignaturas', 'error');
        }
    } catch (error) {
        mostrarNotificacion('Error de conexión', 'error');
    }
}

// ==================================================
//       Renderizar Lista de Asignaturas
// ==================================================
function renderizarListaAsignaturas() {
    const container = document.getElementById('asignaturas-disponibles');
    if (!container) return;

    if (asignaturasDisponibles.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm">No hay asignaturas disponibles con los filtros seleccionados</p>';
        return;
    }

    container.innerHTML = asignaturasDisponibles
        .map(asig => {
            const seleccionada = asignaturasSeleccionadas.has(asig.sigla);
            return `
                <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                    <div class="flex-1">
                        <div class="font-medium text-white">${asig.sigla}</div>
                        <div class="text-sm text-gray-300">${asig.nombre}</div>
                        <div class="text-xs text-gray-400 mt-1">${asig.num_secciones} sección(es) disponible(s)</div>
                    </div>
                    <button 
                        onclick="window.toggleAsignatura('${asig.sigla}')"
                        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            seleccionada 
                                ? 'bg-red-600 hover:bg-red-700 text-white' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }">
                        ${seleccionada ? 'Quitar' : 'Añadir'}
                    </button>
                </div>
            `;
        })
        .join('');
}

// ==================================================
//        Toggle Selección de Asignatura
// ==================================================
window.toggleAsignatura = function(sigla) {
    if (asignaturasSeleccionadas.has(sigla)) {
        asignaturasSeleccionadas.delete(sigla);
    } else {
        const asig = asignaturasDisponibles.find(a => a.sigla === sigla);
        if (asig) {
            asignaturasSeleccionadas.set(sigla, asig);
        }
    }
    renderizarListaAsignaturas();
    actualizarResumenSeleccion();
};

// ==================================================
//        Actualizar Resumen de Selección
// ==================================================
function actualizarResumenSeleccion() {
    const container = document.getElementById('resumen-seleccion');
    if (!container) return;

    if (asignaturasSeleccionadas.size === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm italic">No has seleccionado ninguna asignatura</p>';
        return;
    }

    const seleccionadas = Array.from(asignaturasSeleccionadas.values());

    container.innerHTML = `
        <div class="flex flex-wrap gap-2">
            ${seleccionadas.map(a => `
                <span class="inline-flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-full text-sm">
                    ${a.sigla}
                    <button onclick="window.toggleAsignatura('${a.sigla}')" class="hover:text-red-300">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </span>
            `).join('')}
        </div>
    `;
}

// ==================================================
//           Generar Horarios (OPTIMIZADO)
// ==================================================
async function generarHorarios() {
    if (asignaturasSeleccionadas.size === 0) {
        mostrarNotificacion('Debes seleccionar al menos una asignatura', 'error');
        return;
    }

    // Validación: Máximo 8 asignaturas para evitar explosión combinatoria
    if (asignaturasSeleccionadas.size > 8) {
        mostrarNotificacion('Por favor, selecciona máximo 8 asignaturas para un mejor rendimiento', 'error');
        return;
    }

    const jornada = document.getElementById('generador-jornada')?.value;
    const preferencias = obtenerPreferencias(jornada);

    const btnGenerar = document.getElementById('btn-generar-horarios');
    const spinner = document.getElementById('generador-spinner');
    const resultados = document.getElementById('resultados-generador');

    if (btnGenerar) btnGenerar.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (resultados) resultados.innerHTML = '';

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const sede = urlParams.get('sede');

        if (!sede) {
            mostrarNotificacion('Error: Sede no encontrada en la URL', 'error');
            if (btnGenerar) btnGenerar.disabled = false;
            if (spinner) spinner.classList.add('hidden');
            return;
        }

        const response = await fetch('/api/generador/generar/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({
                sede: sede,
                jornada: jornada,
                siglas: Array.from(asignaturasSeleccionadas.keys()),
                preferencias: preferencias
            })
        });

        const data = await response.json();

        if (response.ok) {
            horariosGenerados = data.horarios;
            horarioActualVista = 0;
            mostrarResultados();
            
            const mensaje = horariosGenerados.length === 10 
                ? `Se generaron ${horariosGenerados.length} horarios óptimos (mostrando los mejores)`
                : `Se generaron ${horariosGenerados.length} horario(s) óptimo(s)`;
            
            mostrarNotificacion(mensaje, 'success');
        } else {
            mostrarNotificacion(data.error || 'Error al generar horarios', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error de conexión', 'error');
    } finally {
        if (btnGenerar) btnGenerar.disabled = false;
        if (spinner) spinner.classList.add('hidden');
    }
}

// ==================================================
//        Obtener Preferencias del Usuario
// ==================================================
function obtenerPreferencias(jornada) {
    return {
        jornada: jornada,
        preferencia_horario: document.getElementById('pref-horario')?.value ?? 'neutro',
        minimizar_huecos: document.getElementById('pref-minimizar-huecos')?.checked ?? true,
        preferir_virtuales: document.getElementById('pref-virtuales')?.value ?? 'neutro'
    };
}

// ==================================================
//          Mostrar Resultados
// ==================================================
function mostrarResultados() {
    const container = document.getElementById('resultados-generador');
    if (!container || horariosGenerados.length === 0) return;

    const horario = horariosGenerados[horarioActualVista];

    // Determinar color de badge según puntuación
    let badgeColor = 'bg-green-600';
    if (horario.puntuacion < 60) badgeColor = 'bg-red-600';
    else if (horario.puntuacion < 80) badgeColor = 'bg-yellow-600';

    container.innerHTML = `
        <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div class="flex items-center justify-between mb-6">
                <div>
                    <h3 class="text-xl font-semibold text-white">
                        Opción ${horarioActualVista + 1} de ${horariosGenerados.length}
                    </h3>
                    <div class="flex items-center gap-2 mt-2">
                        <span class="px-3 py-1 ${badgeColor} text-white rounded-full text-sm font-medium">
                            Puntuación: ${horario.puntuacion}/100
                        </span>
                        ${horario.puntuacion >= 80 ? '<span class="text-green-400 text-sm">⭐ Excelente</span>' : ''}
                    </div>
                </div>
                <div class="flex gap-2">
                    <button 
                        onclick="window.navegarHorario(-1)"
                        ${horarioActualVista === 0 ? 'disabled' : ''}
                        class="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors">
                        ← Anterior
                    </button>
                    <button 
                        onclick="window.navegarHorario(1)"
                        ${horarioActualVista === horariosGenerados.length - 1 ? 'disabled' : ''}
                        class="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors">
                        Siguiente →
                    </button>
                </div>
            </div>

            ${renderMetricas(horario.metricas)}
            
            <div class="mb-6">
                <h4 class="text-lg font-semibold text-white mb-3">Asignaturas</h4>
                <div class="space-y-2">
                    ${horario.asignaturas.map(a => `
                        <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                            <div>
                                <span class="font-medium text-white">${a.sigla}</span>
                                <span class="text-gray-300">- ${a.nombre}</span>
                                <span class="text-gray-400 text-sm ml-2">(Sección ${a.seccion})</span>
                            </div>
                            ${a.virtual ? '<span class="text-green-400 text-sm">🌐 Virtual</span>' : '<span class="text-blue-400 text-sm">🏫 Presencial</span>'}
                        </div>
                    `).join('')}
                </div>
            </div>

            <div id="horario-preview-${horarioActualVista}"></div>

            <div class="flex gap-3 mt-6">
                <button 
                    onclick="window.aplicarHorarioGenerado()"
                    class="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                    ✓ Aplicar este horario
                </button>
                ${horariosGenerados.length > 1 ? `
                    <button 
                        onclick="window.compararHorarios()"
                        class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                        🔄 Comparar opciones
                    </button>
                ` : ''}
            </div>
        </div>
    `;

    renderizarHorarioPreview(horario, `horario-preview-${horarioActualVista}`);
}

// ==================================================
//           Renderizar Métricas (MEJORADO)
// ==================================================
function renderMetricas(metricas) {
    const horasHuecos = Math.floor(metricas.total_huecos_minutos / 60);
    const minutosHuecos = Math.round(metricas.total_huecos_minutos % 60);
    
    return `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-gray-700 p-4 rounded-lg text-center">
                <div class="text-2xl font-bold text-green-400">
                    ${horasHuecos}h ${minutosHuecos}m
                </div>
                <div class="text-sm text-gray-300">Tiempo libre</div>
            </div>
            <div class="bg-gray-700 p-4 rounded-lg text-center">
                <div class="text-2xl font-bold text-purple-400">${metricas.clases_virtuales}</div>
                <div class="text-sm text-gray-300">Clases virtuales</div>
            </div>
            <div class="bg-gray-700 p-4 rounded-lg text-center">
                <div class="text-2xl font-bold text-orange-400">${formatearHora(metricas.hora_inicio_promedio)}</div>
                <div class="text-sm text-gray-300">Hora inicio prom.</div>
            </div>
            <div class="bg-gray-700 p-4 rounded-lg text-center">
                <div class="text-2xl font-bold text-blue-400">${formatearHora(metricas.hora_fin_promedio)}</div>
                <div class="text-sm text-gray-300">Hora fin prom.</div>
            </div>
        </div>
    `;
}

// ==================================================
//         Función Helper: Formatear Hora
// ==================================================
function formatearHora(horaDecimal) {
    const horas = Math.floor(horaDecimal);
    const minutos = Math.round((horaDecimal - horas) * 60);
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
}

// ==================================================
//       Renderizar Preview del Horario
// ==================================================
function renderizarHorarioPreview(horario, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Por ahora placeholder, luego integrar con sistema visual
    container.innerHTML = `
        <div class="bg-gray-900 rounded-lg p-4 border border-gray-700">
            <h5 class="text-sm font-semibold text-gray-400 mb-3">Vista Previa del Horario</h5>
            <div class="text-gray-500 text-xs text-center py-4">
                💡 Vista detallada disponible después de aplicar
            </div>
        </div>
    `;
}

// ==================================================
//         Navegar entre Horarios
// ==================================================
window.navegarHorario = function(direccion) {
    const nuevoIndice = horarioActualVista + direccion;
    if (nuevoIndice >= 0 && nuevoIndice < horariosGenerados.length) {
        horarioActualVista = nuevoIndice;
        mostrarResultados();
    }
};

// ==================================================
//        Aplicar Horario Generado
// ==================================================
window.aplicarHorarioGenerado = function() {
    const horario = horariosGenerados[horarioActualVista];
    if (!horario) return;

    const seleccionadas = {};
    
    horario.asignaturas.forEach(asig => {
        seleccionadas[asig.sigla] = {
            id: asig.id,
            nombre: asig.nombre,
            seccion: asig.seccion,
            virtual: asig.virtual,
            horarios: asig.horarios.map(h => ({
                dia: diasLargos[h.dia] || h.dia,
                inicio: h.inicio,
                fin: h.fin
            }))
        };
    });

    localStorage.setItem('seleccionadas', JSON.stringify(seleccionadas));
    mostrarNotificacion('Horario aplicado correctamente. Redirigiendo...', 'success');
    
    setTimeout(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const sede = urlParams.get('sede');
        window.location.href = `/lista_asignaturas/?sede=${sede}`;
    }, 1500);
};

// ==================================================
//         Comparar Múltiples Horarios
// ==================================================
window.compararHorarios = function() {
    const modal = document.getElementById('modal-comparacion');
    if (!modal) {
        crearModalComparacion();
        return;
    }
    
    const container = document.getElementById('comparacion-container');
    if (!container) return;

    container.innerHTML = horariosGenerados.slice(0, 3).map((horario, idx) => {
        let badgeColor = 'bg-green-600';
        if (horario.puntuacion < 60) badgeColor = 'bg-red-600';
        else if (horario.puntuacion < 80) badgeColor = 'bg-yellow-600';

        return `
            <div class="bg-gray-700 rounded-lg p-4 ${idx === horarioActualVista ? 'ring-2 ring-blue-500' : ''}">
                <div class="flex items-center justify-between mb-3">
                    <h4 class="font-semibold text-white">Opción ${idx + 1}</h4>
                    <span class="px-2 py-1 ${badgeColor} text-white rounded text-xs">
                        ${horario.puntuacion.toFixed(0)} pts
                    </span>
                </div>
                
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between text-gray-300">
                        <span>Huecos:</span>
                        <span class="font-medium text-white">${Math.round(horario.metricas.total_huecos_minutos)} min</span>
                    </div>
                    <div class="flex justify-between text-gray-300">
                        <span>Virtuales:</span>
                        <span class="font-medium text-white">${horario.metricas.clases_virtuales}</span>
                    </div>
                    <div class="flex justify-between text-gray-300">
                        <span>Inicio:</span>
                        <span class="font-medium text-white">${formatearHora(horario.metricas.hora_inicio_promedio)}</span>
                    </div>
                    <div class="flex justify-between text-gray-300">
                        <span>Fin:</span>
                        <span class="font-medium text-white">${formatearHora(horario.metricas.hora_fin_promedio)}</span>
                    </div>
                </div>

                <button 
                    onclick="window.seleccionarHorarioComparacion(${idx})"
                    class="w-full mt-4 px-4 py-2 ${idx === horarioActualVista ? 'bg-blue-600' : 'bg-gray-600'} hover:bg-blue-700 text-white rounded-lg text-sm transition-colors">
                    ${idx === horarioActualVista ? '✓ Seleccionado' : 'Seleccionar'}
                </button>
            </div>
        `;
    }).join('');

    modal.classList.remove('hidden');
};

window.seleccionarHorarioComparacion = function(indice) {
    horarioActualVista = indice;
    cerrarModalComparacion();
    mostrarResultados();
};

function crearModalComparacion() {
    const modal = document.createElement('div');
    modal.id = 'modal-comparacion';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 hidden';
    modal.innerHTML = `
        <div class="relative w-full max-w-4xl p-6 bg-gray-800 rounded-lg shadow-xl border border-gray-700 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-6">
                <h3 class="text-2xl font-semibold text-white">Comparar 3 Mejores Opciones</h3>
                <button onclick="window.cerrarModalComparacion()" class="text-gray-400 hover:text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div id="comparacion-container" class="grid grid-cols-1 md:grid-cols-3 gap-4"></div>
        </div>
    `;
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) cerrarModalComparacion();
    });
    
    window.compararHorarios();
}

window.cerrarModalComparacion = function() {
    const modal = document.getElementById('modal-comparacion');
    if (modal) modal.classList.add('hidden');
};

// ==================================================
//         Setup Event Listeners
// ==================================================
function setupEventListeners() {
    const btnGenerar = document.getElementById('btn-generar-horarios');
    if (btnGenerar) {
        btnGenerar.addEventListener('click', generarHorarios);
    }

    ['generador-carrera', 'generador-nivel', 'generador-jornada'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', () => {
                cargarAsignaturasDisponibles();
            });
        }
    });

    const btnLimpiar = document.getElementById('btn-limpiar-seleccion');
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            asignaturasSeleccionadas.clear();
            renderizarListaAsignaturas();
            actualizarResumenSeleccion();
            mostrarNotificacion('Selección limpiada', 'info');
        });
    }
}

// ==================================================
//         Inicializar al cargar página
// ==================================================
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('generador-container')) {
        initGenerador();
    }
});