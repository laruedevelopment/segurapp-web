// Lógica pura del tablero de reportes (misma de lib/ui/pagina_reportes.dart).
// Sin React: se prueba con vitest en calculos.test.ts.

import { aFecha, aFechaHora, diasEntre } from '@/lib/fechas'
import type { PolizaLista } from '@/lib/tipos'

export interface RangoFechas {
  desde: Date | null
  hasta: Date | null
}

export const SIN_RANGO: RangoFechas = { desde: null, hasta: null }

export type EstadoVigencia = 'todas' | 'vigentes' | 'vencidas' | 'sinFecha'

export interface FiltrosReporte {
  busqueda: string
  cliente: string
  aseg: string | null
  ramo: string | null
  asesor: string | null
  prod: string | null
  estado: EstadoVigencia
  ffin: RangoFechas
  freg: RangoFechas
  fexp: RangoFechas
  /** Las anuladas no cuentan como vigentes ni suman prima, salvo que se pidan. */
  incluirAnuladas: boolean
}

export const FILTROS_VACIOS: FiltrosReporte = {
  busqueda: '',
  cliente: '',
  aseg: null,
  ramo: null,
  asesor: null,
  prod: null,
  estado: 'todas',
  ffin: SIN_RANGO,
  freg: SIN_RANGO,
  fexp: SIN_RANGO,
  incluirAnuladas: false,
}

/** Póliza con sus fechas ya convertidas (se hace una sola vez por carga). */
export interface FilaReporte {
  p: PolizaLista
  fini: Date | null
  ffin: Date | null
  fexp: Date | null
  /** Fecha y hora real de registro (hora local). */
  fcreado: Date | null
  fultmod: Date | null
  prima: number
}

export function prepararFilas(polizas: PolizaLista[]): FilaReporte[] {
  return polizas.map((p) => ({
    p,
    fini: aFecha(p.fini_poliza),
    ffin: aFecha(p.ffin_poliza),
    fexp: aFecha(p.fexp_poliza),
    fcreado: aFechaHora(p.fcreado),
    fultmod: aFechaHora(p.fultmod),
    prima: p.prima_poliza ?? 0,
  }))
}

// Etiqueta de agrupación y de filtro: la misma para las dos cosas, así al
// escoger el grupo "Sin aseguradora" el filtro encuentra esas pólizas.
export const SIN = {
  aseg: 'Sin aseguradora',
  ramo: 'Sin ramo',
  asesor: 'Sin asesor',
  prod: 'Sin producto',
} as const

export type Dimension = keyof typeof SIN

const nombreDe: Record<Dimension, (p: PolizaLista) => string | null> = {
  aseg: (p) => p.nombre_aseg,
  ramo: (p) => p.nombre_ramo,
  asesor: (p) => p.nombre_asesor,
  prod: (p) => p.nombre_prod,
}

export function etiqueta(dim: Dimension, p: PolizaLista): string {
  const n = nombreDe[dim](p)
  return n ? n : SIN[dim]
}

/**
 * Rango cerrado por día calendario: "hasta" incluye todo ese día y nada del
 * siguiente (se compara con el inicio del día siguiente, semiabierto).
 */
export function enRango(d: Date | null, r: RangoFechas): boolean {
  const { desde, hasta } = r
  if (!desde && !hasta) return true
  if (!d) return false
  if (desde && d.getTime() < new Date(desde.getFullYear(), desde.getMonth(), desde.getDate()).getTime()) return false
  if (hasta && d.getTime() >= new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate() + 1).getTime()) return false
  return true
}

/** Cliente por nombre o documento (el documento se guarda sin puntos). */
export function coincideCliente(p: PolizaLista, q: string): boolean {
  const t = q.toLowerCase()
  const doc = t.replace(/\./g, '')
  return (p.nombre_cliente ?? '').toLowerCase().includes(t) || (!!doc && (p.doc_cliente ?? '').toLowerCase().includes(doc))
}

function coincideBusqueda(p: PolizaLista, busqueda: string): boolean {
  const q = busqueda.toLowerCase()
  const id = /^\d+$/.test(busqueda) ? Number(busqueda) : null
  const qDoc = q.replace(/\./g, '')
  const tiene = (s: string | null) => (s ?? '').toLowerCase().includes(q)
  return (
    (id != null && p.id === id) ||
    tiene(p.nro_poliza) ||
    tiene(p.nombre_cliente) ||
    (!!qDoc && (p.doc_cliente ?? '').toLowerCase().includes(qDoc)) ||
    tiene(p.nombre_aseg) ||
    tiene(p.nombre_ramo) ||
    tiene(p.nombre_prod) ||
    tiene(p.nombre_asesor) ||
    tiene(p.bien_asegurado)
  )
}

export const esAnulada = (p: PolizaLista) => p.estado_poliza_id === 'A'

export function filtrar(filas: FilaReporte[], f: FiltrosReporte, hoy: Date): FilaReporte[] {
  const busqueda = f.busqueda.trim()
  const cliente = f.cliente.trim()
  const tHoy = hoy.getTime()
  return filas.filter((r) => {
    const p = r.p
    if (busqueda && !coincideBusqueda(p, busqueda)) return false
    if (!f.incluirAnuladas && esAnulada(p)) return false
    if (f.aseg != null && etiqueta('aseg', p) !== f.aseg) return false
    if (f.ramo != null && etiqueta('ramo', p) !== f.ramo) return false
    if (f.asesor != null && etiqueta('asesor', p) !== f.asesor) return false
    if (f.prod != null && etiqueta('prod', p) !== f.prod) return false
    if (cliente && !coincideCliente(p, cliente)) return false
    if (f.estado === 'vigentes' && (!r.ffin || r.ffin.getTime() < tHoy)) return false
    if (f.estado === 'vencidas' && (!r.ffin || r.ffin.getTime() >= tHoy)) return false
    if (f.estado === 'sinFecha' && r.ffin) return false
    if (!enRango(r.ffin, f.ffin)) return false
    if (!enRango(r.fcreado, f.freg)) return false
    if (!enRango(r.fexp, f.fexp)) return false
    return true
  })
}

/**
 * Opciones de un filtro de lista según los demás filtros de lista y el
 * cliente (cascada). Incluye "Sin …" si hay pólizas sin ese dato.
 */
export function opcionesDe(filas: FilaReporte[], f: FiltrosReporte, dim: Dimension): string[] {
  const cliente = f.cliente.trim()
  const vistos = new Set<string>()
  for (const { p } of filas) {
    if (dim !== 'aseg' && f.aseg != null && etiqueta('aseg', p) !== f.aseg) continue
    if (dim !== 'ramo' && f.ramo != null && etiqueta('ramo', p) !== f.ramo) continue
    if (dim !== 'asesor' && f.asesor != null && etiqueta('asesor', p) !== f.asesor) continue
    if (dim !== 'prod' && f.prod != null && etiqueta('prod', p) !== f.prod) continue
    if (cliente && !coincideCliente(p, cliente)) continue
    vistos.add(etiqueta(dim, p))
  }
  const sin = SIN[dim]
  const nombres = [...vistos].filter((s) => s !== sin).sort((a, b) => a.localeCompare(b, 'es'))
  return vistos.has(sin) ? [...nombres, sin] : nombres
}

export function contarFiltrosActivos(f: FiltrosReporte): number {
  const r = (x: RangoFechas) => (x.desde || x.hasta ? 1 : 0)
  return (
    [f.aseg, f.ramo, f.asesor, f.prod].filter((x) => x != null).length +
    (f.estado !== 'todas' ? 1 : 0) +
    r(f.ffin) +
    r(f.freg) +
    r(f.fexp) +
    (f.busqueda.trim() ? 1 : 0) +
    (f.incluirAnuladas ? 1 : 0) +
    (f.cliente.trim() ? 1 : 0)
  )
}

// ── Cálculos ────────────────────────────────────────────────────────────────

/** Suma exacta en centavos enteros. */
export function sumarPrimas(filas: FilaReporte[]): number {
  let c = 0
  for (const r of filas) c += Math.round(r.prima * 100)
  return c / 100
}

export interface Clasificacion {
  vigentes: number
  /** Vencidas, la más reciente primero. */
  vencidas: FilaReporte[]
  /** Sin fecha de vencimiento, la registrada más recientemente primero. */
  sinFfin: FilaReporte[]
  primaTotal: number
}

export function clasificar(filas: FilaReporte[], hoy: Date): Clasificacion {
  const tHoy = hoy.getTime()
  let vigentes = 0
  const vencidas: FilaReporte[] = []
  const sinFfin: FilaReporte[] = []
  for (const r of filas) {
    if (!r.ffin) sinFfin.push(r)
    else if (r.ffin.getTime() < tHoy) vencidas.push(r)
    else vigentes++
  }
  vencidas.sort((a, b) => b.ffin!.getTime() - a.ffin!.getTime())
  sinFfin.sort((a, b) => (b.fcreado?.getTime() ?? 0) - (a.fcreado?.getTime() ?? 0))
  return { vigentes, vencidas, sinFfin, primaTotal: sumarPrimas(filas) }
}

/** Días que faltan para el vencimiento (negativo si ya venció). */
export const diasParaVencer = (r: FilaReporte, hoy: Date) => (r.ffin ? diasEntre(hoy, r.ffin) : null)

/** Pólizas que vencen entre [desde] y [hasta] días desde hoy (ambos incluidos), la más próxima primero. */
export function porVencer(filas: FilaReporte[], hoy: Date, desde: number, hasta: number): FilaReporte[] {
  return filas
    .filter((r) => {
      if (!r.ffin) return false
      const d = diasEntre(hoy, r.ffin)
      return d >= desde && d <= hasta
    })
    .sort((a, b) => a.ffin!.getTime() - b.ffin!.getTime())
}

export interface Grupo {
  nombre: string
  cantidad: number
  prima: number
}

/** Agrupa por [dim]; ordena por prima o por cantidad (desempate por nombre). */
export function agrupar(filas: FilaReporte[], dim: Dimension, porPrima: boolean): Grupo[] {
  const mapa = new Map<string, { cantidad: number; centavos: number }>()
  for (const r of filas) {
    const k = etiqueta(dim, r.p)
    let g = mapa.get(k)
    if (!g) mapa.set(k, (g = { cantidad: 0, centavos: 0 }))
    g.cantidad++
    g.centavos += Math.round(r.prima * 100)
  }
  const grupos = [...mapa].map(([nombre, g]) => ({ nombre, cantidad: g.cantidad, prima: g.centavos / 100 }))
  grupos.sort((a, b) => {
    const c = porPrima ? b.prima - a.prima : b.cantidad - a.cantidad
    return c !== 0 ? c : a.nombre.localeCompare(b.nombre, 'es')
  })
  return grupos
}

// ── Atajos de fechas ────────────────────────────────────────────────────────

/** Hoy + [desde] días hasta hoy + [hasta] días. */
export const rangoDias = (hoy: Date, desde: number, hasta: number): RangoFechas => ({
  desde: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + desde),
  hasta: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + hasta),
})

export const rangoMes = (hoy: Date): RangoFechas => ({
  desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1),
  hasta: new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0),
})

export const rangoAnio = (hoy: Date): RangoFechas => ({
  desde: new Date(hoy.getFullYear(), 0, 1),
  hasta: new Date(hoy.getFullYear(), 11, 31),
})

export const mismoRango = (a: RangoFechas, b: RangoFechas) =>
  (a.desde?.getTime() ?? null) === (b.desde?.getTime() ?? null) &&
  (a.hasta?.getTime() ?? null) === (b.hasta?.getTime() ?? null)
