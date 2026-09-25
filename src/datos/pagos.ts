import { ilikeContiene } from '@/lib/filtros'
import { usuarioId } from '@/lib/sesion'
import { db } from '@/lib/supabase'

// Reportes de comisiones (reportes_pago) y sus abonos (abonos_poliza).
// Lo pagado de cada póliza, su paso a/desde COMPLETA y los totales de cada
// reporte los calcula la base (triggers y vista vw_reportes_resumen) en la
// misma operación que crea, edita o borra el abono: la app no los recalcula.

export const ESTADOS_PAGO: Record<string, string> = {
  I: 'Incompleta',
  C: 'Completa',
  R: 'Revisada',
  V: 'Vencida',
  A: 'Anulada',
}
export const etiquetaEstadoPago = (e: string | null | undefined) => (e ? ESTADOS_PAGO[e] ?? e : '')

export interface ReportePago {
  id: number
  fecha_rep: string
  aseg_id: number | null
  interm_id: number | null
  fini_rep: string | null
  ffin_rep: string | null
  /** Totales escritos en la cabecera (lo que dice el documento). */
  vlrprima_rep: number | null
  vlrcom_rep: number | null
  /** Totales calculados por la base a partir de los abonos (sin anulados). */
  vlrsumprima_rep: number | null
  vlrsumcom_rep: number | null
  estado_rep: string
  obs_rep: string | null
  usuario_id: number | null
  fcreado: string | null
  fultmod: string | null
  nombre_aseg: string | null
  nombre_interm: string | null
  num_abonos: number | null
}

export interface AbonoPoliza {
  id: number
  idrep_pago: number | null
  id_poliza: number
  fecha_pago: string | null
  vlrprima_poliza: number | null
  vlrabono_prima: number | null
  porccomision: number | null
  vlrcomision: number | null
  porccomad: number | null
  vlrcomad: number | null
  idfactura: number | null
  num_factura: string | null
  estado_pago: string
  obs_pago: string | null
  usuario_id: number | null
  fcreado: string | null
  fultmod: string | null
  // Desde vw_abonos_detalle
  nro_poliza: string | null
  prima_poliza: number | null
  bien_asegurado: string | null
  fini_poliza: string | null
  ffin_poliza: string | null
  estado_poliza_id: string | null
  nombre_cliente: string | null
  doc_cliente: string | null
  tipodoc_cliente: string | null
  tel_cliente: string | null
  correo_cliente: string | null
  dir_cliente: string | null
  nombre_ramo: string | null
  nombre_prod: string | null
  nombre_aseg: string | null
  apodo_usuario: string | null
  nombre_usuario: string | null
}

/** Columnas propias de abonos_poliza que se pueden escribir. */
export type DatosAbono = Partial<
  Pick<
    AbonoPoliza,
    | 'idrep_pago' | 'id_poliza' | 'fecha_pago' | 'vlrprima_poliza' | 'vlrabono_prima' | 'porccomision'
    | 'vlrcomision' | 'porccomad' | 'vlrcomad' | 'idfactura' | 'num_factura' | 'estado_pago' | 'obs_pago'
  >
>

export type DatosReporte = Partial<
  Pick<ReportePago, 'fecha_rep' | 'aseg_id' | 'interm_id' | 'fini_rep' | 'ffin_rep' | 'vlrprima_rep' | 'vlrcom_rep' | 'estado_rep' | 'obs_rep'>
>

const VISTA_REPORTES = 'vw_reportes_resumen'
const VISTA_ABONOS = 'vw_abonos_detalle'

const COLS_REPORTE =
  'id, fecha_rep, aseg_id, interm_id, fini_rep, ffin_rep, vlrprima_rep, vlrsumprima_rep, vlrcom_rep, ' +
  'vlrsumcom_rep, estado_rep, obs_rep, usuario_id, fcreado, fultmod, nombre_aseg, nombre_interm, num_abonos'

const COLS_ABONO =
  'id, idrep_pago, id_poliza, fecha_pago, vlrprima_poliza, vlrabono_prima, porccomision, vlrcomision, porccomad, ' +
  'vlrcomad, idfactura, num_factura, estado_pago, obs_pago, usuario_id, fcreado, fultmod, nro_poliza, prima_poliza, ' +
  'bien_asegurado, fini_poliza, ffin_poliza, estado_poliza_id, nombre_cliente, doc_cliente, tipodoc_cliente, ' +
  'tel_cliente, correo_cliente, dir_cliente, nombre_ramo, nombre_prod, nombre_aseg, apodo_usuario, nombre_usuario'

// ── Reportes ────────────────────────────────────────────────────────────────

export async function listarReportes(busqueda = '', limite = 300): Promise<ReportePago[]> {
  const q = busqueda.trim()
  let req = db.from(VISTA_REPORTES).select(COLS_REPORTE)
  if (q) req = req.or(`${ilikeContiene('nombre_aseg', q)},${ilikeContiene('nombre_interm', q)}`)
  const { data, error } = await req.order('fecha_rep', { ascending: false }).limit(limite)
  if (error) throw error
  return (data ?? []) as unknown as ReportePago[]
}

export async function obtenerReporte(id: number): Promise<ReportePago | null> {
  const { data, error } = await db.from(VISTA_REPORTES).select(COLS_REPORTE).eq('id', id).maybeSingle()
  if (error) throw error
  return data as unknown as ReportePago | null
}

export async function crearReporte(datos: DatosReporte): Promise<number> {
  const { data, error } = await db
    .from('reportes_pago')
    .insert({ ...datos, usuario_id: usuarioId() })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: number }).id
}

export async function actualizarReporte(id: number, datos: DatosReporte) {
  const { error } = await db.from('reportes_pago').update(datos).eq('id', id)
  if (error) throw error
}

export async function eliminarReporte(id: number) {
  const { error } = await db.from('reportes_pago').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') throw new Error('No se puede eliminar: el reporte tiene abonos. Elimínelos primero.')
    throw error
  }
}

// ── Abonos ──────────────────────────────────────────────────────────────────

export async function listarAbonosDeReporte(idReporte: number): Promise<AbonoPoliza[]> {
  const { data, error } = await db
    .from(VISTA_ABONOS)
    .select(COLS_ABONO)
    .eq('idrep_pago', idReporte)
    .order('id', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as AbonoPoliza[]
}

export async function listarAbonosDePoliza(idPoliza: number): Promise<AbonoPoliza[]> {
  const { data, error } = await db
    .from(VISTA_ABONOS)
    .select(COLS_ABONO)
    .eq('id_poliza', idPoliza)
    .order('fecha_pago', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as AbonoPoliza[]
}

export async function obtenerAbono(id: number): Promise<AbonoPoliza | null> {
  const { data, error } = await db.from(VISTA_ABONOS).select(COLS_ABONO).eq('id', id).maybeSingle()
  if (error) throw error
  return data as unknown as AbonoPoliza | null
}

export async function crearAbono(datos: DatosAbono): Promise<number> {
  const { data, error } = await db
    .from('abonos_poliza')
    .insert({ ...datos, usuario_id: usuarioId() })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: number }).id
}

export async function actualizarAbono(id: number, datos: DatosAbono) {
  const { error } = await db.from('abonos_poliza').update(datos).eq('id', id)
  if (error) throw error
}

export async function eliminarAbono(id: number) {
  const { error } = await db.from('abonos_poliza').delete().eq('id', id)
  if (error) throw error
}
