// oferta/static/js/generadorModal.js
// Lógica del generador automático integrado como modal

import { diasLargos } from './constants.js';
import { getCsrfToken, mostrarNotificacion } from './ui.js';
import { setSeleccionadas, getSeleccionadas } from './state.js';
import { actualizarHorario } from './ui.js';

// ══════════════════════════════════════════════════════════
//                  ESTADO DEL GENERADOR
// ══════════════════════════════════════════════════════════
let asignaturasDisponibles = [];
let asignaturasSeleccionadas = new Map();
let horariosGenerados = [];
let horarioActualVista = 0;

// ══════════════════════════════════════════════════════════
//              FUNCIONES DE CONTROL DEL MODAL
// ══════════════════════════════════════════════════════════

export function abrirModalGenerador() {
    const modal = document.getElementById('modal-generador');
    if (!modal) {
        console.error('Modal del generador no encontrado');
        return;
    }
    
    // Reset estado
    asignaturasSeleccionadas.clear();
    horariosGenerados = [];
    horarioActualVista = 0;
    
    // Mostrar paso 1
    document.getElementById('generador-paso-seleccion').classList.remove('hidden');
    document.getElementById('generador-paso-resultados').classList.add('hidden');
    
    // Cargar filtros y asignaturas
    cargarFiltros();
    cargarAsignaturasDisponibles();
    
    // Mostrar modal
    modal.classList.remove('hidden');
    modal.classList.add('show');
}

export function cerrarModalGenerador() {
    const modal = document.getElementById('modal-generador');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('show');
    }
}

// ══════════════════════════════════════════════════════════
//              CARGAR FILTROS DINÁMICOS
// ══════════════════════════════════════════════════════════

async function cargarFiltros() {
    const sede = new URLSearchParams(window.location.search).get('sede');
    if (!sede) return;

    try {
        // Extraer filtros únicos de la tabla actual
        const carreraSelect = document.getElementById('carrera');
        const nivelSelect = document.getElementById('nivel');
        const jornadaSelect = document.getElementById('jornada');

        const genCarreraSelect = document.getElementById('gen-filter-carrera');
        const genNivelSelect = document.getElementById('gen-filter-nivel');
        const genJornadaSelect = document.getElementById('gen-filter-jornada');

        // Copiar opciones de filtros principales
        if (carreraSelect && genCarreraSelect) {
            genCarreraSelect.innerHTML = '<option value="">Todas las carreras</option>';
            Array.from(carreraSelect.options).slice(1).forEach(opt => {
                const newOpt = document.createElement('option');
                newOpt.value = opt.value;
                newOpt.textContent = opt.textContent;
                genCarreraSelect.appendChild(newOpt);
            });
        }

        if (nivelSelect && genNivelSelect) {
            genNivelSelect.innerHTML = '<option value="">Todos los niveles</option>';
            Array.from(nivelSelect.options).slice(1).forEach(opt => {
                const newOpt = document.createElement('option');
                newOpt.value = opt.value;
                newOpt.textContent = opt.textContent;
                genNivelSelect.appendChild(newOpt);
            });
        }

        if (jornadaSelect && genJornadaSelect) {
            genJornadaSelect.innerHTML = '<option value="">Todas las jornadas</option>';
            Array.from(jornadaSelect.options).slice(1).forEach(opt => {
                const newOpt = document.createElement('option');
                newOpt.value = opt.value;
                newOpt.textContent = opt.textContent;
                genJornadaSelect.appendChild(newOpt);
            });
        }

    } catch (error) {
        console.error('Error cargando filtros:', error);
    }
}

// ══════════════════════════════════════════════════════════
//          CARGAR ASIGNATURAS DISPONIBLES
// ══════════════════════════════════════════════════════════

async function cargarAsignaturasDisponibles() {
    const sede = new URLSearchParams(window.location.search).get('sede');
    const carrera = document.getElementById('gen-filter-carrera')?.value;
    const nivel = document.getElementById('gen-filter-nivel')?.value;
    const jornada = document.getElementById('gen-filter-jornada')?.value;

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

// ══════════════════════════════════════════════════════════
//          RENDERIZAR LISTA DE ASIGNATURAS
// ══════════════════════════════════════════════════════════

function renderizarListaAsignaturas() {
    const container = document.getElementById('gen-asignaturas-lista');
    if (!container) return;

    if (asignaturasDisponibles.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">No hay asignaturas con los filtros seleccionados</p>';
        return;
    }

    container.innerHTML = asignaturasDisponibles.map(asig => {
        const seleccionada = asignaturasSeleccionadas.has(asig.sigla);
        return `
            <div class="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors border border-gray-700">
                <div class="flex-1">
                    <div class="font-medium text-white text-sm">${asig.sigla}</div>
                    <div class="text-xs text-gray-400">${asig.nombre}</div>
                    <div class="text-xs text-gray-500 mt-1">${asig.num_secciones} sección(es)</div>
                </div>
                <button 
                    onclick="window.generadorToggleAsignatura('${asig.sigla}')"
                    class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        seleccionada 
                            ? 'bg-red-600 hover:bg-red-700 text-white' 
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }">
                    ${seleccionada ? '✕ Quitar' : '+ Añadir'}
                </button>
            </div>
        `;
    }).join('');
}

// ══════════════════════════════════════════════════════════
//          TOGGLE SELECCIÓN DE ASIGNATURA
// ══════════════════════════════════════════════════════════

window.generadorToggleAsignatura = function(sigla) {
    if (asignaturasSeleccionadas.has(sigla)) {
        asignaturasSeleccionadas.delete(sigla);
    } else {
        // Validar límite de 8 asignaturas
        if (asignaturasSeleccionadas.size >= 8) {
            mostrarNotificacion('Máximo 8 asignaturas permitidas', 'error');
            return;
        }
        
        const asig = asignaturasDisponibles.find(a => a.sigla === sigla);
        if (asig) {
            asignaturasSeleccionadas.set(sigla, asig);
        }
    }
    
    renderizarListaAsignaturas();
    actualizarResumenSeleccion();
};

// ══════════════════════════════════════════════════════════
//          ACTUALIZAR RESUMEN DE SELECCIÓN
// ══════════════════════════════════════════════════════════

function actualizarResumenSeleccion() {
    const container = document.getElementById('gen-resumen-seleccion');
    if (!container) return;

    if (asignaturasSeleccionadas.size === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm italic">Ninguna asignatura seleccionada</p>';
        return;
    }

    const seleccionadas = Array.from(asignaturasSeleccionadas.values());
    container.innerHTML = seleccionadas.map(a => `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 text-white rounded-full text-xs">
            ${a.sigla}
            <button onclick="window.generadorToggleAsignatura('${a.sigla}')" class="hover:text-red-300">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </span>
    `).join('');
}

// ══════════════════════════════════════════════════════════
//                  GENERAR HORARIOS
// ══════════════════════════════════════════════════════════

async function generarHorarios() {
    if (asignaturasSeleccionadas.size === 0) {
        mostrarNotificacion('Debes seleccionar al menos una asignatura', 'error');
        return;
    }

    const jornada = document.getElementById('gen-filter-jornada')?.value;
    const preferencias = {
        jornada: jornada,
        preferencia_horario: document.getElementById('gen-pref-horario')?.value ?? 'neutro',
        minimizar_huecos: document.getElementById('gen-pref-minimizar-huecos')?.checked ?? true,
        preferir_virtuales: document.getElementById('gen-pref-virtuales')?.value ?? 'neutro'
    };

    const btnGenerar = document.getElementById('gen-btn-generar');
    const spinner = document.getElementById('gen-spinner');

    if (btnGenerar) btnGenerar.disabled = true;
    if (spinner) spinner.classList.remove('hidden');

    try {
        const sede = new URLSearchParams(window.location.search).get('sede');
        
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
                ? `✓ Se generaron ${horariosGenerados.length} horarios óptimos`
                : `✓ Se generaron ${horariosGenerados.length} horario(s)`;
            
            mostrarNotificacion(mensaje, 'success');
        } else {
            mostrarNotificacion(data.error || 'Error al generar horarios', 'error');
        }
    } catch (error) {
        mostrarNotificacion('Error de conexión', 'error');
    } finally {
        if (btnGenerar) btnGenerar.disabled = false;
        if (spinner) spinner.classList.add('hidden');
    }
}

// ══════════════════════════════════════════════════════════
//                  MOSTRAR RESULTADOS
// ══════════════════════════════════════════════════════════

function mostrarResultados() {
    const pasoSeleccion = document.getElementById('generador-paso-seleccion');
    const pasoResultados = document.getElementById('generador-paso-resultados');
    
    if (pasoSeleccion) pasoSeleccion.classList.add('hidden');
    if (pasoResultados) pasoResultados.classList.remove('hidden');

    const horario = horariosGenerados[horarioActualVista];
    
    let badgeColor = 'bg-green-600';
    if (horario.puntuacion < 60) badgeColor = 'bg-red-600';
    else if (horario.puntuacion < 80) badgeColor = 'bg-yellow-600';

    const horasHuecos = Math.floor(horario.metricas.total_huecos_minutos / 60);
    const minutosHuecos = Math.round(horario.metricas.total_huecos_minutos % 60);

    pasoResultados.innerHTML = `
        <div class="flex items-center justify-between mb-4 pb-4 border-b border-gray-700">
            <div>
                <h4 class="text-lg font-semibold text-white">
                    Opción ${horarioActualVista + 1} de ${horariosGenerados.length}
                </h4>
                <div class="flex items-center gap-2 mt-2">
                    <span class="px-3 py-1 ${badgeColor} text-white rounded-full text-xs font-medium">
                        ${horario.puntuacion}/100 pts
                    </span>
                    ${horario.puntuacion >= 80 ? '<span class="text-green-400 text-xs">⭐ Excelente</span>' : ''}
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="window.generadorNavegar(-1)" ${horarioActualVista === 0 ? 'disabled' : ''}
                    class="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white rounded-lg text-sm transition-colors">
                    ← Anterior
                </button>
                <button onclick="window.generadorNavegar(1)" ${horarioActualVista === horariosGenerados.length - 1 ? 'disabled' : ''}
                    class="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white rounded-lg text-sm transition-colors">
                    Siguiente →
                </button>
            </div>
        </div>

        <!-- Métricas -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div class="bg-gray-700 p-3 rounded-lg text-center border border-gray-600">
                <div class="text-lg font-bold text-green-400">${horasHuecos}h ${minutosHuecos}m</div>
                <div class="text-xs text-gray-300">Tiempo libre</div>
            </div>
            <div class="bg-gray-700 p-3 rounded-lg text-center border border-gray-600">
                <div class="text-lg font-bold text-purple-400">${horario.metricas.clases_virtuales}</div>
                <div class="text-xs text-gray-300">Clases virtuales</div>
            </div>
            <div class="bg-gray-700 p-3 rounded-lg text-center border border-gray-600">
                <div class="text-lg font-bold text-orange-400">${formatearHora(horario.metricas.hora_inicio_promedio)}</div>
                <div class="text-xs text-gray-300">Inicio prom.</div>
            </div>
            <div class="bg-gray-700 p-3 rounded-lg text-center border border-gray-600">
                <div class="text-lg font-bold text-blue-400">${formatearHora(horario.metricas.hora_fin_promedio)}</div>
                <div class="text-xs text-gray-300">Fin prom.</div>
            </div>
        </div>

        <!-- Lista de Asignaturas -->
        <div class="mb-6">
            <h5 class="text-sm font-semibold text-white mb-3">Asignaturas del horario</h5>
            <div class="space-y-2">
                ${horario.asignaturas.map(a => `
                    <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg border border-gray-600">
                        <div>
                            <span class="font-medium text-white text-sm">${a.sigla}</span>
                            <span class="text-gray-300 text-sm">- ${a.nombre}</span>
                            <span class="text-gray-400 text-xs ml-2">(Sec. ${a.seccion})</span>
                        </div>
                        ${a.virtual ? '<span class="text-green-400 text-xs">🌐 Virtual</span>' : '<span class="text-blue-400 text-xs">🏫 Presencial</span>'}
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- Botones de Acción -->
        <div class="flex gap-3 pt-4 border-t border-gray-700">
            <button onclick="window.generadorAplicarHorario()" 
                class="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                ✓ Aplicar este horario
            </button>
            <button onclick="window.generadorVolver()" 
                class="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors">
                ← Volver
            </button>
        </div>
    `;
}

function formatearHora(horaDecimal) {
    const horas = Math.floor(horaDecimal);
    const minutos = Math.round((horaDecimal - horas) * 60);
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
}

// ══════════════════════════════════════════════════════════
//                  NAVEGACIÓN RESULTADOS
// ══════════════════════════════════════════════════════════

window.generadorNavegar = function(direccion) {
    const nuevoIndice = horarioActualVista + direccion;
    if (nuevoIndice >= 0 && nuevoIndice < horariosGenerados.length) {
        horarioActualVista = nuevoIndice;
        mostrarResultados();
    }
};

window.generadorVolver = function() {
    document.getElementById('generador-paso-resultados').classList.add('hidden');
    document.getElementById('generador-paso-seleccion').classList.remove('hidden');
};

// ══════════════════════════════════════════════════════════
//                  APLICAR HORARIO
// ══════════════════════════════════════════════════════════

window.generadorAplicarHorario = function() {
    const horario = horariosGenerados[horarioActualVista];
    if (!horario) return;

    const nuevasSeleccionadas = {};
    
    horario.asignaturas.forEach(asig => {
        nuevasSeleccionadas[asig.sigla] = {
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

    setSeleccionadas(nuevasSeleccionadas);
    actualizarHorario();
    
    // Actualizar botones de la tabla principal
    document.querySelectorAll('.seleccionar-btn').forEach(btn => {
        const sigla = btn.dataset.sigla;
        const seccion = btn.dataset.seccion;
        btn.disabled = nuevasSeleccionadas[sigla]?.seccion === seccion;
        btn.innerHTML = btn.disabled 
            ? '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m4.5 12.75 6 6 9-13.5" /></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15" /></svg>';
    });
    
    cerrarModalGenerador();
    mostrarNotificacion('✓ Horario aplicado correctamente', 'success');

    const horarioDiv = document.getElementById('horario');
    if (horarioDiv) {
        horarioDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

// ══════════════════════════════════════════════════════════
//              SETUP EVENT LISTENERS
// ══════════════════════════════════════════════════════════

export function initGeneradorModal() {
    const btnCerrar = document.getElementById('modal-generador-btn-cerrar');
    const btnGenerar = document.getElementById('gen-btn-generar');
    const btnLimpiar = document.getElementById('gen-btn-limpiar');
    const modal = document.getElementById('modal-generador');

    if (btnCerrar) btnCerrar.addEventListener('click', cerrarModalGenerador);
    if (btnGenerar) btnGenerar.addEventListener('click', generarHorarios);
    
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            asignaturasSeleccionadas.clear();
            renderizarListaAsignaturas();
            actualizarResumenSeleccion();
        });
    }

    // Listeners de filtros
    ['gen-filter-carrera', 'gen-filter-nivel', 'gen-filter-jornada'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', cargarAsignaturasDisponibles);
        }
    });

    // Cerrar al hacer clic fuera
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) cerrarModalGenerador();
        });
    }
}