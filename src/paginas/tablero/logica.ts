// Lógica pura del Tablero unificado (recrea y mejora el Power BI de la agencia):
// filtros de selección múltiple, fechas relativas, agrupación por cinco dimensiones y totales.
// Sin React: se prueba con vitest en logica.test.ts.

import { renovadasAutomaticamente, type PolizaClave } from '@/datos/vencimientosLogica'
import { diasEntre, fmtFecha, sumarAnios } from '@/lib/fechas'
import type { PolizaLista } from '@/lib/tipos'
import { SIN_RANGO, enRango, esAnulada, type EstadoVigencia, type FilaReporte, type RangoFechas } from '@/paginas/reportes/calculos'

export type DimTablero = 'aseg' | 'ramo' | 'prod' | 'asesor' | 'cliente'

export const DIMENSIONES: { id: DimTablero; texto: string; plural: string }[] = [
  { id: 'aseg', texto: 'Aseguradora', plural: 'Aseguradoras' },
  { id: 'ramo', texto: 'Ramo', plural: 'Ramos' },
  { id: 'prod', texto: 'Producto', plural: 'Productos' },
  { id: 'asesor', texto: 'Asesor', plural: 'Asesores' },
  { id: 'cliente', texto: 'Cliente', plural: 'Clientes' },
]

const SIN: Record<DimTablero, string> = {
  aseg: 'Sin aseguradora',
  ramo: 'Sin ramo',
  prod: 'Sin producto',
  asesor: 'Sin asesor',
  cliente: 'Sin cliente',
}

const nombreDe: Record<DimTablero, (p: PolizaLista) => string | null> = {
  aseg: (p) => p.nombre_aseg,
  ramo: (p) => p.nombre_ramo,
  prod: (p) => p.nombre_prod,
  asesor: (p) => p.nombre_asesor,
  cliente: (p) => p.nombre_cliente,
}

export const etiquetaDim = (dim: DimTablero, p: PolizaLista): string => nombreDe[dim](p)?.trim() || SIN[dim]

// ── Fechas relativas ("Siguiente 12 meses") ─────────────────────────────────

export type Sentido = 'siguiente' | 'anterior' | 'este'
export type Unidad = 'dias' | 'semanas' | 'meses' | 'anios'
export interface FechaRelativa {
  sentido: Sentido
  n: number
  unidad: Unidad
}

export const UNIDADES: { id: Unidad; texto: string }[] = [
  { id: 'dias', texto: 'Días' },
  { id: 'semanas', texto: 'Semanas' },
  { id: 'meses', texto: 'Meses' },
  { id: 'anios', texto: 'Años' },
]

function sumar(d: Date, n: number, u: Unidad): Date {
  if (u === 'dias') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
  if (u === 'semanas') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * n)
  const r = new Date(d.getFullYear(), d.getMonth() + (u === 'anios' ? 12 * n : n), d.getDate())
  // 31 de enero + 1 mes → último día del mes siguiente, no marzo.
  const mesEsperado = (((d.getMonth() + (u === 'anios' ? 12 * n : n)) % 12) + 12) % 12
  return r.getMonth() !== mesEsperado ? new Date(r.getFullYear(), r.getMonth(), 0) : r
}

const menosUnDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)

/**
 * Rango de una fecha relativa. "Siguiente 12 meses" desde el 19/11/2026 es 19/11/2026 – 18/11/2027
 * (igual que el Power BI); "Anterior N" termina ayer; "Este" es la semana, el mes o el año en curso.
 */
export function rangoRelativo(r: FechaRelativa, hoy: Date): RangoFechas {
  const n = Math.max(1, Math.floor(r.n) || 1)
  if (r.sentido === 'siguiente') return { desde: hoy, hasta: menosUnDia(sumar(hoy, n, r.unidad)) }
  if (r.sentido === 'anterior') return { desde: sumar(hoy, -n, r.unidad), hasta: menosUnDia(hoy) }
  if (r.unidad === 'dias') return { desde: hoy, hasta: hoy }
  if (r.unidad === 'semanas') {
    const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7))
    return { desde: lunes, hasta: new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6) }
  }
  if (r.unidad === 'meses') return { desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1), hasta: new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0) }
  return { desde: new Date(hoy.getFullYear(), 0, 1), hasta: new Date(hoy.getFullYear(), 11, 31) }
}

export function textoRelativa(r: FechaRelativa): string {
  const u = UNIDADES.find((x) => x.id === r.unidad)!.texto.toLowerCase()
  if (r.sentido === 'este') return `Este ${r.unidad === 'dias' ? 'día' : r.unidad === 'semanas' ? 'semana' : r.unidad === 'meses' ? 'mes' : 'año'}`
  return `${r.sentido === 'siguiente' ? 'Siguientes' : 'Anteriores'} ${r.n} ${u}`
}

// ── Filtros ─────────────────────────────────────────────────────────────────

export type FiltroOrigen = 'todos' | 'manual' | 'ia' | 'masiva' | 'sin'

export interface FiltrosTablero {
  aseg: string[]
  ramo: string[]
  prod: string[]
  asesor: string[]
  cliente: string[]
  /** Años de la fecha de inicio elegidos (jerarquía año → mes). */
  anios: number[]
  /** Meses de la fecha de inicio elegidos, "AAAA-MM". */
  meses: string[]
  fini: RangoFechas
  ffinRango: RangoFechas
  ffinRel: FechaRelativa | null
  bien: string
  busqueda: string
  estado: EstadoVigencia
  incluirAnuladas: boolean
  /** Como el Power BI: con un rango de fecha de inicio activo, las pólizas sin fecha de inicio salen. Aquí se puede pedir sin rango. */
  soloConInicio: boolean
  /** Cómo se cargó la póliza ('sin' = las anteriores, sin dato). */
  origen: FiltroOrigen
}

export const FILTROS_TABLERO_VACIOS: FiltrosTablero = {
  aseg: [],
  ramo: [],
  prod: [],
  asesor: [],
  cliente: [],
  anios: [],
  meses: [],
  fini: SIN_RANGO,
  ffinRango: SIN_RANGO,
  ffinRel: null,
  bien: '',
  busqueda: '',
  estado: 'todas',
  incluirAnuladas: false,
  soloConInicio: false,
  origen: 'todos',
}

export const claveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** Cantidad de filtros activos (para el botón "Limpiar"). */
export function contarActivos(f: FiltrosTablero): number {
  const r = (x: RangoFechas) => (x.desde || x.hasta ? 1 : 0)
  return (
    (f.aseg.length ? 1 : 0) + (f.ramo.length ? 1 : 0) + (f.prod.length ? 1 : 0) + (f.asesor.length ? 1 : 0) + (f.cliente.length ? 1 : 0) +
    (f.anios.length || f.meses.length ? 1 : 0) + r(f.fini) + (f.ffinRel || r(f.ffinRango) ? 1 : 0) +
    (f.bien.trim() ? 1 : 0) + (f.busqueda.trim() ? 1 : 0) + (f.estado !== 'todas' ? 1 : 0) + (f.incluirAnuladas ? 1 : 0) + (f.soloConInicio ? 1 : 0) + (f.origen !== 'todos' ? 1 : 0)
  )
}

/** Rango efectivo de la fecha de vencimiento (el relativo manda sobre el rango manual). */
export const rangoVencimiento = (f: FiltrosTablero, hoy: Date): RangoFechas => (f.ffinRel ? rangoRelativo(f.ffinRel, hoy) : f.ffinRango)

const sinTildes = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function coincideBusqueda(p: PolizaLista, q: string): boolean {
  const t = sinTildes(q)
  const id = /^\d+$/.test(q.trim()) ? Number(q) : null
  const doc = t.replace(/\./g, '')
  const tiene = (s: string | null) => sinTildes(s ?? '').includes(t)
  return (
    (id != null && p.id === id) ||
    tiene(p.nro_poliza) || tiene(p.nombre_cliente) || (!!doc && (p.doc_cliente ?? '').toLowerCase().includes(doc)) ||
    tiene(p.nombre_aseg) || tiene(p.nombre_ramo) || tiene(p.nombre_prod) || tiene(p.nombre_asesor) || tiene(p.bien_asegurado)
  )
}

/** Aplica todos los filtros; [sin] omite una dimensión (para armar las opciones de ese filtro). */
export function filtrarTablero(filas: FilaReporte[], f: FiltrosTablero, hoy: Date, sin?: DimTablero): FilaReporte[] {
  const tHoy = hoy.getTime()
  const rv = rangoVencimiento(f, hoy)
  const anios = new Set(f.anios)
  const meses = new Set(f.meses)
  const listas: [DimTablero, Set<string>][] = (['aseg', 'ramo', 'prod', 'asesor', 'cliente'] as DimTablero[])
    .filter((d) => d !== sin && f[d].length > 0)
    .map((d) => [d, new Set(f[d])])
  const bien = sinTildes(f.bien.trim())
  const busqueda = f.busqueda.trim()
  return filas.filter((r) => {
    const p = r.p
    if (!f.incluirAnuladas && esAnulada(p)) return false
    for (const [d, set] of listas) if (!set.has(etiquetaDim(d, p))) return false
    if (anios.size || meses.size) {
      if (!r.fini) return false
      if (!anios.has(r.fini.getFullYear()) && !meses.has(claveMes(r.fini))) return false
    }
    if (f.soloConInicio && !r.fini) return false
    if (f.origen === 'sin' ? !!p.origen : f.origen !== 'todos' && p.origen !== f.origen) return false
    if (!enRango(r.fini, f.fini)) return false
    if (!enRango(r.ffin, rv)) return false
    if (bien && !sinTildes(p.bien_asegurado ?? '').includes(bien)) return false
    if (busqueda && !coincideBusqueda(p, busqueda)) return false
    if (f.estado === 'vigentes' && (!r.ffin || r.ffin.getTime() < tHoy)) return false
    if (f.estado === 'vencidas' && (!r.ffin || r.ffin.getTime() >= tHoy)) return false
    if (f.estado === 'sinFecha' && r.ffin) return false
    return true
  })
}

/** Opciones de un filtro: las que existen con los demás filtros aplicados (como los filtros cruzados de Power BI). */
export function opcionesTablero(filas: FilaReporte[], f: FiltrosTablero, hoy: Date, dim: DimTablero): { nombre: string; n: number }[] {
  const cuenta = new Map<string, number>()
  for (const r of filtrarTablero(filas, f, hoy, dim)) {
    const k = etiquetaDim(dim, r.p)
    cuenta.set(k, (cuenta.get(k) ?? 0) + 1)
  }
  return [...cuenta].map(([nombre, n]) => ({ nombre, n })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** Años y meses de inicio que existen (más reciente primero), con cuántas pólizas hay en cada uno. */
export function arbolAnioMes(filas: FilaReporte[]): { anio: number; n: number; meses: { clave: string; mes: number; n: number }[] }[] {
  const porAnio = new Map<number, Map<number, number>>()
  for (const r of filas) {
    if (!r.fini) continue
    const a = r.fini.getFullYear()
    const m = r.fini.getMonth()
    const mm = porAnio.get(a) ?? new Map<number, number>()
    mm.set(m, (mm.get(m) ?? 0) + 1)
    porAnio.set(a, mm)
  }
  return [...porAnio]
    .sort((a, b) => b[0] - a[0])
    .map(([anio, mm]) => ({
      anio,
      n: [...mm.values()].reduce((s, x) => s + x, 0),
      meses: [...mm].sort((a, b) => a[0] - b[0]).map(([mes, n]) => ({ clave: `${anio}-${String(mes + 1).padStart(2, '0')}`, mes, n })),
    }))
}

// ── Totales y agrupación ────────────────────────────────────────────────────

export const valorDe = (r: FilaReporte) => r.p.valor_poliza ?? 0

export interface Totales {
  registros: number
  valor: number
  prima: number
}

export function totales(filas: FilaReporte[]): Totales {
  let valor = 0
  let prima = 0
  for (const r of filas) {
    valor += valorDe(r)
    prima += r.prima
  }
  return { registros: filas.length, valor, prima }
}

export interface GrupoTablero {
  nombre: string
  registros: number
  valor: number
  prima: number
  /** Participación en el total (0–1). */
  pesoValor: number
  pesoPrima: number
}

export type Medida = 'valor' | 'prima' | 'registros'

export const MEDIDAS: { id: Medida; texto: string }[] = [
  { id: 'valor', texto: 'Valor póliza' },
  { id: 'prima', texto: 'Prima' },
  { id: 'registros', texto: 'Registros' },
]

export function agruparTablero(filas: FilaReporte[], dim: DimTablero, medida: Medida = 'valor'): GrupoTablero[] {
  const m = new Map<string, { registros: number; valor: number; prima: number }>()
  for (const r of filas) {
    const k = etiquetaDim(dim, r.p)
    const g = m.get(k) ?? { registros: 0, valor: 0, prima: 0 }
    g.registros++
    g.valor += valorDe(r)
    g.prima += r.prima
    m.set(k, g)
  }
  const t = totales(filas)
  return [...m]
    .map(([nombre, g]) => ({ nombre, ...g, pesoValor: t.valor > 0 ? g.valor / t.valor : 0, pesoPrima: t.prima > 0 ? g.prima / t.prima : 0 }))
    .sort((a, b) => b[medida] - a[medida] || a.nombre.localeCompare(b.nombre, 'es'))
}

/** Por año de inicio (para la evolución): valor, prima y registros. */
export function porAnioInicio(filas: FilaReporte[]): { anio: number; registros: number; valor: number; prima: number }[] {
  const m = new Map<number, { registros: number; valor: number; prima: number }>()
  for (const r of filas) {
    if (!r.fini) continue
    const a = r.fini.getFullYear()
    const g = m.get(a) ?? { registros: 0, valor: 0, prima: 0 }
    g.registros++
    g.valor += valorDe(r)
    g.prima += r.prima
    m.set(a, g)
  }
  return [...m].sort((a, b) => a[0] - b[0]).map(([anio, g]) => ({ anio, ...g }))
}

/** Días hasta el vencimiento (negativo = vencida); null sin fecha. */
export const diasVence = (r: FilaReporte, hoy: Date) => (r.ffin ? diasEntre(hoy, r.ffin) : null)

export const aClave = (r: FilaReporte): PolizaClave => ({
  id: r.p.id,
  clienteId: r.p.cliente_id,
  ramoId: r.p.ramo_id,
  bien: r.p.bien_asegurado,
  obs: r.p.obs_poliza,
  asegId: r.p.aseg_id,
  nro: r.p.nro_poliza,
  vence: (r.p.ffin_poliza ?? '').slice(0, 10),
})

/**
 * Pólizas que vencieron en los últimos [dias] días y cuántas de ellas siguen sin renovar: no existe otra
 * póliza posterior del mismo cliente, ramo y bien (placa). Las que no tienen bien asegurado no se pueden
 * cruzar y cuentan como sin renovar. [todas] debe traer las demás pólizas para buscar la renovación.
 */
export function vencidasRecientes(filas: FilaReporte[], todas: FilaReporte[], hoy: Date, dias = 90): { vencidas: number; sinRenovar: number } {
  const recientes = filas.filter((r) => {
    const d = diasVence(r, hoy)
    return d != null && d < 0 && d >= -dias
  })
  if (!recientes.length) return { vencidas: 0, sinRenovar: 0 }
  const renovadas = renovadasAutomaticamente(
    recientes.map(aClave),
    todas.filter((r) => r.ffin && !esAnulada(r.p)).map(aClave),
  )
  return { vencidas: recientes.length, sinRenovar: recientes.length - renovadas.size }
}

// ── Comparación con otro período ────────────────────────────────────────────

export type ModoComparar = 'anterior' | 'anioAnterior'

export interface Comparacion {
  /** "01/01/2025 – 31/12/2025" o "2025". */
  etiqueta: string
  filtros: FiltrosTablero
}

const sumarDiasF = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/**
 * Filtros del período con que comparar. Se puede comparar cuando hay un rango de F. inicio completo
 * (se compara con el mismo largo justo antes, o con las mismas fechas del año anterior) o un solo año
 * escogido (contra el año anterior). Sin período, devuelve null.
 */
export function comparacionDe(f: FiltrosTablero, modo: ModoComparar): Comparacion | null {
  if (f.fini.desde && f.fini.hasta && f.fini.desde <= f.fini.hasta && f.anios.length === 0 && f.meses.length === 0) {
    let desde: Date
    let hasta: Date
    if (modo === 'anioAnterior') {
      desde = sumarAnios(f.fini.desde, -1)
      hasta = sumarAnios(f.fini.hasta, -1)
    } else {
      const n = diasEntre(f.fini.desde, f.fini.hasta) + 1
      hasta = sumarDiasF(f.fini.desde, -1)
      desde = sumarDiasF(hasta, -(n - 1))
    }
    return { etiqueta: `${fmtFecha(desde)} – ${fmtFecha(hasta)}`, filtros: { ...f, fini: { desde, hasta } } }
  }
  if (f.anios.length === 1 && f.meses.length === 0 && !f.fini.desde && !f.fini.hasta) {
    const a = f.anios[0] - 1
    return { etiqueta: String(a), filtros: { ...f, anios: [a] } }
  }
  return null
}

/** Variación porcentual de [actual] contra [previo]; null si no hay base. */
export const variacionPct = (actual: number, previo: number): number | null => (previo > 0 ? ((actual - previo) / previo) * 100 : null)

// ── Hoja de vencimientos del Excel ──────────────────────────────────────────

/** ¿El usuario eligió una ventana en "F. vencimiento" (relativa o rango)? */
export const hayVentanaVencimiento = (f: FiltrosTablero): boolean => !!f.ffinRel || !!f.ffinRango.desde || !!f.ffinRango.hasta

/** Nombre de la hoja de vencimientos del Excel: siempre "Vencimientos". */
export const nombreHojaVencimientos = (): string => 'Vencimientos'

/**
 * Pólizas de la hoja de vencimientos: con ventana elegida, todas las filtradas que tienen fecha de
 * vencimiento (ya están dentro de la ventana); sin ventana, las que vencen en los próximos 12 meses.
 * De la que vence primero a la que vence después.
 */
export function filasHojaVencimientos(filas: FilaReporte[], f: FiltrosTablero, hoy: Date): FilaReporte[] {
  const base = hayVentanaVencimiento(f)
    ? filas.filter((r) => r.ffin)
    : filas.filter((r) => enRango(r.ffin, rangoRelativo({ sentido: 'siguiente', n: 12, unidad: 'meses' }, hoy)))
  return [...base].sort((a, b) => a.ffin!.getTime() - b.ffin!.getTime())
}
