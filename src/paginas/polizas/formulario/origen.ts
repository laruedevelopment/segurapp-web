// Cómo se cargó una póliza: a mano, con IA desde el formulario o por la carga masiva.

export type OrigenPoliza = 'manual' | 'ia' | 'masiva'

export interface OrigenForm {
  origen: OrigenPoliza
  /** Para "ia": ventana (ISO) en que se hizo la lectura, para enlazar el consumo de IA. */
  iaDesde?: string
  iaHasta?: string
}

export const ORIGEN_MANUAL: OrigenForm = { origen: 'manual' }

export const etiquetaOrigen = (o: string | null | undefined): string =>
  o === 'ia' ? 'Con IA (formulario)' : o === 'masiva' ? 'Carga masiva con IA' : o === 'manual' ? 'Manual' : 'Sin dato'

export const etiquetaOrigenCorta = (o: string | null | undefined): string => (o === 'ia' ? 'IA' : o === 'masiva' ? 'Masiva' : o === 'manual' ? 'Manual' : '—')

const esOrigen = (v: unknown): v is OrigenPoliza => v === 'manual' || v === 'ia' || v === 'masiva'

/** Un borrador recuerda el origen: así no se pierde al retomarlo otro día. */
export function origenEnBorrador<T extends Record<string, unknown>>(datos: T, o: OrigenForm): T & Record<string, unknown> {
  return { ...datos, __origen: o.origen, __ia_desde: o.iaDesde ?? null, __ia_hasta: o.iaHasta ?? null }
}

export function origenDeBorrador(datos: Record<string, unknown>): OrigenForm {
  const o = datos.__origen
  if (!esOrigen(o)) return ORIGEN_MANUAL
  return {
    origen: o,
    iaDesde: typeof datos.__ia_desde === 'string' ? datos.__ia_desde : undefined,
    iaHasta: typeof datos.__ia_hasta === 'string' ? datos.__ia_hasta : undefined,
  }
}

/** Origen de una póliza que viene de la bandeja de pendientes. */
export function origenDePendiente(p: { estado: string; datos: Record<string, unknown> }): OrigenForm {
  return p.estado === 'borrador' ? origenDeBorrador(p.datos) : { origen: 'masiva' }
}
