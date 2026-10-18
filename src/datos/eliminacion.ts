import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/supabase'
import { esAdmin, useSesion } from '@/lib/sesion'
import {
  parsearHistorial,
  parsearResultado,
  parsearSolicitud,
  type HistorialEliminacion,
  type ResultadoEliminacion,
  type SolicitudEliminacion,
} from './eliminacionLogica'

// Eliminación de pólizas con autorización del administrador. Toda la lógica y
// los permisos viven en la base (migración 20261015090000_eliminacion_polizas):
// aquí solo se llaman las funciones; no hay forma de saltarse las validaciones.

export const CLAVE_CONTEO_ELIMINACIONES = ['eliminaciones', 'conteo'] as const
export const CLAVE_ELIMINACIONES = ['eliminaciones', 'bandeja'] as const

/**
 * Marca pólizas para eliminar (cualquier usuario). Las marcadas desaparecen de
 * las listas (la base las oculta); quien llama también las saca de la caché.
 */
export async function solicitarEliminacion(ids: number[], motivo: string): Promise<ResultadoEliminacion> {
  const { data, error } = await db.rpc('polizas_eliminacion_solicitar', { p_ids: ids, p_motivo: motivo })
  if (error) throw error
  return parsearResultado(data)
}

/** Solicitudes pendientes (solo Administrador; la base devuelve error a los demás). */
export async function listarEliminacionesPendientes(): Promise<SolicitudEliminacion[]> {
  const { data, error } = await db.rpc('polizas_eliminacion_pendientes')
  if (error) throw error
  return ((data as unknown[] | null) ?? []).map(parsearSolicitud)
}

/**
 * Detalle completo de una póliza marcada (o ya eliminada). Solo Administrador.
 * Devuelve null si la base ya no tiene ni la póliza ni su copia.
 */
export async function obtenerDetalleEliminacion(polizaId: number): Promise<Record<string, unknown> | null> {
  const { data, error } = await db.rpc('polizas_eliminacion_detalle', { p_poliza_id: polizaId })
  if (error) throw error
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : null
}

export async function listarHistorialEliminaciones(limite = 100): Promise<HistorialEliminacion[]> {
  const { data, error } = await db.rpc('polizas_eliminacion_historial', { p_limite: limite })
  if (error) throw error
  return ((data as unknown[] | null) ?? []).map(parsearHistorial)
}

/**
 * [aprobar] true = borrar de verdad; false = rechazar y restaurar.
 * [ids] son ids de solicitud, no de póliza. Solo Administrador.
 */
export async function resolverEliminaciones(
  ids: number[],
  aprobar: boolean,
  nota?: string | null,
): Promise<ResultadoEliminacion> {
  const { data, error } = await db.rpc('polizas_eliminacion_resolver', {
    p_ids: ids,
    p_accion: aprobar ? 'aprobar' : 'rechazar',
    p_nota: nota ? nota : null,
  })
  if (error) throw error
  return parsearResultado(data)
}

/** Cuántas hay por autorizar (0 si el usuario no es Administrador). */
export async function contarEliminacionesPendientes(): Promise<number> {
  const { data, error } = await db.rpc('polizas_eliminacion_contar')
  if (error) throw error
  const n = Number(data ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** Contador de la insignia "Eliminaciones por autorizar" (solo se pide si es administrador). */
export function useConteoEliminaciones() {
  const sesion = useSesion()
  const admin = esAdmin(sesion?.usuario)
  return useQuery({
    queryKey: CLAVE_CONTEO_ELIMINACIONES,
    queryFn: contarEliminacionesPendientes,
    enabled: admin,
    staleTime: 30_000,
  })
}
