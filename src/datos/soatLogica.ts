// Cruce de las pólizas de vehículos con sus SOAT: qué placas no tienen SOAT, cuál venció y cuál vence pronto.

import { extraerPlacas } from '@/lib/placa'
import { sumarAnios } from '@/lib/fechas'

export type EstadoSoat = 'sin' | 'vencido' | 'porVencer' | 'vigente'

export const DIAS_SOAT_POR_VENCER = 45

export interface VehiculoPoliza {
  id: number
  clienteId: number | null
  nombreCliente: string | null
  tel: string | null
  bien: string | null
  ramo: string | null
  producto: string | null
  nombreAseg: string | null
  asesor: string | null
  vence: string
}

export interface SoatRegistro {
  clienteId: number | null
  bien: string | null
  vence: string
}

export interface FilaSoat {
  placa: string
  /** La póliza del vehículo de la que se tomó el cliente (la de vencimiento más lejano). */
  vehiculo: VehiculoPoliza
  soatVence: string | null
  estado: EstadoSoat
  /** Días hasta el vencimiento del SOAT (negativo = vencido); null si no tiene. */
  dias: number | null
  /** Fecha sugerida para el siguiente SOAT (vencimiento actual + 1 año), solo si el actual sigue vigente. */
  finSugerido: string | null
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const aDate = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
const diasEntre = (a: Date, b: Date) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86_400_000)

export const esTodoRiesgo = (v: Pick<VehiculoPoliza, 'producto' | 'ramo'>) => /todo\s*riesgo/i.test(`${v.producto ?? ''} ${v.ramo ?? ''}`)

export function estadoSoat(dias: number | null): EstadoSoat {
  if (dias == null) return 'sin'
  if (dias < 0) return 'vencido'
  return dias <= DIAS_SOAT_POR_VENCER ? 'porVencer' : 'vigente'
}

/** Una fila por placa (las pólizas sin placa se ignoran). */
export function cruzarSoat(vehiculos: VehiculoPoliza[], soats: SoatRegistro[], hoy: Date): FilaSoat[] {
  const ultimoSoat = new Map<string, string>()
  for (const s of soats) {
    for (const placa of extraerPlacas(s.bien)) {
      const m = ultimoSoat.get(placa)
      if (!m || s.vence > m) ultimoSoat.set(placa, s.vence)
    }
  }
  const porPlaca = new Map<string, VehiculoPoliza>()
  for (const v of vehiculos) {
    // Póliza colectiva: cada vehículo (placa) es una fila.
    for (const placa of extraerPlacas(v.bien)) {
      const m = porPlaca.get(placa)
      if (!m || v.vence > m.vence) porPlaca.set(placa, v)
    }
  }
  const filas: FilaSoat[] = []
  for (const [placa, vehiculo] of porPlaca) {
    const soatVence = ultimoSoat.get(placa) ?? null
    const dias = soatVence ? diasEntre(hoy, aDate(soatVence)) : null
    let finSugerido: string | null = null
    // Solo si el SOAT sigue vigente: uno vencido se renueva desde la compra, no desde la fecha anterior.
    if (soatVence && dias != null && dias >= 0) {
      const sug = sumarAnios(aDate(soatVence), 1)
      if (sug >= hoy) finSugerido = iso(sug)
    }
    filas.push({ placa, vehiculo, soatVence, estado: estadoSoat(dias), dias, finSugerido })
  }
  // Lo más urgente primero: sin SOAT, vencidos (los más recientes), por vencer, vigentes.
  const peso = { sin: 0, vencido: 1, porVencer: 2, vigente: 3 } as const
  return filas.sort((a, b) => peso[a.estado] - peso[b.estado] || (a.dias ?? 0) - (b.dias ?? 0) || a.placa.localeCompare(b.placa))
}
