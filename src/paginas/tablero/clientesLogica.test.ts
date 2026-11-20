import { describe, expect, it } from 'vitest'
import type { PolizaLista } from '@/lib/tipos'
import { prepararFilas } from '@/paginas/reportes/calculos'
import { analizarClientes, nuevosYRecurrentes, resumenAsesores } from './clientesLogica'

let sig = 1
const f = (d: Partial<PolizaLista>) => prepararFilas([{ id: sig++, estado_poliza_id: 'I', valor_poliza: 0, prima_poliza: 0, ...d } as PolizaLista])[0]
const filas = [
  f({ cliente_id: 1, nombre_cliente: 'ANA', nombre_ramo: 'SOAT', nombre_asesor: 'LUZ', valor_poliza: 600, prima_poliza: 500, fini_poliza: '2024-02-01' }),
  f({ cliente_id: 1, nombre_cliente: 'ANA', nombre_ramo: 'HOGAR', nombre_asesor: 'LUZ', valor_poliza: 200, fini_poliza: '2026-02-01' }),
  f({ cliente_id: 2, nombre_cliente: 'LUIS', nombre_ramo: 'SOAT', nombre_asesor: 'ANA', valor_poliza: 150, fini_poliza: '2026-03-01' }),
  f({ cliente_id: 3, nombre_cliente: 'ZOE', nombre_ramo: 'SOAT', nombre_asesor: 'ANA', valor_poliza: 50, fini_poliza: '2026-04-01' }),
]

describe('analizarClientes', () => {
  it('concentración, un solo ramo y Pareto', () => {
    const a = analizarClientes(filas)
    expect(a.clientes.map((c) => [c.nombre, c.valor, c.ramos])).toEqual([['ANA', 800, 2], ['LUIS', 150, 1], ['ZOE', 50, 1]])
    expect(a.totalValor).toBe(1000)
    expect(a.concentracionTop10).toBe(1)
    expect(a.unSoloRamo).toBe(2)
    expect(a.pctUnSoloRamo).toBeCloseTo(2 / 3)
    expect(a.pareto[0]).toEqual({ corte: 1, pct: 0.8 })
  })
  it('sin pólizas', () => {
    expect(analizarClientes([])).toMatchObject({ totalValor: 0, concentracionTop10: 0, pctUnSoloRamo: 0 })
  })
})

describe('nuevosYRecurrentes', () => {
  it('nuevo = su primera póliza cae ese año', () => {
    const r = nuevosYRecurrentes(filas, filas)
    expect(r.anios).toEqual([2024, 2026])
    expect(r.nuevos).toEqual([1, 2]) // 2024: ANA; 2026: LUIS y ZOE
    expect(r.recurrentes).toEqual([0, 1]) // 2026: ANA ya era cliente
  })
})

describe('resumenAsesores', () => {
  it('valor, ticket, clientes y peso', () => {
    const r = resumenAsesores(filas)
    expect(r.map((a) => [a.nombre, a.valor, a.polizas, a.clientes])).toEqual([['LUZ', 800, 2, 1], ['ANA', 200, 2, 2]])
    expect(r[0].ticket).toBe(400)
    expect(r[0].peso).toBeCloseTo(0.8)
  })
})
