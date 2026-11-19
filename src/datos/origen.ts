import { db } from '@/lib/supabase'
import type { OrigenForm } from '@/paginas/polizas/formulario/origen'

/** Marca cómo se cargó la póliza recién creada. Mejor esfuerzo: si falla, la póliza ya está guardada. */
export async function marcarOrigenPoliza(polizaId: number, o: OrigenForm): Promise<void> {
  const { error } = await db.rpc('poliza_marcar_origen', {
    p_poliza_id: polizaId,
    p_origen: o.origen,
    p_ia_desde: o.origen === 'ia' ? (o.iaDesde ?? null) : null,
    p_ia_hasta: o.origen === 'ia' ? (o.iaHasta ?? null) : null,
  })
  if (error) throw error
}

/** Origen guardado de una póliza (null si no tiene o si la columna no existe en esta base). */
export async function obtenerOrigenPoliza(polizaId: number): Promise<string | null> {
  const { data, error } = await db.from('polizas').select('origen').eq('id', polizaId).maybeSingle()
  if (error || !data) return null
  return ((data as { origen?: string | null }).origen ?? null) as string | null
}
