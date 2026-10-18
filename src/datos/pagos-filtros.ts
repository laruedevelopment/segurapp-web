import { aISO } from '@/lib/fechas'
import { ilikeContiene } from '@/lib/filtros'

// Armado de filtros de la lista de reportes (puro, sin base de datos).

/**
 * Filtro `.or(...)` de la búsqueda de reportes: aseguradora, intermediario o
 * código del reporte ("1418" o "#1418"). Devuelve '' si no hay texto.
 */
export function filtroBusquedaReportes(busqueda: string): string {
  const q = busqueda.trim()
  if (!q) return ''
  const sinNumeral = q.replace(/^#/, '').trim()
  const codigo = /^\d+$/.test(sinNumeral) ? Number(sinNumeral) : null
  return [ilikeContiene('nombre_aseg', q), ilikeContiene('nombre_interm', q), codigo != null ? `id.eq.${codigo}` : null]
    .filter(Boolean)
    .join(',')
}

/** Límites del rango de `fecha_rep` (ambos días incluidos: gte / lte). */
export function limitesRangoFechas(desde?: Date | null, hasta?: Date | null) {
  return { gte: desde ? aISO(desde) : null, lte: hasta ? aISO(hasta) : null }
}
