import { describe, expect, it } from 'vitest'
import { cruzarSoat, esTodoRiesgo, estadoSoat, type VehiculoPoliza } from './soatLogica'

const v = (id: number, bien: string, vence = '2027-06-01', producto = 'TODO RIESGO'): VehiculoPoliza => ({
  id, clienteId: 1, nombreCliente: 'C', tel: null, bien, ramo: 'LIVIANOS', producto, nombreAseg: null, asesor: null, vence,
})
const hoy = new Date(2026, 10, 19)

describe('estadoSoat', () => {
  it('clasifica', () => {
    expect(estadoSoat(null)).toBe('sin')
    expect(estadoSoat(-1)).toBe('vencido')
    expect(estadoSoat(0)).toBe('porVencer')
    expect(estadoSoat(45)).toBe('porVencer')
    expect(estadoSoat(46)).toBe('vigente')
  })
})

describe('cruzarSoat', () => {
  it('cruza por placa y ordena lo urgente primero', () => {
    const filas = cruzarSoat(
      [v(1, 'MAZDA ABC123'), v(2, 'KTL356'), v(3, 'DSR643'), v(4, 'XYZ789')],
      [
        { clienteId: 1, bien: 'ABC123', vence: '2026-01-10' },
        { clienteId: 1, bien: 'ABC 123', vence: '2026-12-01' },
        { clienteId: 1, bien: 'KTL356', vence: '2026-03-01' },
        { clienteId: 1, bien: 'DSR643', vence: '2027-08-01' },
      ],
      hoy,
    )
    expect(filas.map((f) => [f.placa, f.estado])).toEqual([
      ['XYZ789', 'sin'],
      ['KTL356', 'vencido'],
      ['ABC123', 'porVencer'],
      ['DSR643', 'vigente'],
    ])
    expect(filas.find((f) => f.placa === 'ABC123')?.finSugerido).toBe('2027-12-01')
    expect(filas.find((f) => f.placa === 'KTL356')?.finSugerido).toBeNull()
  })
  it('una fila por placa y descarta lo que no tiene placa', () => {
    const filas = cruzarSoat([v(1, 'ABC123', '2026-12-01'), v(2, 'ABC123', '2027-12-01'), v(3, 'Sin placa')], [], hoy)
    expect(filas).toHaveLength(1)
    expect(filas[0].vehiculo.id).toBe(2)
  })
})

describe('esTodoRiesgo', () => {
  it('por producto', () => {
    expect(esTodoRiesgo({ producto: 'Todo Riesgo Livianos', ramo: 'LIVIANOS' })).toBe(true)
    expect(esTodoRiesgo({ producto: 'RCE', ramo: 'LIVIANOS' })).toBe(false)
  })
})

describe('cruzarSoat con pólizas colectivas', () => {
  it('cada placa de la póliza es una fila, con su propio SOAT', () => {
    const colectiva = v(1, 'FLOTA ABC123, KTL356 y DSR643', '2027-06-01')
    const filas = cruzarSoat(
      [colectiva],
      [
        { clienteId: 1, bien: 'ABC123', vence: '2027-08-01' },
        { clienteId: 1, bien: 'KTL356', vence: '2026-03-01' },
      ],
      hoy,
    )
    expect(filas.map((f) => [f.placa, f.estado])).toEqual([
      ['DSR643', 'sin'],
      ['KTL356', 'vencido'],
      ['ABC123', 'vigente'],
    ])
    expect(new Set(filas.map((f) => f.vehiculo.id))).toEqual(new Set([1]))
  })
})
