import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/supabase'
import { casoDesdeFila, type CasoRevision } from './casosLogica'

// "Casos por revisar" (tabla casos_revision): situaciones dudosas que el
// equipo debe aclarar. La base pone quién y cuándo resolvió (trigger) y cierra
// sola los casos ya corregidos con casos_revision_revalidar().

export const CLAVE_CASOS = ['casos'] as const

const TABLA = 'casos_revision'
const COLS =
  'id, tipo, titulo, descripcion, pregunta, polizas, reporte_id, abono_id, estado, ' +
  'respuesta, fresuelto, fcreado, ' +
  'resuelve:usuarios!casos_revision_usuario_resuelve_fkey(apodo_usuario)'

export async function listarCasos(estado: 'P' | 'R'): Promise<CasoRevision[]> {
  const { data, error } = await db
    .from(TABLA)
    .select(COLS)
    .eq('estado', estado)
    .order(estado === 'R' ? 'fresuelto' : 'fcreado', { ascending: estado !== 'R' })
  if (error) throw error
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(casoDesdeFila)
}

/**
 * Pide a la base que cierre los casos pendientes cuyos datos ya se corrigieron.
 * Devuelve cuántos cerró. Nunca falla: si la función todavía no existe o no hay
 * conexión, simplemente no cierra nada.
 */
export async function revalidarCasos(): Promise<number> {
  try {
    const { data, error } = await db.rpc('casos_revision_revalidar')
    if (error) return 0
    return typeof data === 'number' ? data : 0
  } catch {
    return 0
  }
}

/** Revalida y cuenta los pendientes (el número de la tarjeta de inicio). */
export async function contarCasosPendientes(): Promise<number> {
  await revalidarCasos()
  const { data, error } = await db.from(TABLA).select('id').eq('estado', 'P')
  if (error) throw error
  return (data ?? []).length
}

const CASO_NO_DISPONIBLE = 'El caso ya no está disponible (otra persona pudo cambiarlo). Recargue la lista.'

/** Quién y cuándo lo pone la base (trigger). */
export async function resolverCaso(id: number, respuesta: string) {
  const { data, error } = await db.from(TABLA).update({ estado: 'R', respuesta: respuesta.trim() }).eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error(CASO_NO_DISPONIBLE)
}

export async function reabrirCaso(id: number) {
  const { data, error } = await db.from(TABLA).update({ estado: 'P' }).eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error(CASO_NO_DISPONIBLE)
}

/**
 * Cantidad de casos pendientes para la tarjeta de inicio. `data` es undefined
 * mientras carga o si no se pudo consultar (la tarjeta se muestra sin número).
 */
export function useCasosPendientes() {
  return useQuery({
    queryKey: [...CLAVE_CASOS, 'contador'],
    queryFn: contarCasosPendientes,
    refetchOnMount: 'always',
    retry: false,
  })
}
