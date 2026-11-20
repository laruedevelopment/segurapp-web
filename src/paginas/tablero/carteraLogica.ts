// Cartera, recaudo y comisión del Tablero. Mismas reglas del Dashboard gerencial:
//  · Cartera = prima de las pólizas no anuladas − prima ya pagada (nunca menos de 0 por póliza).
//  · Recaudo y comisión = pagos (abonos no anulados) con fecha dentro del período elegido.
// Todo se calcula sobre las pólizas que pasan los filtros del Tablero.

import { diasEntre } from '@/lib/fechas'
import type { AbonoLite } from '@/paginas/dashboard/motor'
import { esAnulada, type FilaReporte } from '@/paginas/reportes/calculos'
import { etiquetaDim } from './logica'

export const ETIQUETAS_AGING = ['Sin iniciar', '0–30 días', '31–60 días', '61–90 días', '91–180 días', 'Más de 180'] as const
export type EtiquetaAging = (typeof ETIQUETAS_AGING)[number]

export function etiquetaAging(dias: number): EtiquetaAging {
  if (dias < 0) return 'Sin iniciar'
  if (dias <= 30) return '0–30 días'
  if (dias <= 60) return '31–60 días'
  if (dias <= 90) return '61–90 días'
  if (dias <= 180) return '91–180 días'
  return 'Más de 180'
}

export interface Deudor {
  nombre: string
  polizas: number
  saldo: number
}

export interface Cartera {
  prima: number
  pagada: number
  saldo: number
  /** Pagada ÷ emitida (0–1). */
  pctRecaudo: number
  polizasConSaldo: number
  aging: { nombre: EtiquetaAging; saldo: number; polizas: number }[]
  deudores: Deudor[]
}

export function calcularCartera(filas: FilaReporte[], hoy: Date, maxDeudores = 15): Cartera {
  let prima = 0
  let pagada = 0
  let saldoTot = 0
  let conSaldo = 0
  const aging = new Map<EtiquetaAging, { saldo: number; polizas: number }>(ETIQUETAS_AGING.map((e) => [e, { saldo: 0, polizas: 0 }]))
  const deud = new Map<string, Deudor>()
  for (const r of filas) {
    if (esAnulada(r.p) || r.prima <= 0) continue
    const pag = Math.min(Math.max(r.p.vlrprimapagada_poliza ?? 0, 0), r.prima)
    const saldo = r.prima - pag
    prima += r.prima
    pagada += pag
    if (saldo <= 0) continue
    saldoTot += saldo
    conSaldo++
    const ini = r.fini ?? r.fexp ?? r.fcreado ?? hoy
    const a = aging.get(etiquetaAging(diasEntre(ini, hoy)))!
    a.saldo += saldo
    a.polizas++
    const k = etiquetaDim('cliente', r.p)
    const d = deud.get(k) ?? { nombre: k, polizas: 0, saldo: 0 }
    d.polizas++
    d.saldo += saldo
    deud.set(k, d)
  }
  return {
    prima,
    pagada,
    saldo: saldoTot,
    pctRecaudo: prima > 0 ? pagada / prima : 0,
    polizasConSaldo: conSaldo,
    aging: ETIQUETAS_AGING.map((nombre) => ({ nombre, ...aging.get(nombre)! })),
    deudores: [...deud.values()].sort((a, b) => b.saldo - a.saldo).slice(0, maxDeudores),
  }
}

// ── Recaudo y comisión (pagos) ──────────────────────────────────────────────

export type PeriodoPagos = '12m' | 'anio' | 'anioAnterior' | 'todo'

export const PERIODOS_PAGOS: { id: PeriodoPagos; texto: string }[] = [
  { id: '12m', texto: 'Últimos 12 meses' },
  { id: 'anio', texto: 'Este año' },
  { id: 'anioAnterior', texto: 'Año anterior' },
  { id: 'todo', texto: 'Todo (por año)' },
]

export interface RangoPagos {
  desde: Date | null
  hasta: Date | null
  /** Barras por mes o por año. */
  porAnio: boolean
}

export function rangoPagos(p: PeriodoPagos, hoy: Date): RangoPagos {
  if (p === '12m') return { desde: new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1), hasta: new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0), porAnio: false }
  if (p === 'anio') return { desde: new Date(hoy.getFullYear(), 0, 1), hasta: new Date(hoy.getFullYear(), 11, 31), porAnio: false }
  if (p === 'anioAnterior') return { desde: new Date(hoy.getFullYear() - 1, 0, 1), hasta: new Date(hoy.getFullYear() - 1, 11, 31), porAnio: false }
  return { desde: null, hasta: null, porAnio: true }
}

export interface GrupoComision {
  nombre: string
  recaudo: number
  comision: number
  /** Comisión ÷ prima recaudada (0–1). */
  efectiva: number
  pagos: number
}

export interface Recaudo {
  recaudo: number
  comision: number
  efectiva: number
  pagos: number
  etiquetas: string[]
  serieRecaudo: number[]
  serieComision: number[]
  porAseguradora: GrupoComision[]
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Suma de los pagos de las pólizas de [filas], dentro del rango. */
export function calcularRecaudo(filas: FilaReporte[], abonos: AbonoLite[], rango: RangoPagos): Recaudo {
  const porId = new Map(filas.map((r) => [r.p.id, r]))
  const t0 = rango.desde ? rango.desde.getTime() : -Infinity
  const t1 = rango.hasta ? new Date(rango.hasta.getFullYear(), rango.hasta.getMonth(), rango.hasta.getDate() + 1).getTime() : Infinity
  const cubeta = new Map<number, { recaudo: number; comision: number }>()
  const aseg = new Map<string, { recaudo: number; comision: number; pagos: number }>()
  let recaudo = 0
  let comision = 0
  let pagos = 0
  for (const a of abonos) {
    if (!a.fecha) continue
    const t = a.fecha.getTime()
    if (t < t0 || t >= t1) continue
    const r = porId.get(a.idPoliza)
    if (!r) continue
    recaudo += a.prima
    comision += a.comision
    pagos++
    const k = rango.porAnio ? a.fecha.getFullYear() : a.fecha.getFullYear() * 12 + a.fecha.getMonth()
    const c = cubeta.get(k) ?? { recaudo: 0, comision: 0 }
    c.recaudo += a.prima
    c.comision += a.comision
    cubeta.set(k, c)
    const n = etiquetaDim('aseg', r.p)
    const g = aseg.get(n) ?? { recaudo: 0, comision: 0, pagos: 0 }
    g.recaudo += a.prima
    g.comision += a.comision
    g.pagos++
    aseg.set(n, g)
  }

  // Ejes completos (meses sin pagos salen en cero).
  const claves: number[] = []
  if (rango.porAnio) {
    const ks = [...cubeta.keys()].sort((a, b) => a - b)
    if (ks.length) for (let y = ks[0]; y <= ks[ks.length - 1]; y++) claves.push(y)
  } else if (rango.desde && rango.hasta) {
    for (let d = new Date(rango.desde.getFullYear(), rango.desde.getMonth(), 1); d <= rango.hasta; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      claves.push(d.getFullYear() * 12 + d.getMonth())
    }
  }
  const etiquetas = claves.map((k) => (rango.porAnio ? String(k) : `${MESES_CORTOS[k % 12]} ${String(Math.floor(k / 12)).slice(2)}`))
  return {
    recaudo,
    comision,
    efectiva: recaudo > 0 ? comision / recaudo : 0,
    pagos,
    etiquetas,
    serieRecaudo: claves.map((k) => cubeta.get(k)?.recaudo ?? 0),
    serieComision: claves.map((k) => cubeta.get(k)?.comision ?? 0),
    porAseguradora: [...aseg]
      .map(([nombre, g]) => ({ nombre, ...g, efectiva: g.recaudo > 0 ? g.comision / g.recaudo : 0 }))
      .sort((a, b) => b.comision - a.comision),
  }
}
