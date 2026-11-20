// Renovaciones del Tablero: vencimientos por mes, tasa de renovación y lo vencido sin renovar.
// Una póliza "se renovó" si existe otra posterior del mismo cliente, ramo y bien (placa en vehículos).

import { renovadasAutomaticamente } from '@/datos/vencimientosLogica'
import { esAnulada, type FilaReporte } from '@/paginas/reportes/calculos'
import { aClave, diasVence, etiquetaDim, valorDe, type DimTablero } from './logica'

export interface GrupoRenovacion {
  nombre: string
  vencidas: number
  renovadas: number
  /** Renovadas ÷ vencidas (0–1). */
  tasa: number
}

export interface AnalisisRenovacion {
  /** Pólizas que vencieron en la ventana de la tasa (por defecto 12 meses). */
  vencidas: number
  renovadas: number
  tasa: number
  porAseguradora: GrupoRenovacion[]
  porAsesor: GrupoRenovacion[]
  /** Vencidas en los últimos [diasSinRenovar] días y sin renovar, de mayor a menor valor. */
  sinRenovar: FilaReporte[]
}

function agrupar(base: FilaReporte[], renovadas: Set<number>, dim: DimTablero, minimo: number): GrupoRenovacion[] {
  const m = new Map<string, { vencidas: number; renovadas: number }>()
  for (const r of base) {
    const k = etiquetaDim(dim, r.p)
    const g = m.get(k) ?? { vencidas: 0, renovadas: 0 }
    g.vencidas++
    if (renovadas.has(r.p.id)) g.renovadas++
    m.set(k, g)
  }
  return [...m]
    .filter(([, g]) => g.vencidas >= minimo)
    .map(([nombre, g]) => ({ nombre, ...g, tasa: g.renovadas / g.vencidas }))
    .sort((a, b) => b.vencidas - a.vencidas)
}

export function analizarRenovacion(
  filas: FilaReporte[],
  todas: FilaReporte[],
  hoy: Date,
  opciones: { diasTasa?: number; diasSinRenovar?: number; minimoGrupo?: number } = {},
): AnalisisRenovacion {
  const { diasTasa = 365, diasSinRenovar = 90, minimoGrupo = 3 } = opciones
  const vencidas = filas.filter((r) => {
    const d = diasVence(r, hoy)
    return d != null && d < 0 && d >= -diasTasa
  })
  const posteriores = todas.filter((r) => r.ffin && !esAnulada(r.p)).map(aClave)
  const renovadas = renovadasAutomaticamente(vencidas.map(aClave), posteriores)
  const recientes = vencidas.filter((r) => (diasVence(r, hoy) ?? -Infinity) >= -diasSinRenovar && !renovadas.has(r.p.id))
  return {
    vencidas: vencidas.length,
    renovadas: renovadas.size,
    tasa: vencidas.length > 0 ? renovadas.size / vencidas.length : 0,
    porAseguradora: agrupar(vencidas, renovadas, 'aseg', minimoGrupo),
    porAsesor: agrupar(vencidas, renovadas, 'asesor', minimoGrupo),
    sinRenovar: recientes.sort((a, b) => valorDe(b) - valorDe(a)),
  }
}

export interface VencePorMes {
  etiquetas: string[]
  registros: number[]
  valor: number[]
  prima: number[]
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Lo que vence en cada uno de los próximos [meses] meses (el mes en curso cuenta desde hoy). */
export function vencePorMes(filas: FilaReporte[], hoy: Date, meses = 12): VencePorMes {
  const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const out: VencePorMes = { etiquetas: [], registros: new Array(meses).fill(0), valor: new Array(meses).fill(0), prima: new Array(meses).fill(0) }
  for (let i = 0; i < meses; i++) {
    const d = new Date(ini.getFullYear(), ini.getMonth() + i, 1)
    out.etiquetas.push(`${MESES_CORTOS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`)
  }
  for (const r of filas) {
    if (!r.ffin || r.ffin < hoy) continue
    const i = (r.ffin.getFullYear() - ini.getFullYear()) * 12 + (r.ffin.getMonth() - ini.getMonth())
    if (i < 0 || i >= meses) continue
    out.registros[i]++
    out.valor[i] += valorDe(r)
    out.prima[i] += r.prima
  }
  return out
}
