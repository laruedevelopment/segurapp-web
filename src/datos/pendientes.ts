import { usuarioId } from '@/lib/sesion'
import { db } from '@/lib/supabase'
import { limitePurga, resumenDe } from './pendientesLogica'

// Bandeja de pólizas que todavía no existen de verdad: borradores guardados
// a medio llenar y lo que dejó la carga masiva con IA para revisar.
// "Descartar" ya no borra de una vez: marca fdescartado y la fila se puede
// restaurar durante DIAS_RETENCION días (ver la migración
// 20260929090000_polizas_pendientes_descarte_temporal.sql de la app Flutter,
// que ya está aplicada en la base).

export type EstadoPendiente = 'borrador' | 'pendiente_revision'

export interface PolizaPendiente {
  id: number
  estado: EstadoPendiente
  datos: Record<string, unknown>
  nombre_archivo: string | null
  origen: string
  error_msg: string | null
  /** Usuario que la subió o la creó (usuarios.id); null en datos antiguos. */
  usuario_id: number | null
  fcreado: string
  fultmod: string
  /** Cuándo se descartó; null si sigue activa. */
  fdescartado: string | null
}

const TABLA = 'polizas_pendientes'

/**
 * [descartadas]: true trae solo las descartadas (pestaña "Descartados");
 * false (por defecto) trae solo las activas.
 */
export async function listarPendientes(opciones: { estado?: EstadoPendiente; descartadas?: boolean } = {}): Promise<PolizaPendiente[]> {
  let q = db.from(TABLA).select()
  q = opciones.descartadas ? q.not('fdescartado', 'is', null) : q.is('fdescartado', null)
  if (opciones.estado) q = q.eq('estado', opciones.estado)
  const { data, error } = await q.order('fcreado', { ascending: false })
  if (error) throw error
  return (data ?? []) as PolizaPendiente[]
}

/** Cuántas activas hay (las descartadas no cuentan). */
export async function contarPendientes(): Promise<number> {
  const { count, error } = await db.from(TABLA).select('id', { count: 'exact', head: true }).is('fdescartado', null)
  if (error) throw error
  return count ?? 0
}

/** Apodo (o nombre) de cada usuario por id, para mostrar quién subió cada póliza. */
export async function nombresUsuarios(): Promise<Map<number, string>> {
  const { data, error } = await db.from('usuarios').select('id, apodo_usuario, nombre_usuario')
  if (error) throw error
  const out = new Map<number, string>()
  for (const r of (data ?? []) as { id: number; apodo_usuario: string | null; nombre_usuario: string | null }[]) {
    const apodo = (r.apodo_usuario ?? '').trim()
    const nombre = (r.nombre_usuario ?? '').trim()
    out.set(r.id, apodo || nombre)
  }
  return out
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
  const { error } = await db
    .from(TABLA)
    .update({ ...cambios, fultmod: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Ya no borra: la marca como descartada y se puede restaurar unos días. */
const PENDIENTE_NO_DISPONIBLE = 'La póliza pendiente ya no está disponible (otra persona pudo borrarla o ya venció su plazo). Recargue la lista.'

export async function descartarPendiente(id: number) {
  const { data, error } = await db.from(TABLA).update({ fdescartado: new Date().toISOString() }).eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error(PENDIENTE_NO_DISPONIBLE)
}

export async function restaurarPendiente(id: number) {
  const { data, error } = await db.from(TABLA).update({ fdescartado: null }).eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error(PENDIENTE_NO_DISPONIBLE)
}

/**
 * Borrado real e inmediato: solo para cuando la fila ya cumplió su función
 * (se guardó como póliza real). El botón "Descartar" usa descartarPendiente.
 */
export async function eliminarPendiente(id: number) {
  const { error } = await db.from(TABLA).delete().eq('id', id)
  if (error) throw error
}

/**
 * Borra de verdad las que llevan descartadas más de DIAS_RETENCION días. Se
 * llama sola al abrir Pendientes: no depende de un cron en la base.
 */
export async function purgarVencidos() {
  const { error } = await db.from(TABLA).delete().lt('fdescartado', limitePurga())
  if (error) throw error
}

/** Texto corto para la lista: nombre del cliente o número de póliza extraído. */
export const resumenPendiente = (p: Pick<PolizaPendiente, 'datos'>): string => resumenDe(p.datos)
