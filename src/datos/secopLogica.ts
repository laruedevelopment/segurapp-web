// Lógica pura de "Oportunidades SECOP": consulta a datos.gov.co, cruce con los
// clientes y prioridad. Sin acceso a red ni a la base, para poder probarla.

export const ESTADOS_OPORTUNIDAD = ['nuevo', 'contactado', 'cotizado', 'cerrado', 'descartado'] as const
export type EstadoOportunidad = (typeof ESTADOS_OPORTUNIDAD)[number]

export const NOMBRE_ESTADO: Record<EstadoOportunidad, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  cotizado: 'Cotizado',
  cerrado: 'Cerrado',
  descartado: 'Descartado',
}

/** Departamentos tal como los escribe el SECOP. */
export const DEPARTAMENTOS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca',
  'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Distrito Capital de Bogotá', 'Guainía', 'Guaviare', 'Huila',
  'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda',
  'San Andrés, Providencia y Santa Catalina', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada',
] as const

/** Tipos de contrato más frecuentes (los demás se ven con "Todos"). */
export const TIPOS_CONTRATO = ['Obra', 'Consultoría', 'Suministros', 'Compraventa', 'Prestación de servicios', 'Arrendamiento de inmuebles'] as const

export interface FiltroContratos {
  departamento: string
  /** Contratos firmados en los últimos N días. */
  dias: number
  /** Valor mínimo del contrato, en pesos. */
  valorMin: number
  /** Vacío = todos los tipos. */
  tipos: string[]
  limite?: number
}

export interface ContratoSecop {
  idContrato: string
  entidad: string
  departamento: string
  ciudad: string
  sector: string
  objeto: string
  tipo: string
  modalidad: string
  estado: string
  firma: string | null
  inicio: string | null
  fin: string | null
  proveedor: string
  documento: string
  valor: number
  url: string | null
}

/** Deja solo los dígitos (o null si no hay): "901.833.042-2" → "9018330422". */
export function soloDigitos(v: string | null | undefined): string | null {
  const d = (v ?? '').replace(/\D/g, '')
  return d ? d : null
}

/**
 * ¿Es el mismo documento? El SECOP a veces trae el NIT con el dígito de
 * verificación pegado y a veces sin él: se acepta igual o con un dígito de más.
 */
export function mismoDocumento(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = soloDigitos(a)
  const y = soloDigitos(b)
  if (!x || !y || Math.min(x.length, y.length) < 6) return false
  if (x === y) return true
  const [corto, largo] = x.length < y.length ? [x, y] : [y, x]
  return largo.length - corto.length === 1 && largo.startsWith(corto)
}

/** Índice de documentos de clientes para buscar rápido (con y sin dígito de verificación). */
export function indiceClientes(clientes: { id: number; nombre: string; doc: string | null }[]) {
  const mapa = new Map<string, { id: number; nombre: string }>()
  for (const c of clientes) {
    const d = soloDigitos(c.doc)
    if (!d || d.length < 6) continue
    mapa.set(d, { id: c.id, nombre: c.nombre })
    // Un NIT guardado con su dígito de verificación también se halla sin él.
    if (d.length >= 9) mapa.set(d.slice(0, -1), { id: c.id, nombre: c.nombre })
  }
  return (doc: string | null | undefined) => {
    const d = soloDigitos(doc)
    if (!d) return null
    return mapa.get(d) ?? (d.length >= 9 ? (mapa.get(d.slice(0, -1)) ?? null) : null)
  }
}

const esc = (s: string) => s.replace(/'/g, "''")

const fechaISO = (d: Date) => d.toISOString().slice(0, 10)

/** Parámetros de la consulta a datos.gov.co (SoQL). */
export function parametrosConsulta(f: FiltroContratos, hoy = new Date()): Record<string, string> {
  const desde = new Date(hoy.getTime() - f.dias * 86400000)
  const cond = [`departamento='${esc(f.departamento)}'`, `fecha_de_firma>='${fechaISO(desde)}T00:00:00'`]
  if (f.valorMin > 0) cond.push(`valor_del_contrato>${Math.round(f.valorMin)}`)
  if (f.tipos.length > 0) cond.push(`tipo_de_contrato in (${f.tipos.map((t) => `'${esc(t)}'`).join(',')})`)
  return {
    $select:
      'id_contrato,nombre_entidad,departamento,ciudad,sector,descripcion_del_proceso,tipo_de_contrato,' +
      'modalidad_de_contratacion,estado_contrato,fecha_de_firma,fecha_de_inicio_del_contrato,' +
      'fecha_de_fin_del_contrato,proveedor_adjudicado,documento_proveedor,valor_del_contrato,urlproceso',
    $where: cond.join(' AND '),
    $order: 'fecha_de_firma DESC, valor_del_contrato DESC',
    $limit: String(f.limite ?? 300),
  }
}

const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const fechaOpt = (v: unknown) => (typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : null)

export function contratoDesdeFila(fila: Record<string, unknown>): ContratoSecop | null {
  const id = txt(fila.id_contrato)
  if (!id) return null
  const url = fila.urlproceso
  return {
    idContrato: id,
    entidad: txt(fila.nombre_entidad),
    departamento: txt(fila.departamento),
    ciudad: txt(fila.ciudad),
    sector: txt(fila.sector),
    objeto: txt(fila.descripcion_del_proceso),
    tipo: txt(fila.tipo_de_contrato),
    modalidad: txt(fila.modalidad_de_contratacion),
    estado: txt(fila.estado_contrato),
    firma: fechaOpt(fila.fecha_de_firma),
    inicio: fechaOpt(fila.fecha_de_inicio_del_contrato),
    fin: fechaOpt(fila.fecha_de_fin_del_contrato),
    proveedor: txt(fila.proveedor_adjudicado),
    documento: txt(fila.documento_proveedor),
    valor: Number(fila.valor_del_contrato) || 0,
    url: typeof url === 'object' && url && 'url' in url && typeof (url as { url: unknown }).url === 'string' ? (url as { url: string }).url : null,
  }
}

/** Días desde la firma (0 si es de hoy, null si no hay fecha). */
export function diasDesdeFirma(firma: string | null, hoy = new Date()): number | null {
  if (!firma) return null
  const f = new Date(`${firma}T00:00:00`)
  if (Number.isNaN(f.getTime())) return null
  return Math.max(0, Math.floor((hoy.getTime() - f.getTime()) / 86400000))
}

/** Plazo del contrato en días (null si falta alguna fecha). */
export function plazoDias(inicio: string | null, fin: string | null): number | null {
  if (!inicio || !fin) return null
  const a = new Date(`${inicio}T00:00:00`).getTime()
  const b = new Date(`${fin}T00:00:00`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null
  return Math.round((b - a) / 86400000)
}

/**
 * Qué tan buena es la oportunidad (para ordenar): pesa el valor del contrato y
 * lo reciente que es, porque la póliza se compra en los primeros días.
 */
export function puntaje(c: Pick<ContratoSecop, 'valor' | 'firma' | 'tipo'>, hoy = new Date()): number {
  const dias = diasDesdeFirma(c.firma, hoy) ?? 60
  const frescura = dias <= 3 ? 3 : dias <= 10 ? 2 : dias <= 30 ? 1 : 0
  const valor = c.valor >= 1e9 ? 4 : c.valor >= 3e8 ? 3 : c.valor >= 1e8 ? 2 : c.valor >= 3e7 ? 1 : 0
  // Obra y consultoría casi siempre exigen varias garantías.
  const tipo = c.tipo === 'Obra' || c.tipo === 'Consultoría' ? 1 : 0
  return frescura * 3 + valor * 2 + tipo
}

/** Texto corto: "3 millones", "1.250 millones". */
export function dineroCorto(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toLocaleString('es-CO', { maximumFractionDigits: 1 })} mil millones`
  if (n >= 1e6) return `$${Math.round(n / 1e6).toLocaleString('es-CO')} millones`
  return `$${Math.round(n).toLocaleString('es-CO')}`
}
