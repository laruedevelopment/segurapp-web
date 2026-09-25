import { usuarioId } from '@/lib/sesion'
import { db } from '@/lib/supabase'

// Bandeja de pólizas que todavía no existen de verdad: borradores guardados
// a medio llenar y lo que dejó la carga masiva con IA para revisar.

export type EstadoPendiente = 'borrador' | 'pendiente_revision'

export interface PolizaPendiente {
  id: number
  estado: EstadoPendiente
  datos: Record<string, unknown>
  nombre_archivo: string | null
  origen: string
  error_msg: string | null
  fcreado: string
  fultmod: string
}

const TABLA = 'polizas_pendientes'

export async function listarPendientes(estado?: EstadoPendiente): Promise<PolizaPendiente[]> {
  let q = db.from(TABLA).select()
  if (estado) q = q.eq('estado', estado)
  const { data, error } = await q.order('fcreado', { ascending: false })
  if (error) throw error
  return (data ?? []) as PolizaPendiente[]
}

export async function contarPendientes(): Promise<number> {
  const { count, error } = await db.from(TABLA).select('id', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

export async function obtenerPendiente(id: number): Promise<PolizaPendiente | null> {
  const { data, error } = await db.from(TABLA).select().eq('id', id).maybeSingle()
  if (error) throw error
  return data as PolizaPendiente | null
}

export async function crearPendiente(p: {
  estado: EstadoPendiente
  datos: Record<string, unknown>
  nombre_archivo?: string | null
  origen?: string
  error_msg?: string | null
}): Promise<number> {
  const { data, error } = await db
    .from(TABLA)
    .insert({ origen: 'manual', ...p, usuario_id: usuarioId() })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: number }).id
}

export async function actualizarPendiente(id: number, cambios: { estado?: EstadoPendiente; datos?: Record<string, unknown> }) {
  const { error } = await db.from(TABLA).update(cambios).eq('id', id)
  if (error) throw error
}

export async function eliminarPendiente(id: number) {
  const { error } = await db.from(TABLA).delete().eq('id', id)
  if (error) throw error
}

/** Texto corto para la lista: nombre del cliente o número de póliza extraído. */
export function resumenPendiente(p: PolizaPendiente): string {
  const v = (p.datos.nombre_cliente ?? p.datos.nro_poliza) as string | undefined
  return v?.toString().trim() || 'Sin datos'
}
