import { useQuery } from '@tanstack/react-query'
import { aFecha } from '@/lib/fechas'
import { db } from '@/lib/supabase'
import { INDICADORES_META, type AbonoLite, type IndicadorClave, type Meta } from '@/paginas/dashboard/motor'

// Datos del Dashboard gerencial: los pagos (abonos) en versión mínima y las
// metas comerciales. Las pólizas salen de la caché compartida (usePolizas.ts).
// Ver repositorio_dashboard.dart en la app Flutter.

export const MINUTOS_DASHBOARD = 15
const PAGINA = 1000

const num = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Pagos no anulados (los anulados no suman en ningún total de la app).
 * Pagina por id (keyset): exacto aunque entren pagos nuevos mientras carga.
 * La base lo permite a todos los roles, pero la pantalla es solo del administrador.
 */
export async function listarAbonosDashboard(
  onProgreso?: (cargados: number) => void,
  signal?: AbortSignal,
): Promise<AbonoLite[]> {
  const out: AbonoLite[] = []
  let ultimo: number | null = null
  for (;;) {
    let q = db
      .from('abonos_poliza')
      .select('id, id_poliza, fecha_pago, vlrabono_prima, vlrcomision, vlrcomad')
      .neq('estado_pago', 'A')
    if (ultimo != null) q = q.lt('id', ultimo)
    q = q.order('id', { ascending: false }).limit(PAGINA)
    if (signal) q = q.abortSignal(signal)
    const { data, error } = await q
    if (error) throw error
    const filas = (data ?? []) as unknown as Array<{
      id: number
      id_poliza: number
      fecha_pago: string | null
      vlrabono_prima: unknown
      vlrcomision: unknown
      vlrcomad: unknown
    }>
    for (const r of filas) {
      out.push({
        idPoliza: Number(r.id_poliza),
        fecha: aFecha(r.fecha_pago),
        prima: num(r.vlrabono_prima),
        comision: num(r.vlrcomision) + num(r.vlrcomad),
      })
    }
    onProgreso?.(out.length)
    if (filas.length < PAGINA) break
    ultimo = Number(filas[filas.length - 1].id)
  }
  return out
}

export const CLAVE_ABONOS = ['dashboard', 'abonos'] as const

/** Pagos para el dashboard; se vuelven a bajar solos cada 15 minutos. */
export function useAbonosDashboard(activo = true) {
  return useQuery({
    queryKey: CLAVE_ABONOS,
    queryFn: ({ signal }) => listarAbonosDashboard(undefined, signal),
    enabled: activo,
    staleTime: MINUTOS_DASHBOARD * 60_000,
    gcTime: 60 * 60_000,
    refetchInterval: MINUTOS_DASHBOARD * 60_000,
    retry: 1,
  })
}

// ── Metas ───────────────────────────────────────────────────────────────────

const TABLA_METAS = 'metas_comerciales'

/** ¿El error es que la tabla de metas aún no existe en esta base? */
export function esTablaMetasFaltante(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const o = e as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown }
  if (o.code === 'PGRST205' || o.code === '42P01') return true
  const texto = [o.message, o.details, o.hint].filter((x) => typeof x === 'string').join(' ')
  return texto.includes(TABLA_METAS)
}

export const MENSAJE_TABLA_METAS =
  'Falta crear la tabla de metas. Ejecute la migración 20261005090000_metas_comerciales.sql en Supabase.'

const INDICADORES = new Set<string>(INDICADORES_META.map((i) => i.clave))

export async function listarMetas(anio: number): Promise<Meta[]> {
  const { data, error } = await db.from(TABLA_METAS).select('anio, mes, indicador, asesor_id, valor').eq('anio', anio)
  if (error) throw error
  const metas: Meta[] = []
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    const indicador = String(r.indicador)
    if (!INDICADORES.has(indicador)) continue
    metas.push({
      anio: num(r.anio),
      mes: num(r.mes),
      indicador: indicador as IndicadorClave,
      asesorId: num(r.asesor_id),
      valor: num(r.valor),
    })
  }
  return metas
}

/** Inserta o actualiza las metas (una fila por año, mes, indicador y alcance). */
export async function guardarMetas(metas: Meta[]): Promise<void> {
  if (!metas.length) return
  const filas = metas.map((m) => ({
    anio: m.anio,
    mes: m.mes,
    indicador: m.indicador,
    asesor_id: m.asesorId,
    valor: m.valor,
  }))
  const { error } = await db.from(TABLA_METAS).upsert(filas, { onConflict: 'anio,mes,indicador,asesor_id' })
  if (error) throw error
}

export const claveMetas = (anio: number) => ['dashboard', 'metas', anio] as const

/** Metas de un año (solo el administrador puede leerlas; la base lo exige). */
export function useMetas(anio: number) {
  return useQuery({
    queryKey: claveMetas(anio),
    queryFn: () => listarMetas(anio),
    staleTime: 5 * 60_000,
    retry: false,
  })
}
