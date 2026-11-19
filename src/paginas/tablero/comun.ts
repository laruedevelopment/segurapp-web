import type { FilaReporte } from '@/paginas/reportes/calculos'
import type { DimTablero, FiltrosTablero } from './logica'

/** Lo que reciben todas las pestañas. */
export interface PropsTab {
  /** Pólizas que cumplen los filtros. */
  filas: FilaReporte[]
  /** Todas las pólizas cargadas (para listas de opciones). */
  todas: FilaReporte[]
  filtros: FiltrosTablero
  cambiar: (parcial: Partial<FiltrosTablero>) => void
  hoy: Date
}

/** Tocar un grupo lo deja como único filtro de esa dimensión; tocarlo de nuevo lo quita. */
export function alternarGrupo(filtros: FiltrosTablero, dim: DimTablero, nombre: string): Partial<FiltrosTablero> {
  const actual = filtros[dim]
  return { [dim]: actual.length === 1 && actual[0] === nombre ? [] : [nombre] } as Partial<FiltrosTablero>
}
