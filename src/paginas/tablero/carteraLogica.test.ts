import { describe, expect, it } from 'vitest'
import type { PolizaLista } from '@/lib/tipos'
import type { AbonoLite } from '@/paginas/dashboard/motor'
import { prepararFilas } from '@/paginas/reportes/calculos'
import { calcularCartera, calcularRecaudo, etiquetaAging, rangoPagos } from './carteraLogica'

const HOY = new Date(2026, 10, 19)
let sig = 1
const pol = (d: Partial<PolizaLista>) => ({ id: sig++, estado_poliza_id: 'I', prima_poliza: 0, vlrprimapagada_poliza: 0, ...d }) as PolizaLista

describe('etiquetaAging', () => {
  it('clasifica por días desde el inicio', () => {
    expect([-1, 0, 30, 31, 60, 61, 90, 91, 180, 181].map(etiquetaAging)).toEqual([
      'Sin iniciar', '0–30 días', '0–30 días', '31–60 días', '31–60 días', '61–90 días', '61–90 días', '91–180 días', '91–180 días', 'Más de 180',
    ])
  })
})

describe('calcularCartera', () => {
  const filas = prepararFilas([
    pol({ nombre_cliente: 'ANA', prima_poliza: 1000, vlrprimapagada_poliza: 400, fini_poliza: '2026-11-01' }),
    pol({ nombre_cliente: 'ANA', prima_poliza: 500, vlrprimapagada_poliza: 900, fini_poliza: '2026-01-01' }), // pagó de más: saldo 0
    pol({ nombre_cliente: 'LUIS', prima_poliza: 800, vlrprimapagada_poliza: 0, fini_poliza: '2025-01-01' }),
    pol({ nombre_cliente: 'ZOE', prima_poliza: 700, estado_poliza_id: 'A' }), // anulada: no cuenta
    pol({ nombre_cliente: 'SIN', prima_poliza: 0 }),
  ])
  it('suma prima, pagada y saldo sin pasarse en cada póliza', () => {
    const c = calcularCartera(filas, HOY)
    expect(c.prima).toBe(2300)
    expect(c.pagada).toBe(900)
    expect(c.saldo).toBe(1400)
    expect(c.pctRecaudo).toBeCloseTo(900 / 2300)
    expect(c.polizasConSaldo).toBe(2)
  })
  it('antigüedad y deudores', () => {
    const c = calcularCartera(filas, HOY)
    expect(c.aging.find((a) => a.nombre === '0–30 días')).toMatchObject({ saldo: 600, polizas: 1 })
    expect(c.aging.find((a) => a.nombre === 'Más de 180')).toMatchObject({ saldo: 800, polizas: 1 })
    expect(c.deudores.map((d) => [d.nombre, d.saldo])).toEqual([['LUIS', 800], ['ANA', 600]])
  })
})

describe('calcularRecaudo', () => {
  const filas = prepararFilas([pol({ nombre_aseg: 'ESTADO' }), pol({ nombre_aseg: 'SURA' })])
  const [a, b] = filas.map((f) => f.p.id)
  const ab = (idPoliza: number, fecha: Date | null, prima: number, comision: number): AbonoLite => ({ idPoliza, fecha, prima, comision })
  const abonos = [
    ab(a, new Date(2026, 9, 5), 1000, 100),
    ab(a, new Date(2026, 10, 2), 500, 50),
    ab(b, new Date(2026, 10, 3), 2000, 400),
    ab(b, new Date(2025, 0, 3), 9999, 9999), // fuera de los últimos 12 meses
    ab(a, null, 5, 5), // sin fecha: no entra
    ab(999, new Date(2026, 10, 3), 7, 7), // póliza que no pasa los filtros
  ]
  it('últimos 12 meses: totales, comisión efectiva y meses en cero', () => {
    const r = calcularRecaudo(filas, abonos, rangoPagos('12m', HOY))
    expect(r).toMatchObject({ recaudo: 3500, comision: 550, pagos: 3 })
    expect(r.efectiva).toBeCloseTo(550 / 3500)
    expect(r.etiquetas).toHaveLength(12)
    expect(r.etiquetas[0]).toBe('dic 25')
    expect(r.etiquetas[11]).toBe('nov 26')
    expect(r.serieRecaudo[10]).toBe(1000)
    expect(r.serieRecaudo[11]).toBe(2500)
    expect(r.serieRecaudo[0]).toBe(0)
  })
  it('por aseguradora, ordenado por comisión', () => {
    const r = calcularRecaudo(filas, abonos, rangoPagos('12m', HOY))
    expect(r.porAseguradora.map((g) => [g.nombre, g.comision])).toEqual([['SURA', 400], ['ESTADO', 150]])
    expect(r.porAseguradora[0].efectiva).toBeCloseTo(0.2)
  })
  it('todo: por año, con los años intermedios', () => {
    const r = calcularRecaudo(filas, abonos, rangoPagos('todo', HOY))
    expect(r.etiquetas).toEqual(['2025', '2026'])
    expect(r.serieRecaudo).toEqual([9999, 3500])
  })
})
