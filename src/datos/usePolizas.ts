import { useSyncExternalStore } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { PolizaLista } from '@/lib/tipos'
import { listarPolizasPorIds, listarTodasPolizas } from './polizas'

// "Todas las pólizas" (~33 mil) descargadas una sola vez y compartidas por
// Pólizas y Reportes. Pasados 15 minutos se vuelven a bajar solas; al
// guardar una póliza se refresca solo esa fila (refrescarPolizas).

export const CLAVE_TODAS = ['polizas', 'todas'] as const
export const MINUTOS_POLIZAS = 15

// Progreso de la descarga (cuántas van), para mostrar "Cargando 12.000…".
let progreso = 0
const oyentes = new Set<() => void>()
function fijarProgreso(n: number) {
  progreso = n
  for (const o of oyentes) o()
}
export function useProgresoPolizas() {
  return useSyncExternalStore(
    (cb) => {
      oyentes.add(cb)
      return () => oyentes.delete(cb)
    },
    () => progreso,
  )
}

export function usePolizasTodas(activo = true) {
  return useQuery({
    queryKey: CLAVE_TODAS,
    queryFn: async ({ signal }) => {
      fijarProgreso(0)
      const r = await listarTodasPolizas('', fijarProgreso, signal)
      return { polizas: r, cargadasEn: new Date() }
    },
    enabled: activo,
    staleTime: MINUTOS_POLIZAS * 60_000,
    gcTime: 60 * 60_000,
  })
}

/**
 * Trae de nuevo solo las pólizas [ids] y las reemplaza en la copia en
 * memoria (en vez de descargar las 33 mil después de guardar una).
 */
export async function refrescarPolizas(qc: QueryClient, ids: number[]) {
  const actual = qc.getQueryData<{ polizas: PolizaLista[]; cargadasEn: Date }>(CLAVE_TODAS)
  if (!actual || !ids.length) return
  try {
    const nuevas = await listarPolizasPorIds(ids)
    const porId = new Map(nuevas.map((p) => [p.id, p]))
    const existentes = new Set(actual.polizas.map((p) => p.id))
    const lista = [
      ...nuevas.filter((p) => !existentes.has(p.id)),
      ...actual.polizas.flatMap((p) => (ids.includes(p.id) ? (porId.has(p.id) ? [porId.get(p.id)!] : []) : [p])),
    ]
    qc.setQueryData(CLAVE_TODAS, { ...actual, polizas: lista })
  } catch {
    qc.invalidateQueries({ queryKey: CLAVE_TODAS })
  }
}

export function useRefrescarPolizas() {
  const qc = useQueryClient()
  return (ids: number[]) => refrescarPolizas(qc, ids)
}

/** Quita una póliza eliminada de la copia en memoria. */
export function quitarPolizaDeCache(qc: QueryClient, id: number) {
  const actual = qc.getQueryData<{ polizas: PolizaLista[]; cargadasEn: Date }>(CLAVE_TODAS)
  if (!actual) return
  qc.setQueryData(CLAVE_TODAS, { ...actual, polizas: actual.polizas.filter((p) => p.id !== id) })
}
