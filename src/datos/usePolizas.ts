import { useSyncExternalStore } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { PolizaLista } from '@/lib/tipos'
import { sinIdsEnCache } from './eliminacionLogica'
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
      idsQuitados.clear()
      const r = (await listarTodasPolizas('', fijarProgreso, signal)).filter((p) => !idsQuitados.has(p.id))
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
  if (!qc.getQueryData(CLAVE_TODAS) || !ids.length) return
  try {
    const nuevas = await listarPolizasPorIds(ids)
    // La caché se lee de nuevo DESPUÉS de esperar: otro refresco o una póliza
    // marcada para eliminar mientras tanto no se deben pisar.
    qc.setQueryData<{ polizas: PolizaLista[]; cargadasEn: Date }>(CLAVE_TODAS, (viejo) => {
      if (!viejo) return viejo
      const porId = new Map(nuevas.map((p) => [p.id, p]))
      const existentes = new Set(viejo.polizas.map((p) => p.id))
      const lista = [
        ...nuevas.filter((p) => !existentes.has(p.id) && !idsQuitados.has(p.id)),
        ...viejo.polizas.flatMap((p) => {
          if (!ids.includes(p.id)) return [p]
          const n = porId.get(p.id)
          return n && !idsQuitados.has(p.id) ? [n] : []
        }),
      ]
      return { ...viejo, polizas: lista }
    })
  } catch {
    qc.invalidateQueries({ queryKey: CLAVE_TODAS })
  }
}

export function useRefrescarPolizas() {
  const qc = useQueryClient()
  return (ids: number[]) => refrescarPolizas(qc, ids)
}

/**
 * Ids marcados para eliminar mientras una descarga completa estaba en curso:
 * esa descarga puede traerlos (empezó antes) y no deben volver a la caché.
 */
const idsQuitados = new Set<number>()

/**
 * Quita pólizas (marcadas para eliminar o borradas) de la copia en memoria sin
 * volver a descargar las demás.
 */
export function quitarPolizasDeCache(qc: QueryClient, ids: Iterable<number>) {
  const fuera = new Set(ids)
  if (!fuera.size) return
  for (const id of fuera) idsQuitados.add(id)
  qc.setQueriesData({ queryKey: ['polizas'] }, (viejo: unknown) => sinIdsEnCache(viejo, fuera))
}

/** Quita una póliza eliminada de la copia en memoria. */
export function quitarPolizaDeCache(qc: QueryClient, id: number) {
  quitarPolizasDeCache(qc, [id])
}
