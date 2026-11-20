// Clientes y asesores del Tablero: concentración (Pareto), nuevos contra recurrentes, ranking de asesores.

import { esAnulada, type FilaReporte } from '@/paginas/reportes/calculos'
import { etiquetaDim, valorDe } from './logica'

const claveCliente = (r: FilaReporte): string => (r.p.cliente_id != null ? `id:${r.p.cliente_id}` : `n:${etiquetaDim('cliente', r.p)}`)

export interface ClienteResumen {
  clave: string
  nombre: string
  polizas: number
  valor: number
  prima: number
  ramos: number
}

export interface AnalisisClientes {
  clientes: ClienteResumen[]
  totalValor: number
  /** Porcentaje (0–1) del valor que explican los 10 mayores. */
  concentracionTop10: number
  /** Clientes con pólizas en un único ramo, y su proporción (0–1). */
  unSoloRamo: number
  pctUnSoloRamo: number
  /** Valor acumulado (0–1) de los N mayores clientes. */
  pareto: { corte: number; pct: number }[]
}

export function analizarClientes(filas: FilaReporte[]): AnalisisClientes {
  const m = new Map<string, ClienteResumen & { _r: Set<string> }>()
  for (const r of filas) {
    const k = claveCliente(r)
    const c = m.get(k) ?? { clave: k, nombre: etiquetaDim('cliente', r.p), polizas: 0, valor: 0, prima: 0, ramos: 0, _r: new Set<string>() }
    c.polizas++
    c.valor += valorDe(r)
    c.prima += r.prima
    c._r.add(etiquetaDim('ramo', r.p))
    m.set(k, c)
  }
  const clientes = [...m.values()]
    .map(({ _r, ...c }) => ({ ...c, ramos: _r.size }))
    .sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre, 'es'))
  const totalValor = clientes.reduce((s, c) => s + c.valor, 0)
  const acumulado = (n: number) => (totalValor > 0 ? clientes.slice(0, n).reduce((s, c) => s + c.valor, 0) / totalValor : 0)
  const unSolo = clientes.filter((c) => c.ramos === 1).length
  return {
    clientes,
    totalValor,
    concentracionTop10: acumulado(10),
    unSoloRamo: unSolo,
    pctUnSoloRamo: clientes.length > 0 ? unSolo / clientes.length : 0,
    pareto: [1, 5, 10, 20, 50, 100].filter((n) => n <= Math.max(clientes.length, 1)).map((corte) => ({ corte, pct: acumulado(corte) })),
  }
}

export interface NuevosRecurrentes {
  anios: number[]
  nuevos: number[]
  recurrentes: number[]
}

/**
 * Por año de inicio: clientes con póliza ese año que tuvieron su primera póliza ese mismo año (nuevos)
 * y los que ya eran clientes (recurrentes). "Primera póliza" se busca en [todas] (el historial completo).
 */
export function nuevosYRecurrentes(filas: FilaReporte[], todas: FilaReporte[], maxAnios = 10): NuevosRecurrentes {
  const primero = new Map<string, number>()
  for (const r of todas) {
    if (!r.fini || esAnulada(r.p)) continue
    const k = claveCliente(r)
    const a = r.fini.getFullYear()
    if (!primero.has(k) || a < primero.get(k)!) primero.set(k, a)
  }
  const porAnio = new Map<number, Set<string>>()
  for (const r of filas) {
    if (!r.fini) continue
    const a = r.fini.getFullYear()
    const s = porAnio.get(a) ?? new Set<string>()
    s.add(claveCliente(r))
    porAnio.set(a, s)
  }
  const anios = [...porAnio.keys()].sort((a, b) => a - b).slice(-maxAnios)
  return {
    anios,
    nuevos: anios.map((a) => [...porAnio.get(a)!].filter((k) => primero.get(k) === a).length),
    recurrentes: anios.map((a) => [...porAnio.get(a)!].filter((k) => primero.get(k) !== a).length),
  }
}

export interface AsesorResumen {
  nombre: string
  polizas: number
  clientes: number
  valor: number
  prima: number
  /** Valor promedio por póliza. */
  ticket: number
  peso: number
}

export function resumenAsesores(filas: FilaReporte[]): AsesorResumen[] {
  const m = new Map<string, { polizas: number; valor: number; prima: number; clientes: Set<string> }>()
  for (const r of filas) {
    const k = etiquetaDim('asesor', r.p)
    const g = m.get(k) ?? { polizas: 0, valor: 0, prima: 0, clientes: new Set<string>() }
    g.polizas++
    g.valor += valorDe(r)
    g.prima += r.prima
    g.clientes.add(claveCliente(r))
    m.set(k, g)
  }
  const total = [...m.values()].reduce((s, g) => s + g.valor, 0)
  return [...m]
    .map(([nombre, g]) => ({
      nombre,
      polizas: g.polizas,
      clientes: g.clientes.size,
      valor: g.valor,
      prima: g.prima,
      ticket: g.polizas > 0 ? g.valor / g.polizas : 0,
      peso: total > 0 ? g.valor / total : 0,
    }))
    .sort((a, b) => b.valor - a.valor)
}
