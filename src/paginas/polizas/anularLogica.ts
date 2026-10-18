// Lógica pura del diálogo "Anular póliza" (sin pantalla ni base de datos).
// Réplica de lib/ui/dialogos/anular_poliza.dart de la app Flutter.

import { fmtDinero } from '@/lib/numeros'
import { fmtFecha, aFecha } from '@/lib/fechas'

export const ESTADO_ANULADA = 'A'

/** Campos de un abono que usa el diálogo. */
export interface PagoAnulable {
  id: number
  idrep_pago: number | null
  fecha_pago: string | null
  vlrabono_prima: number | null
  estado_pago: string
}

/** "Reporte #12 · 05/09/2019 · Abono $ 281.731" */
export function textoPago(a: Pick<PagoAnulable, 'idrep_pago' | 'fecha_pago' | 'vlrabono_prima'>): string {
  const fecha = a.fecha_pago ? fmtFecha(aFecha(a.fecha_pago)) : ''
  return `Reporte #${a.idrep_pago ?? '—'} · ${fecha || 'sin fecha'} · Abono ${fmtDinero(a.vlrabono_prima ?? 0)}`
}

export const yaAnulado = (a: Pick<PagoAnulable, 'estado_pago'>) => a.estado_pago === ESTADO_ANULADA

/** Pega o quita un id de la selección sin tocar el conjunto original. */
export function alternarMarca(marcados: ReadonlySet<number>, id: number, marcar: boolean): Set<number> {
  const nuevo = new Set(marcados)
  if (marcar) nuevo.add(id)
  else nuevo.delete(id)
  return nuevo
}

/**
 * Pagos que realmente se anulan: solo los marcados que pertenecen a la póliza
 * y todavía no están anulados (un id viejo o ajeno nunca se manda a la base).
 */
export function idsAAnular(marcados: ReadonlySet<number>, abonos: readonly PagoAnulable[]): number[] {
  return abonos.filter((a) => marcados.has(a.id) && !yaAnulado(a)).map((a) => a.id)
}

/** Texto de resultado tras anular la póliza y los pagos marcados. */
export function mensajeAnulacion(hechos: number, fallidos: number): string {
  return (
    'Póliza anulada' +
    (hechos > 0 ? ` y ${hechos} ${hechos === 1 ? 'pago anulado' : 'pagos anulados'}` : '') +
    (fallidos > 0
      ? `. ${fallidos} ${fallidos === 1 ? 'pago no se pudo anular' : 'pagos no se pudieron anular'}: ${fallidos === 1 ? 'revíselo' : 'revíselos'} en Editar abono`
      : '')
  )
}
