// Lógica pura de las facturas (cuentas de cobro) de los reportes de comisiones.
// La misma fórmula vive en la base (factura_montos); aquí sirve para mostrar el
// resultado mientras se escribe y para probarla sin red.

export const ESTADOS_FACTURA = ['A', 'C', 'R', 'P', 'N'] as const
export type EstadoFactura = (typeof ESTADOS_FACTURA)[number]

export const NOMBRE_ESTADO_FACTURA: Record<EstadoFactura, string> = {
  A: 'Abierta',
  C: 'Cerrada',
  R: 'Revisada',
  P: 'Pagada',
  N: 'Anulada',
}

export const nombreEstadoFactura = (e: string | null | undefined) =>
  e ? NOMBRE_ESTADO_FACTURA[e as EstadoFactura] ?? e : ''

/** Pagada o anulada: ya no se tocan las líneas ni los montos. */
export const facturaCerradaParaEditar = (e: string) => e === 'P' || e === 'N'

export interface Factura {
  id: number
  prefijo: number
  numFactura: number
  fecha: string
  asegId: number | null
  intermId: number | null
  empresaId: number | null
  observacion: string | null
  subtotal: number
  ivaPct: number
  iva: number
  retefuentePct: number
  retefuente: number
  icaPct: number
  ica: number
  total: number
  neto: number
  estado: EstadoFactura
  usuarioId: number | null
  nombreAseg: string | null
  nombreInterm: string | null
  empresaNombre: string | null
  empresaNit: string | null
}

export interface EmpresaAseguradora {
  id: number
  asegId: number | null
  nombre: string
  nit: string
  activa: boolean
}

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const numONull = (v: unknown) => (v == null || v === '' ? null : num(v))
const txt = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v : null)

export function facturaDesdeFila(raw: unknown): Factura {
  const m = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const aseg = (m.aseg ?? null) as Record<string, unknown> | null
  const interm = (m.interm ?? null) as Record<string, unknown> | null
  const empresa = (m.empresa ?? null) as Record<string, unknown> | null
  const estado = String(m.estado ?? 'A') as EstadoFactura
  return {
    id: num(m.id),
    prefijo: num(m.prefijo) || 1,
    numFactura: num(m.num_factura),
    fecha: String(m.fecha ?? '').slice(0, 10),
    asegId: numONull(m.aseg_id),
    intermId: numONull(m.interm_id),
    empresaId: numONull(m.empresa_id),
    observacion: txt(m.observacion),
    subtotal: num(m.subtotal),
    ivaPct: num(m.iva_pct),
    iva: num(m.iva),
    retefuentePct: num(m.retefuente_pct),
    retefuente: num(m.retefuente),
    icaPct: num(m.ica_pct),
    ica: num(m.ica),
    total: num(m.total),
    neto: num(m.neto),
    estado: ESTADOS_FACTURA.includes(estado) ? estado : 'A',
    usuarioId: numONull(m.usuario_id),
    nombreAseg: txt(aseg?.nombre_aseg),
    nombreInterm: txt(interm?.nombre_interm),
    empresaNombre: txt(empresa?.nombre),
    empresaNit: txt(empresa?.nit),
  }
}

export function empresaDesdeFila(raw: unknown): EmpresaAseguradora {
  const m = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    id: num(m.id),
    asegId: numONull(m.aseg_id),
    nombre: String(m.nombre ?? ''),
    nit: String(m.nit ?? ''),
    activa: m.activa !== false,
  }
}

/** Número como se muestra: "1413" con el prefijo 1 y "2-1413" con otro. */
export const numeroFactura = (prefijo: number, num: number) => (prefijo === 1 ? String(num) : `${prefijo}-${num}`)

const redondear2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export interface Montos {
  iva: number
  total: number
  retefuente: number
  ica: number
  neto: number
}

/**
 * total = subtotal + IVA;  neto (valor a consignar) = total − retención − ICA.
 * Igual que factura_montos() en la base.
 */
export function calcularMontos(subtotal: number, ivaPct: number, retePct: number, icaPct: number): Montos {
  const iva = redondear2((subtotal * ivaPct) / 100)
  const retefuente = redondear2((subtotal * retePct) / 100)
  const ica = redondear2((subtotal * icaPct) / 100)
  const total = redondear2(subtotal + iva)
  return { iva, total, retefuente, ica, neto: redondear2(total - retefuente - ica) }
}

/** Un porcentaje válido es un número entre 0 y 100. */
export const porcentajeValido = (p: number | null | undefined): p is number =>
  typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 100

interface LineaFacturable {
  idfactura: number | null
  estado_pago: string
  vlrcomision: number | null
  vlrcomad: number | null
}

/** Una línea se puede facturar si no está en otra factura ni está anulada. */
export const lineaFacturable = (a: Pick<LineaFacturable, 'idfactura' | 'estado_pago'>) =>
  a.idfactura == null && a.estado_pago !== 'A'

/** Lo que aporta una línea al subtotal: comisión + comisión adicional. */
export const comisionDeLinea = (a: Pick<LineaFacturable, 'vlrcomision' | 'vlrcomad'>) =>
  (a.vlrcomision ?? 0) + (a.vlrcomad ?? 0)

export const subtotalDeLineas = (lineas: Pick<LineaFacturable, 'vlrcomision' | 'vlrcomad' | 'estado_pago'>[]) =>
  redondear2(lineas.filter((l) => l.estado_pago !== 'A').reduce((s, l) => s + comisionDeLinea(l), 0))

export interface LineaPendiente {
  id: number
  idrep_pago: number | null
  vlrcomision: number | null
  vlrcomad: number | null
  reporteFecha: string | null
  reporteAsegId: number | null
  reporteIntermId: number | null
}

export interface GrupoPorFacturar {
  reporteId: number
  fecha: string | null
  asegId: number | null
  intermId: number | null
  lineas: number
  comision: number
}

/** Líneas sin facturar → un renglón por reporte, el más reciente primero. */
export function agruparPorReporte(lineas: LineaPendiente[]): GrupoPorFacturar[] {
  const mapa = new Map<number, GrupoPorFacturar>()
  for (const l of lineas) {
    if (l.idrep_pago == null) continue
    const g = mapa.get(l.idrep_pago) ?? {
      reporteId: l.idrep_pago,
      fecha: l.reporteFecha,
      asegId: l.reporteAsegId,
      intermId: l.reporteIntermId,
      lineas: 0,
      comision: 0,
    }
    g.lineas += 1
    g.comision = redondear2(g.comision + comisionDeLinea(l))
    mapa.set(l.idrep_pago, g)
  }
  return [...mapa.values()].sort((a, b) => b.reporteId - a.reporteId)
}

/** Empresas que se ofrecen para una factura: las de esa aseguradora primero. */
export function empresasParaAseguradora(empresas: EmpresaAseguradora[], asegId: number | null) {
  const activas = empresas.filter((e) => e.activa)
  return [...activas].sort((a, b) => {
    const da = a.asegId === asegId ? 0 : 1
    const db = b.asegId === asegId ? 0 : 1
    return da - db || a.nombre.localeCompare(b.nombre, 'es')
  })
}

export interface ErroresFactura {
  fecha?: string
  porcentajes?: string
  lineas?: string
}

export function validarFactura(f: {
  fecha: Date | null
  ivaPct: number | null
  retePct: number | null
  icaPct: number | null
  lineasElegidas: number
}): ErroresFactura {
  const e: ErroresFactura = {}
  if (!f.fecha) e.fecha = 'Requerida'
  if (![f.ivaPct, f.retePct, f.icaPct].every(porcentajeValido)) e.porcentajes = 'Los porcentajes deben estar entre 0 y 100.'
  if (f.lineasElegidas <= 0) e.lineas = 'Elija al menos una línea.'
  return e
}
