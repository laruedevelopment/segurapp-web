import { MAX_SELECCION, seleccionarVisibles } from '@/datos/eliminacionLogica'

export type EstadoSeleccion = 'ninguna' | 'algunas' | 'todas'

/**
 * Estado de la casilla "Seleccionar todas las visibles". Como máximo se pueden
 * marcar [MAX_SELECCION], así que "todas" significa que están marcadas las
 * primeras [MAX_SELECCION] de las visibles.
 */
export function estadoSeleccionVisibles(visibles: readonly { id: number }[], sel: ReadonlySet<number>): EstadoSeleccion {
  const objetivo = visibles.slice(0, MAX_SELECCION)
  if (objetivo.length === 0) return 'ninguna'
  const marcadas = objetivo.filter((p) => sel.has(p.id)).length
  if (marcadas === 0) return 'ninguna'
  return marcadas === objetivo.length ? 'todas' : 'algunas'
}

/** Clic en la casilla del encabezado: si ya están todas, las quita; si no, marca hasta el tope. */
export function alternarTodasVisibles(
  visibles: readonly { id: number }[],
  sel: ReadonlySet<number>,
): { sel: Set<number>; recortado: boolean } {
  if (estadoSeleccionVisibles(visibles, sel) === 'todas') return { sel: new Set(), recortado: false }
  return seleccionarVisibles(visibles)
}
