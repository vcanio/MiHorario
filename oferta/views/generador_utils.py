# oferta/views/generador_utils.py
"""
Utilidades para el generador automático de horarios
---------------------------------------------------
Incluye:
- Algoritmos de backtracking optimizados
- Cálculo de métricas de horario
- Sistema de puntuación adaptativo a la oferta real
"""

import time
from datetime import datetime
from collections import defaultdict

# ════════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN
# ════════════════════════════════════════════════════════════════════════════════
MAX_TIEMPO_GENERACION = 30  # segundos (límite de seguridad)


# ════════════════════════════════════════════════════════════════════════════════
# FUNCIÓN PRINCIPAL: GENERACIÓN DE COMBINACIONES
# ════════════════════════════════════════════════════════════════════════════════
def generar_combinaciones_optimizado(por_sigla, preferencias, max_resultados=10):
    """
    Genera todas las combinaciones válidas de secciones (backtracking optimizado)
    y retorna las mejores según el sistema de puntuación adaptativo.
    """
    siglas_ordenadas = sorted(por_sigla.keys())
    secciones_por_sigla = [por_sigla[sigla] for sigla in siglas_ordenadas]

    todas_las_combinaciones = []
    tiempo_inicio = time.time()
    stats = {'exploradas': 0, 'validas': 0, 'podadas_jornada': 0, 'podadas_solapamiento': 0}

    # Detectar rango horario global de la oferta (para normalización adaptativa)
    min_hora, max_hora = detectar_rango_global(por_sigla)
    preferencias['rango_inicio_min'] = min_hora
    preferencias['rango_fin_max'] = max_hora

    def backtrack(indice, combinacion_actual, horarios_ocupados):
        if time.time() - tiempo_inicio > MAX_TIEMPO_GENERACION:
            return True  # timeout

        stats['exploradas'] += 1

        if indice == len(secciones_por_sigla):
            stats['validas'] += 1
            metricas = calcular_metricas_horario(combinacion_actual)
            puntuacion = calcular_puntuacion_normalizada(metricas, preferencias)
            todas_las_combinaciones.append({
                'asignaturas': list(combinacion_actual),
                'puntuacion': puntuacion,
                'metricas': metricas
            })
            return False

        for seccion in secciones_por_sigla[indice]:
            # PODA 1: jornada
            if combinacion_actual:
                jornada_actual = combinacion_actual[0].jornada
                if seccion.jornada != jornada_actual:
                    stats['podadas_jornada'] += 1
                    continue

            # PODA 2: solapamiento
            if tiene_solapamiento_rapido(seccion, horarios_ocupados):
                stats['podadas_solapamiento'] += 1
                continue

            nuevos_horarios = actualizar_horarios_ocupados(horarios_ocupados, seccion)
            combinacion_actual.append(seccion)
            timeout = backtrack(indice + 1, combinacion_actual, nuevos_horarios)
            combinacion_actual.pop()

            if timeout:
                return True
        return False

    # Ejecutar backtracking
    timeout_alcanzado = backtrack(0, [], defaultdict(list))
    tiempo_total = time.time() - tiempo_inicio

    # Logging
    print(f"""
╔══════════════════════════════════════════════════════════╗
║          ESTADÍSTICAS DE GENERACIÓN DE HORARIOS          ║
╠══════════════════════════════════════════════════════════╣
║ Nodos explorados:         {stats['exploradas']:>8}                    ║
║ Combinaciones válidas:    {stats['validas']:>8}                    ║
║ Podadas por jornada:      {stats['podadas_jornada']:>8}                    ║
║ Podadas por solapamiento: {stats['podadas_solapamiento']:>8}                    ║
║ Tiempo total:             {tiempo_total:>8.2f}s                  ║
║ Timeout alcanzado:        {'SÍ' if timeout_alcanzado else 'NO':>8}                    ║
╚══════════════════════════════════════════════════════════╝
""")

    if not todas_las_combinaciones:
        return []

    # Ordenar por puntuación
    todas_las_combinaciones.sort(key=lambda x: x['puntuacion'], reverse=True)
    mejores = todas_las_combinaciones[:max_resultados]

    print(f"✅ Retornando las {len(mejores)} mejores de {len(todas_las_combinaciones)} opciones válidas")
    print(f"   Rango de puntuaciones: {mejores[-1]['puntuacion']:.2f} - {mejores[0]['puntuacion']:.2f}")
    return mejores


# ════════════════════════════════════════════════════════════════════════════════
# FUNCIONES DE APOYO Y PODA
# ════════════════════════════════════════════════════════════════════════════════
def tiene_solapamiento_rapido(asignatura, horarios_ocupados):
    """Verifica solapamientos entre horarios ocupados."""
    for horario in asignatura.horarios.all():
        dia = horario.dia
        inicio = datetime.combine(datetime.today(), horario.hora_inicio)
        fin = datetime.combine(datetime.today(), horario.hora_fin)
        for h_inicio, h_fin in horarios_ocupados[dia]:
            if inicio < h_fin and fin > h_inicio:
                return True
    return False


def actualizar_horarios_ocupados(horarios_ocupados, asignatura):
    """Devuelve una copia inmutable del mapa de horarios ocupados."""
    nuevos = defaultdict(list)
    for dia, horarios in horarios_ocupados.items():
        nuevos[dia] = horarios.copy()

    for horario in asignatura.horarios.all():
        inicio = datetime.combine(datetime.today(), horario.hora_inicio)
        fin = datetime.combine(datetime.today(), horario.hora_fin)
        nuevos[horario.dia].append((inicio, fin))
    return nuevos


def detectar_rango_global(por_sigla):
    """Detecta el rango horario mínimo y máximo global en toda la oferta."""
    min_hora = 23.0
    max_hora = 0.0
    for secciones in por_sigla.values():
        for seccion in secciones:
            for h in seccion.horarios.all():
                hora_ini = h.hora_inicio.hour + h.hora_inicio.minute / 60
                hora_fin = h.hora_fin.hour + h.hora_fin.minute / 60
                min_hora = min(min_hora, hora_ini)
                max_hora = max(max_hora, hora_fin)
    return min_hora, max_hora


# ════════════════════════════════════════════════════════════════════════════════
# MÉTRICAS DE HORARIO
# ════════════════════════════════════════════════════════════════════════════════
def calcular_metricas_horario(asignaturas):
    """Calcula métricas cuantitativas del horario generado."""
    dias_usados = set()
    total_huecos = 0
    bloques_por_dia = defaultdict(list)
    clases_virtuales = 0
    total_clases = 0

    for asig in asignaturas:
        if asig.virtual_sincronica == 'True':
            clases_virtuales += 1
        total_clases += 1

        for horario in asig.horarios.all():
            dias_usados.add(horario.dia)
            inicio = datetime.combine(datetime.today(), horario.hora_inicio)
            fin = datetime.combine(datetime.today(), horario.hora_fin)
            bloques_por_dia[horario.dia].append((inicio, fin))

    huecos_por_dia = {}
    for dia, bloques in bloques_por_dia.items():
        bloques.sort()
        huecos_dia = 0
        for i in range(len(bloques) - 1):
            hueco = (bloques[i + 1][0] - bloques[i][1]).total_seconds() / 60
            if hueco > 0:
                huecos_dia += hueco
                total_huecos += hueco
        huecos_por_dia[dia] = huecos_dia

    horas_inicio, horas_fin = [], []
    for bloques in bloques_por_dia.values():
        if bloques:
            mas_temprano = min(bloques, key=lambda x: x[0])
            mas_tarde = max(bloques, key=lambda x: x[1])
            horas_inicio.append(mas_temprano[0].hour + mas_temprano[0].minute / 60)
            horas_fin.append(mas_tarde[1].hour + mas_tarde[1].minute / 60)

    clases_por_dia = [len(bloques) for bloques in bloques_por_dia.values()]
    if clases_por_dia:
        promedio = sum(clases_por_dia) / len(clases_por_dia)
        varianza = sum((x - promedio) ** 2 for x in clases_por_dia) / len(clases_por_dia)
        balance = max(0, 1 - (varianza / 16))
    else:
        balance = 1.0

    max_hueco_dia = max(huecos_por_dia.values()) if huecos_por_dia else 0

    return {
        'dias_usados': len(dias_usados),
        'total_huecos_minutos': total_huecos,
        'max_hueco_dia': max_hueco_dia,
        'clases_virtuales': clases_virtuales,
        'total_clases': total_clases,
        'hora_inicio_promedio': sum(horas_inicio) / len(horas_inicio) if horas_inicio else 0,
        'hora_fin_promedio': sum(horas_fin) / len(horas_fin) if horas_fin else 0,
        'bloques_por_dia': {dia: len(bloques) for dia, bloques in bloques_por_dia.items()},
        'balance_carga': balance,
        'huecos_por_dia': huecos_por_dia
    }


# ════════════════════════════════════════════════════════════════════════════════
# SISTEMA DE PUNTUACIÓN ADAPTATIVO
# ════════════════════════════════════════════════════════════════════════════════
def calcular_puntuacion_normalizada(metricas, preferencias):
    """
    Sistema de puntuación en escala 0–100 (versión adaptativa a la oferta real)
    Soporta preferencias:
      - 'entrar_temprano' → valora inicio bajo
      - 'salir_temprano' → valora fin bajo
      - 'entrar_tarde' → valora inicio alto
      - 'salir_tarde' → valora fin alto
      - 'neutro' → valora cercanía al promedio
    """

    puntuacion = 0.0

    # ───── 1. Huecos (35 pts)
    total_huecos = metricas['total_huecos_minutos']
    if preferencias.get('minimizar_huecos', True):
        huecos_pts = max(0, 35 * (1 - min(total_huecos / 180, 1) ** 1.3))
    else:
        huecos_pts = 17.5
    puntuacion += huecos_pts

    # ───── 2. Horario (30 pts) — adaptativo
    inicio_real = metricas['hora_inicio_promedio']
    fin_real = metricas['hora_fin_promedio']
    pref_horario = preferencias.get('preferencia_horario', 'neutro')
    min_inicio = preferencias.get('rango_inicio_min', 8.0)
    max_fin = preferencias.get('rango_fin_max', 23.0)

    if not inicio_real or not fin_real:
        puntuacion += 15
    else:
        inicio_norm = (inicio_real - min_inicio) / (max_fin - min_inicio)
        fin_norm = (fin_real - min_inicio) / (max_fin - min_inicio)
        inicio_norm = max(0, min(1, inicio_norm))
        fin_norm = max(0, min(1, fin_norm))

        if pref_horario == 'entrar_temprano':
            puntuacion += (1 - inicio_norm) * 30
        elif pref_horario == 'entrar_tarde':
            puntuacion += inicio_norm * 30
        elif pref_horario == 'salir_temprano':
            puntuacion += (1 - fin_norm) * 30
        elif pref_horario == 'salir_tarde':
            puntuacion += fin_norm * 30
        else:
            centro = (min_inicio + max_fin) / 2
            distancia = abs(((inicio_real + fin_real) / 2) - centro)
            max_distancia = (max_fin - min_inicio) / 2
            factor = max(0, 1 - (distancia / max_distancia))
            puntuacion += factor * 30

    # ───── 3. Clases virtuales (15 pts)
    total_asig = max(1, metricas['total_clases'])
    ratio_virtual = metricas['clases_virtuales'] / total_asig
    pref_virtual = preferencias.get('preferir_virtuales', 'neutro')

    if pref_virtual == 'si':
        puntuacion += ratio_virtual * 15
    elif pref_virtual == 'no':
        puntuacion += (1 - ratio_virtual) * 15
    else:
        puntuacion += 7.5

    # ───── 4. Balance de carga (10 pts)
    puntuacion += metricas.get('balance_carga', 0.5) * 10

    # ───── 5. Compacidad (10 pts)
    dias_usados = metricas['dias_usados']
    max_hueco = metricas['max_hueco_dia']
    pts_dias = max(0, 5 - abs(dias_usados - 3) * 1.5)
    pts_hueco = max(0, 5 - min(max_hueco / 120, 1) * 5)
    puntuacion += pts_dias + pts_hueco

    return round(min(100, max(0, puntuacion)), 2)