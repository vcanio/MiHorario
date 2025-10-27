# oferta/views/generador_utils.py
"""
Utilidades para el generador automático de horarios
Algoritmos de backtracking, métricas y puntuación
"""

import time
from datetime import datetime
from collections import defaultdict

# Configuración
MAX_TIEMPO_GENERACION = 15  # segundos
MAX_COMBINACIONES_EVALUAR = 10000


def generar_combinaciones_optimizado(por_sigla, preferencias, max_resultados=10):
    """
    Genera combinaciones usando backtracking con poda temprana
    MUCHO más eficiente que itertools.product
    """
    siglas_ordenadas = sorted(por_sigla.keys())
    secciones_por_sigla = [por_sigla[sigla] for sigla in siglas_ordenadas]
    
    horarios_validos = []
    combinaciones_evaluadas = 0
    tiempo_inicio = time.time()
    
    def backtrack(indice, combinacion_actual, horarios_ocupados):
        nonlocal combinaciones_evaluadas
        
        # Timeout de seguridad
        if time.time() - tiempo_inicio > MAX_TIEMPO_GENERACION:
            return True
        
        # Límite de combinaciones
        if combinaciones_evaluadas >= MAX_COMBINACIONES_EVALUAR:
            return True
        
        # Caso base: combinación completa
        if indice == len(secciones_por_sigla):
            combinaciones_evaluadas += 1
            
            # Calcular métricas y puntuación
            metricas = calcular_metricas_horario(combinacion_actual)
            puntuacion = calcular_puntuacion_normalizada(metricas, preferencias)
            
            horarios_validos.append({
                'asignaturas': list(combinacion_actual),
                'puntuacion': puntuacion,
                'metricas': metricas
            })
            
            # Poda: si tenemos suficientes buenos resultados
            if len(horarios_validos) >= max_resultados * 5:
                return True
            
            return False
        
        # Probar cada sección de la asignatura actual
        for seccion in secciones_por_sigla[indice]:
            # PODA 1: Verificar jornada
            if combinacion_actual:
                jornada_actual = combinacion_actual[0].jornada
                if seccion.jornada != jornada_actual:
                    continue
            
            # PODA 2: Verificar solapamientos (optimizado)
            if tiene_solapamiento_rapido(seccion, horarios_ocupados):
                continue
            
            # Añadir sección
            nuevos_horarios = actualizar_horarios_ocupados(horarios_ocupados, seccion)
            combinacion_actual.append(seccion)
            
            # Recursión
            if backtrack(indice + 1, combinacion_actual, nuevos_horarios):
                combinacion_actual.pop()
                return True
            
            # Backtrack
            combinacion_actual.pop()
        
        return False
    
    # Iniciar backtracking
    backtrack(0, [], defaultdict(list))
    
    # Ordenar por puntuación y retornar mejores
    horarios_validos.sort(key=lambda x: x['puntuacion'], reverse=True)
    return horarios_validos[:max_resultados]


def tiene_solapamiento_rapido(asignatura, horarios_ocupados):
    """
    Verificación rápida de solapamientos
    """
    for horario in asignatura.horarios.all():
        dia = horario.dia
        inicio = datetime.combine(datetime.today(), horario.hora_inicio)
        fin = datetime.combine(datetime.today(), horario.hora_fin)
        
        for h_inicio, h_fin in horarios_ocupados[dia]:
            if inicio < h_fin and fin > h_inicio:
                return True
    
    return False


def actualizar_horarios_ocupados(horarios_ocupados, asignatura):
    """
    Copia actualizada de horarios (inmutable para backtracking)
    """
    nuevos = defaultdict(list)
    
    for dia, horarios in horarios_ocupados.items():
        nuevos[dia] = horarios.copy()
    
    for horario in asignatura.horarios.all():
        inicio = datetime.combine(datetime.today(), horario.hora_inicio)
        fin = datetime.combine(datetime.today(), horario.hora_fin)
        nuevos[horario.dia].append((inicio, fin))
    
    return nuevos


def calcular_metricas_horario(asignaturas):
    """
    Calcula métricas completas del horario
    """
    dias_usados = set()
    total_huecos = 0
    bloques_por_dia = defaultdict(list)
    clases_virtuales = 0
    
    for asig in asignaturas:
        if asig.virtual_sincronica == 'True':
            clases_virtuales += 1
            
        for horario in asig.horarios.all():
            dias_usados.add(horario.dia)
            inicio = datetime.combine(datetime.today(), horario.hora_inicio)
            fin = datetime.combine(datetime.today(), horario.hora_fin)
            bloques_por_dia[horario.dia].append((inicio, fin))
    
    # Calcular huecos
    for dia, bloques in bloques_por_dia.items():
        bloques.sort()
        for i in range(len(bloques) - 1):
            hueco = (bloques[i+1][0] - bloques[i][1]).total_seconds() / 60
            if hueco > 0:
                total_huecos += hueco
    
    # Horas de inicio y fin
    horas_inicio = []
    horas_fin = []
    
    for bloques in bloques_por_dia.values():
        if bloques:
            mas_temprano = min(bloques, key=lambda x: x[0])
            mas_tarde = max(bloques, key=lambda x: x[1])
            
            horas_inicio.append(mas_temprano[0].hour + mas_temprano[0].minute/60)
            horas_fin.append(mas_tarde[1].hour + mas_tarde[1].minute/60)
    
    # Balance de carga
    clases_por_dia = [len(bloques) for bloques in bloques_por_dia.values()]
    if clases_por_dia:
        promedio_clases = sum(clases_por_dia) / len(clases_por_dia)
        varianza = sum((x - promedio_clases) ** 2 for x in clases_por_dia) / len(clases_por_dia)
        balance = max(0, 1 - (varianza / 16))
    else:
        balance = 1.0
    
    return {
        'dias_usados': len(dias_usados),
        'total_huecos_minutos': total_huecos,
        'clases_virtuales': clases_virtuales,
        'hora_inicio_promedio': sum(horas_inicio) / len(horas_inicio) if horas_inicio else 0,
        'hora_fin_promedio': sum(horas_fin) / len(horas_fin) if horas_fin else 0,
        'bloques_por_dia': {dia: len(bloques) for dia, bloques in bloques_por_dia.items()},
        'balance_carga': balance
    }


def calcular_puntuacion_normalizada(metricas, preferencias):
    """
    Sistema de puntuación normalizado en escala 0-100
    """
    puntuacion = 0.0
    
    # --- COMPONENTE 1: Huecos (40%) ---
    # 0 huecos = 40 pts, 180+ min = 0 pts
    huecos_pts = max(0, 40 - (metricas['total_huecos_minutos'] / 180) * 40)
    
    if preferencias.get('minimizar_huecos', True):
        puntuacion += huecos_pts
    else:
        puntuacion += 20  # Neutro
    
    # --- COMPONENTE 2: Clases Virtuales (20%) ---
    total_asignaturas = max(1, len(metricas.get('bloques_por_dia', {})))
    ratio_virtual = metricas['clases_virtuales'] / total_asignaturas
    
    pref_virtual = preferencias.get('preferir_virtuales', 'neutro')
    
    if pref_virtual == 'si':
        puntuacion += ratio_virtual * 20
    elif pref_virtual == 'no':
        puntuacion += (1 - ratio_virtual) * 20
    else:
        puntuacion += 10
    
    # --- COMPONENTE 3: Horario (40%) ---
    jornada = preferencias.get('jornada', '')
    
    # Definir rangos ideales según jornada
    if jornada == 'Diurno':
        inicio_ideal, fin_ideal = 8.0, 14.0
    elif jornada == 'Vespertino':
        inicio_ideal, fin_ideal = 18.0, 22.0
    else:
        inicio_ideal, fin_ideal = 12.0, 18.0
    
    inicio_real = metricas['hora_inicio_promedio']
    fin_real = metricas['hora_fin_promedio']
    
    pref_horario = preferencias.get('preferencia_horario', 'neutro')
    
    if pref_horario == 'entrar_temprano':
        desviacion = abs(inicio_real - inicio_ideal)
        puntuacion += max(0, 40 - (desviacion / 4) * 40)
        
    elif pref_horario == 'salir_temprano':
        desviacion = abs(fin_real - fin_ideal)
        puntuacion += max(0, 40 - (desviacion / 4) * 40)
        
    else:  # neutro
        desviacion_inicio = abs(inicio_real - inicio_ideal)
        desviacion_fin = abs(fin_real - fin_ideal)
        desviacion_promedio = (desviacion_inicio + desviacion_fin) / 2
        puntuacion += max(0, 40 - (desviacion_promedio / 4) * 40)
    
    # Bonus por balance de carga (hasta 5 pts extra)
    puntuacion += metricas.get('balance_carga', 0) * 5
    
    return round(min(100, puntuacion), 2)