import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/supabase'
import { filaDesdeRpc, type FilaConsumo, type Rango } from './consumoLogica'

// Panel "Consumo de IA" (solo Administrador). Todo pasa por funciones de la base
// que verifican el rol: la tabla consumo_ia no se puede leer directamente.
// Migración: 20261110090000_consumo_ia.sql (app Flutter).

export const CLAVE_CONSUMO = ['consumo'] as const

export interface PrecioIA {
  modelo: string
  usdEntradaMillon: number
  usdCacheMillon: number
  usdSalidaMillon: number
}

export interface ConfigConsumo {
  trm: number
  precios: PrecioIA[]
}

export interface UsoServicios {
  dbBytes: number
  storageBytes: number
  polizas: number
  clientes: number
}

export async function consultarConsumo(rango: Rango): Promise<FilaConsumo[]> {
  const { data, error } = await db.rpc('consumo_ia_resumen', { p_desde: rango.desde, p_hasta: rango.hasta })
  if (error) throw error
  return ((data as unknown[] | null) ?? []).map(filaDesdeRpc)
}

export async function consultarConfig(): Promise<ConfigConsumo> {
  const { data, error } = await db.rpc('consumo_ia_config')
  if (error) throw error
  const m = (data ?? {}) as { trm?: unknown; precios?: Record<string, unknown>[] }
  return {
    trm: Number(m.trm) || 4000,
    precios: (m.precios ?? []).map((p) => ({
      modelo: String(p.modelo ?? 'default'),
      usdEntradaMillon: Number(p.usd_entrada_millon) || 0,
      usdCacheMillon: Number(p.usd_cache_millon) || 0,
      usdSalidaMillon: Number(p.usd_salida_millon) || 0,
    })),
  }
}

export async function guardarConfig(trm: number, precio: PrecioIA) {
  const { error } = await db.rpc('consumo_ia_guardar_config', {
    p_trm: trm,
    p_modelo: precio.modelo,
    p_entrada: precio.usdEntradaMillon,
    p_cache: precio.usdCacheMillon,
    p_salida: precio.usdSalidaMillon,
  })
  if (error) throw error
}

export async function consultarServicios(): Promise<UsoServicios> {
  const { data, error } = await db.rpc('consumo_servicios')
  if (error) throw error
  const m = (data ?? {}) as Record<string, unknown>
  return {
    dbBytes: Number(m.db_bytes) || 0,
    storageBytes: Number(m.storage_bytes) || 0,
    polizas: Number(m.polizas) || 0,
    clientes: Number(m.clientes) || 0,
  }
}

export const useConsumo = (rango: Rango, activo: boolean) =>
  useQuery({
    queryKey: [...CLAVE_CONSUMO, 'resumen', rango],
    queryFn: () => consultarConsumo(rango),
    enabled: activo,
    retry: false,
  })

export const useConfigConsumo = () => useQuery({ queryKey: [...CLAVE_CONSUMO, 'config'], queryFn: consultarConfig, retry: false })

export const useServicios = () =>
  useQuery({ queryKey: [...CLAVE_CONSUMO, 'servicios'], queryFn: consultarServicios, retry: false, staleTime: 5 * 60 * 1000 })
