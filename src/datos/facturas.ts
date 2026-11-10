import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/supabase'
import {
  calcularMontos,
  empresaDesdeFila,
  facturaDesdeFila,
  type EmpresaAseguradora,
  type EstadoFactura,
  type Factura,
  type LineaPendiente,
} from './facturasLogica'
import type { AbonoPoliza } from './pagos'

// Facturas (cuentas de cobro) de los reportes de comisiones. Migración:
// 20261111090000_facturas.sql (app Flutter). Las funciones de la base hacen lo
// delicado (número consecutivo, enlazar las líneas, sumar) en una sola operación.

export const CLAVE_FACTURAS = ['facturas'] as const

const COLS_FACTURA = '*, aseg:aseguradoras(nombre_aseg), interm:intermediarios(nombre_interm), empresa:facturas_empresas(nombre, nit)'
const VISTA_ABONOS = 'vw_abonos_detalle'

export const LIMITE_FACTURAS = 2000

export interface FiltrosFacturas {
  estado?: EstadoFactura | null
  desde?: string | null
  hasta?: string | null
}

export async function listarFacturas({ estado = null, desde = null, hasta = null }: FiltrosFacturas = {}): Promise<Factura[]> {
  let q = db.from('facturas').select(COLS_FACTURA)
  if (estado) q = q.eq('estado', estado)
  if (desde) q = q.gte('fecha', desde)
  if (hasta) q = q.lte('fecha', hasta)
  const { data, error } = await q
    .order('fecha', { ascending: false })
    .order('id', { ascending: false })
    .limit(LIMITE_FACTURAS)
  if (error) throw error
  return ((data ?? []) as unknown[]).map(facturaDesdeFila)
}

export async function obtenerFactura(id: number): Promise<Factura | null> {
  const { data, error } = await db.from('facturas').select(COLS_FACTURA).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? facturaDesdeFila(data) : null
}

/** Líneas (abonos) de una factura, con los datos de la póliza y el cliente. */
export async function listarAbonosDeFactura(idFactura: number): Promise<AbonoPoliza[]> {
  const { data, error } = await db.from(VISTA_ABONOS).select('*').eq('idfactura', idFactura).order('id', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as AbonoPoliza[]
}

/** Detalle de líneas por id (para elegir cuáles entran a una factura). */
export async function listarAbonosPorIds(ids: number[]): Promise<AbonoPoliza[]> {
  if (ids.length === 0) return []
  const { data, error } = await db.from(VISTA_ABONOS).select('*').in('id', ids).order('id', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as AbonoPoliza[]
}

/** Líneas sin factura y no anuladas, con el reporte al que pertenecen (máximo 5.000). */
export async function listarLineasPorFacturar(): Promise<LineaPendiente[]> {
  const { data, error } = await db
    .from('abonos_poliza')
    .select('id, idrep_pago, vlrcomision, vlrcomad, reporte:reportes_pago(fecha_rep, aseg_id, interm_id)')
    .is('idfactura', null)
    .neq('estado_pago', 'A')
    .order('idrep_pago', { ascending: false })
    .limit(5000)
  if (error) throw error
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
    const rep = (r.reporte ?? null) as { fecha_rep?: string; aseg_id?: number; interm_id?: number } | null
    return {
      id: Number(r.id),
      idrep_pago: r.idrep_pago == null ? null : Number(r.idrep_pago),
      vlrcomision: r.vlrcomision == null ? null : Number(r.vlrcomision),
      vlrcomad: r.vlrcomad == null ? null : Number(r.vlrcomad),
      reporteFecha: rep?.fecha_rep ?? null,
      reporteAsegId: rep?.aseg_id ?? null,
      reporteIntermId: rep?.interm_id ?? null,
    }
  })
}

export interface DatosNuevaFactura {
  asegId: number
  intermId: number | null
  empresaId: number | null
  fecha: string
  abonoIds: number[]
  observacion: string
  ivaPct: number
  retePct: number
  icaPct: number
}

/** Crea la factura con las líneas elegidas (todo o nada) y devuelve su id. */
export async function crearFactura(d: DatosNuevaFactura): Promise<number> {
  const { data, error } = await db.rpc('factura_crear', {
    p_aseg_id: d.asegId,
    p_interm_id: d.intermId,
    p_empresa_id: d.empresaId,
    p_fecha: d.fecha,
    p_abono_ids: d.abonoIds,
    p_observacion: d.observacion.trim() || null,
    p_iva_pct: d.ivaPct,
    p_rete_pct: d.retePct,
    p_ica_pct: d.icaPct,
  })
  if (error) throw error
  return Number(data)
}

export async function siguienteNumeroFactura(): Promise<number | null> {
  const { data, error } = await db.rpc('factura_siguiente_numero', { p_prefijo: 1 })
  if (error) throw error
  return data == null ? null : Number(data)
}

export interface CambiosFactura {
  fecha: string
  empresaId: number | null
  observacion: string
  ivaPct: number
  retePct: number
  icaPct: number
  estado: EstadoFactura
}

/** Guarda la cabecera y vuelve a calcular los montos con el subtotal vigente. */
export async function actualizarFactura(f: Factura, c: CambiosFactura) {
  const m = calcularMontos(f.subtotal, c.ivaPct, c.retePct, c.icaPct)
  const { data, error } = await db
    .from('facturas')
    .update({
      fecha: c.fecha,
      empresa_id: c.empresaId,
      observacion: c.observacion.trim() || null,
      iva_pct: c.ivaPct,
      retefuente_pct: c.retePct,
      ica_pct: c.icaPct,
      iva: m.iva,
      retefuente: m.retefuente,
      ica: m.ica,
      total: m.total,
      neto: m.neto,
      estado: c.estado,
    })
    .eq('id', f.id)
    .select('id')
  if (error) throw error
  if (!data?.length) throw new Error('La factura ya no está disponible. Recargue la lista.')
}

export async function recalcularFactura(id: number) {
  const { error } = await db.rpc('factura_recalcular', { p_factura: id })
  if (error) throw error
}

/** Saca líneas de la factura (quedan libres para otra) y vuelve a sumar. */
export async function quitarLineasDeFactura(idFactura: number, abonoIds: number[]) {
  if (abonoIds.length === 0) return
  const { data, error } = await db.from('abonos_poliza').update({ idfactura: null }).in('id', abonoIds).eq('idfactura', idFactura).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Esas líneas ya no están en la factura. Recargue.')
  await recalcularFactura(idFactura)
}

/** Agrega líneas libres a una factura y vuelve a sumar. */
export async function agregarLineasAFactura(idFactura: number, abonoIds: number[]) {
  if (abonoIds.length === 0) return
  const { data, error } = await db.from('abonos_poliza').update({ idfactura: idFactura }).in('id', abonoIds).is('idfactura', null).select('id')
  if (error) throw error
  if (!data?.length || data.length < abonoIds.length) {
    // Alguien más se llevó alguna: se deshace para no dejar la factura a medias.
    if (data?.length) await db.from('abonos_poliza').update({ idfactura: null }).in('id', data.map((x) => x.id))
    throw new Error('Alguna de las líneas ya está en otra factura. Recargue e intente de nuevo.')
  }
  await recalcularFactura(idFactura)
}

/** Solo Administrador (la base lo exige). Las líneas quedan libres. */
export async function eliminarFactura(id: number) {
  const { data, error } = await db.from('facturas').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('No se pudo eliminar: solo un Administrador puede hacerlo.')
}

// ── Porcentajes por defecto ─────────────────────────────────────────────────

export interface ConfigFacturacion {
  ivaPct: number
  retePct: number
  icaPct: number
}

export async function consultarConfigFacturacion(): Promise<ConfigFacturacion> {
  const { data, error } = await db.from('facturacion_config').select('clave, valor')
  if (error) throw error
  const m = new Map(((data ?? []) as { clave: string; valor: number }[]).map((r) => [r.clave, Number(r.valor)]))
  return { ivaPct: m.get('iva_pct') ?? 0, retePct: m.get('retefuente_pct') ?? 10, icaPct: m.get('ica_pct') ?? 0 }
}

export async function guardarConfigFacturacion(c: ConfigFacturacion) {
  const { error } = await db.rpc('facturacion_config_guardar', { p_iva: c.ivaPct, p_rete: c.retePct, p_ica: c.icaPct })
  if (error) throw error
}

export const useConfigFacturacion = () =>
  useQuery({ queryKey: [...CLAVE_FACTURAS, 'config'], queryFn: consultarConfigFacturacion, staleTime: 5 * 60_000 })

// ── Empresas aseguradoras (por NIT) ─────────────────────────────────────────

export async function listarEmpresas(): Promise<EmpresaAseguradora[]> {
  const { data, error } = await db.from('facturas_empresas').select('*').order('nombre', { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown[]).map(empresaDesdeFila)
}

export const useEmpresas = () => useQuery({ queryKey: [...CLAVE_FACTURAS, 'empresas'], queryFn: listarEmpresas, staleTime: 5 * 60_000 })

export async function guardarEmpresa(e: { id?: number; asegId: number | null; nombre: string; nit: string; activa: boolean }) {
  const fila = { aseg_id: e.asegId, nombre: e.nombre.trim(), nit: e.nit.trim(), activa: e.activa }
  const { error } = e.id == null ? await db.from('facturas_empresas').insert(fila) : await db.from('facturas_empresas').update(fila).eq('id', e.id)
  if (error) throw error
}

export async function eliminarEmpresa(id: number) {
  const { error } = await db.from('facturas_empresas').delete().eq('id', id)
  if (error) throw error
}
