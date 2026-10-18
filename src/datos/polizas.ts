import { ilikeContiene, normalizarAlfanumerico } from '@/lib/filtros'
import { db } from '@/lib/supabase'
import type { Poliza, PolizaBase, PolizaLista } from '@/lib/tipos'

const TABLA = 'polizas'
const VISTA = 'vw_polizas_busqueda'

/** Columnas de las listas (la vista tiene ~57; el formulario usa obtenerPoliza). */
export const COLS_LISTA =
  'id, nro_poliza, cliente_id, asesor_id, ramo_id, producto_id, aseg_id, ' +
  'fexp_poliza, fini_poliza, ffin_poliza, prima_poliza, valor_poliza, ' +
  'vlraseg_poliza, porccom_poliza, bien_asegurado, fcreado, fultmod, ' +
  'estado_poliza_id, vlrprimapagada_poliza, usuario_id, ' +
  'nombre_cliente, doc_cliente, tipodoc_cliente, tel_cliente, ' +
  'nombre_asesor, nombre_ramo, nombre_prod, nombre_aseg, ' +
  'nombre_usuario, apodo_usuario'

/** Búsqueda libre sobre la vista, con el texto escapado. */
function filtroBusqueda(b: string) {
  const id = /^\d+$/.test(b) ? Number(b) : null
  const bDoc = b.replace(/\./g, '')
  return [
    id != null ? `id.eq.${id}` : null,
    ilikeContiene('nro_poliza', b),
    ilikeContiene('nombre_cliente', b),
    bDoc ? ilikeContiene('doc_cliente', bDoc) : null,
    ilikeContiene('nombre_asesor', b),
    ilikeContiene('nombre_ramo', b),
    ilikeContiene('nombre_prod', b),
    ilikeContiene('nombre_aseg', b),
    ilikeContiene('nombre_interm', b),
    ilikeContiene('nombre_forma_pago', b),
    ilikeContiene('nombre_formaexp', b),
    ilikeContiene('nombre_usuario', b),
    ilikeContiene('apodo_usuario', b),
    ilikeContiene('bien_asegurado', b),
    ilikeContiene('obs_poliza', b),
  ]
    .filter(Boolean)
    .join(',')
}

const PAGINA = 1000

/**
 * Trae todas las pólizas (o las que coinciden con [busqueda]) paginando por
 * id (keyset): exacto aunque entren pólizas nuevas mientras carga.
 */
export async function listarTodasPolizas(
  busqueda = '',
  onProgreso?: (cargadas: number) => void,
  signal?: AbortSignal,
): Promise<PolizaLista[]> {
  const b = busqueda.trim()
  const todas: PolizaLista[] = []
  let ultimoId: number | null = null
  for (;;) {
    let q = db.from(VISTA).select(COLS_LISTA)
    if (b) q = q.or(filtroBusqueda(b))
    if (ultimoId != null) q = q.lt('id', ultimoId)
    q = q.order('id', { ascending: false }).limit(PAGINA)
    if (signal) q = q.abortSignal(signal)
    const { data, error } = await q
    if (error) throw error
    const filas = (data ?? []) as unknown as PolizaLista[]
    todas.push(...filas)
    onProgreso?.(todas.length)
    if (filas.length < PAGINA) break
    ultimoId = filas[filas.length - 1].id
  }
  return todas
}

/** Las [limite] pólizas más recientes (carga rápida de la lista). */
export async function listarPolizasRecientes(limite = 500): Promise<PolizaLista[]> {
  const { data, error } = await db.from(VISTA).select(COLS_LISTA).order('id', { ascending: false }).limit(limite)
  if (error) throw error
  return (data ?? []) as unknown as PolizaLista[]
}

/** Las pólizas indicadas, con las columnas de la lista (para refrescar filas puntuales). */
export async function listarPolizasPorIds(ids: number[]): Promise<PolizaLista[]> {
  if (!ids.length) return []
  const { data, error } = await db.from(VISTA).select(COLS_LISTA).in('id', ids)
  if (error) throw error
  return (data ?? []) as unknown as PolizaLista[]
}

/** Póliza completa (todas las columnas y los nombres de sus relaciones). */
export async function obtenerPoliza(id: number): Promise<Poliza | null> {
  const { data, error } = await db.from(VISTA).select().eq('id', id).maybeSingle()
  if (error) throw error
  return data as Poliza | null
}

export async function listarPolizasDeCliente(clienteId: number): Promise<PolizaLista[]> {
  const { data, error } = await db
    .from(VISTA)
    .select(COLS_LISTA)
    .eq('cliente_id', clienteId)
    .order('fcreado', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as PolizaLista[]
}

/** Solo las pólizas cuyo número está repetido en la misma aseguradora. */
export async function listarPolizasDuplicadas(): Promise<PolizaLista[]> {
  const { data, error } = await db.from('vw_polizas_duplicadas').select(COLS_LISTA)
  if (error) throw error
  return (data ?? []) as unknown as PolizaLista[]
}

/** Pólizas cuyo número contiene [fragmento] (el filtro fino lo hace el matching). */
export async function listarPolizasPorNroContiene(fragmento: string, limite = 200): Promise<PolizaLista[]> {
  const f = normalizarAlfanumerico(fragmento)
  if (!f) return []
  const { data, error } = await db
    .from(VISTA)
    .select(COLS_LISTA)
    .ilike('nro_poliza', `%${f}%`)
    .order('id', { ascending: false })
    .limit(limite)
  if (error) throw error
  return (data ?? []) as unknown as PolizaLista[]
}

/**
 * ¿Ya existe ese número en la misma aseguradora? Compara normalizado
 * ("1-0987-2" = "1 0987 2" = "109872"). Dos aseguradoras distintas sí
 * pueden usar el mismo número.
 */
export async function existeNroPoliza(nro: string, aseguradoraId?: number | null, excluirId?: number | null) {
  const norm = normalizarAlfanumerico(nro)
  if (!norm) return false
  let q = db.from(TABLA).select('id').eq('nro_poliza_norm', norm)
  if (aseguradoraId != null) q = q.eq('aseg_id', aseguradoraId)
  if (excluirId != null) q = q.neq('id', excluirId)
  const { data, error } = await q.limit(1)
  if (error) throw error
  return (data ?? []).length > 0
}

/** Código que tendrá la próxima póliza (solo de referencia: el real lo asigna la base). */
export async function siguienteIdPoliza(): Promise<number> {
  const { data, error } = await db.from(TABLA).select('id').order('id', { ascending: false }).limit(1)
  if (error) throw error
  return ((data?.[0]?.id as number | undefined) ?? 0) + 1
}

export type DatosPoliza = Partial<Omit<PolizaBase, 'id' | 'fcreado' | 'fultmod'>>

const ENTEROS_OPCIONALES = new Set([
  'cliente_id', 'asesor_id', 'ramo_id', 'producto_id', 'intermediario_id', 'agencia_id',
  'forma_pago_id', 'asesor2_id', 'asesor3_id', 'asesorad_id', 'agenciaad_id', 'formaexp_id',
  'aseg_id', 'usuario_id',
])

/** Textos vacíos → null, ids en 0 → null, número de póliza con guiones. */
function limpiar(datos: DatosPoliza): Record<string, unknown> {
  const limpio: Record<string, unknown> = {}
  for (const [k, v0] of Object.entries(datos)) {
    let v: unknown = v0
    if (typeof v === 'string') {
      v = v.trim()
      if (v === '') v = null
    }
    if (k === 'nro_poliza' && typeof v === 'string') v = v.replace(/\s+/g, '-')
    if (ENTEROS_OPCIONALES.has(k) && (v === 0 || v === '0')) v = null
    limpio[k] = v
  }
  return limpio
}

/** Crea la póliza y devuelve el id real que asignó la base. */
export async function crearPoliza(datos: DatosPoliza): Promise<number> {
  const { data, error } = await db.from(TABLA).insert(limpiar(datos)).select('id').single()
  if (error) throw error
  return (data as { id: number }).id
}

/** La póliza ya no es visible: la marcaron para eliminar o la borró otra persona. */
export class PolizaNoDisponibleError extends Error {
  readonly polizaId: number
  constructor(polizaId: number) {
    super(
      'La póliza ya no está disponible: fue marcada para eliminar o borrada por otra persona. Recargue la lista.',
    )
    this.name = 'PolizaNoDisponibleError'
    this.polizaId = polizaId
  }
}

/**
 * Actualiza la póliza. Con cero filas afectadas (la base oculta las marcadas
 * para eliminar) lanza [PolizaNoDisponibleError] en vez de dar por guardado un
 * cambio que no se aplicó; quien llama debe quitarla de la caché.
 */
export async function actualizarPoliza(id: number, datos: DatosPoliza) {
  const { data, error } = await db.from(TABLA).update(limpiar(datos)).eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new PolizaNoDisponibleError(id)
}
