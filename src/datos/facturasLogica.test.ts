import { describe, expect, it } from 'vitest'
import {
  agruparPorReporte,
  calcularMontos,
  empresasParaAseguradora,
  facturaDesdeFila,
  lineaFacturable,
  numeroFactura,
  porcentajeValido,
  subtotalDeLineas,
  validarFactura,
} from './facturasLogica'

describe('calcularMontos', () => {
  it('reproduce la factura de la captura: 453.182,99 con 10 % de retención', () => {
    const m = calcularMontos(453182.99, 0, 10, 0)
    expect(m.iva).toBe(0)
    expect(m.total).toBe(453182.99)
    expect(m.retefuente).toBe(45318.3)
    expect(m.neto).toBe(407864.69)
  })
  it('con IVA y ICA: total = subtotal + IVA; neto = total − retención − ICA', () => {
    const m = calcularMontos(672706.04, 16, 10, 1)
    expect(m.iva).toBe(107632.97)
    expect(m.total).toBe(780339.01)
    expect(m.neto).toBeCloseTo(780339.01 - 67270.6 - 6727.06, 2)
  })
  it('con retención de IVA 50 %: reproduce el valor a consignar de la factura 1413 del software anterior', () => {
    const m = calcularMontos(672706.04, 16, 11, 0, 50)
    expect(m.iva).toBe(107632.97)
    expect(m.retefuente).toBe(73997.66)
    expect(m.reteiva).toBe(53816.49)
    expect(m.neto).toBeCloseTo(652524.86, 2)
  })
  it('subtotal en cero da todo en cero', () => {
    expect(calcularMontos(0, 19, 10, 1)).toEqual({ iva: 0, total: 0, retefuente: 0, ica: 0, reteiva: 0, neto: 0 })
  })
})

describe('numeroFactura y porcentajes', () => {
  it('muestra el prefijo solo si no es 1', () => {
    expect(numeroFactura(1, 1413)).toBe('1413')
    expect(numeroFactura(2, 5)).toBe('2-5')
  })
  it('valida el rango de los porcentajes', () => {
    expect(porcentajeValido(0)).toBe(true)
    expect(porcentajeValido(100)).toBe(true)
    expect(porcentajeValido(-1)).toBe(false)
    expect(porcentajeValido(101)).toBe(false)
    expect(porcentajeValido(null)).toBe(false)
  })
})

describe('líneas', () => {
  it('solo se facturan las que no tienen factura y no están anuladas', () => {
    expect(lineaFacturable({ idfactura: null, estado_pago: 'C' })).toBe(true)
    expect(lineaFacturable({ idfactura: 5, estado_pago: 'C' })).toBe(false)
    expect(lineaFacturable({ idfactura: null, estado_pago: 'A' })).toBe(false)
  })
  it('el subtotal suma comisión y comisión adicional, sin anuladas', () => {
    const s = subtotalDeLineas([
      { vlrcomision: 100, vlrcomad: 10, estado_pago: 'C' },
      { vlrcomision: 50.5, vlrcomad: null, estado_pago: 'R' },
      { vlrcomision: 999, vlrcomad: 0, estado_pago: 'A' },
    ])
    expect(s).toBe(160.5)
  })
  it('agrupa por reporte, el más reciente primero', () => {
    const g = agruparPorReporte([
      { id: 1, idrep_pago: 3, vlrcomision: 10, vlrcomad: 0, reporteFecha: '2026-11-01', reporteAsegId: 1, reporteIntermId: 1 },
      { id: 2, idrep_pago: 3, vlrcomision: 5, vlrcomad: 1, reporteFecha: '2026-11-01', reporteAsegId: 1, reporteIntermId: 1 },
      { id: 3, idrep_pago: 9, vlrcomision: 7, vlrcomad: 0, reporteFecha: '2026-11-05', reporteAsegId: 2, reporteIntermId: null },
      { id: 4, idrep_pago: null, vlrcomision: 7, vlrcomad: 0, reporteFecha: null, reporteAsegId: null, reporteIntermId: null },
    ])
    expect(g.map((x) => x.reporteId)).toEqual([9, 3])
    expect(g[1]).toMatchObject({ lineas: 2, comision: 16 })
  })
})

describe('empresas, parseo y validación', () => {
  it('ofrece primero las empresas de la aseguradora y deja fuera las inactivas', () => {
    const lista = empresasParaAseguradora(
      [
        { id: 1, asegId: 2, nombre: 'Zeta', nit: '1', ivaPct: 16, activa: true },
        { id: 2, asegId: 1, nombre: 'Beta', nit: '2', ivaPct: 16, activa: true },
        { id: 3, asegId: 1, nombre: 'Alfa', nit: '3', ivaPct: 0, activa: true },
        { id: 4, asegId: 1, nombre: 'Vieja', nit: '4', ivaPct: 0, activa: false },
      ],
      1,
    )
    expect(lista.map((e) => e.nombre)).toEqual(['Alfa', 'Beta', 'Zeta'])
  })
  it('convierte la fila de la base aunque vengan textos y relaciones', () => {
    const f = facturaDesdeFila({
      id: '7', prefijo: 1, num_factura: 1413, fecha: '2010-01-27', subtotal: '672706.04', neto: '605435.44',
      estado: 'R', aseg: { nombre_aseg: 'ESTADO' }, empresa: { nombre: 'SEGUROS DEL ESTADO', nit: '860.009.578-6' },
    })
    expect(f.id).toBe(7)
    expect(f.subtotal).toBe(672706.04)
    expect(f.nombreAseg).toBe('ESTADO')
    expect(f.empresaNit).toBe('860.009.578-6')
    expect(f.estado).toBe('R')
  })
  it('un estado desconocido queda como Abierta', () => {
    expect(facturaDesdeFila({ estado: 'Z' }).estado).toBe('A')
  })
  it('valida fecha, porcentajes y líneas', () => {
    expect(validarFactura({ fecha: new Date(), ivaPct: 0, retePct: 10, icaPct: 0, lineasElegidas: 2 })).toEqual({})
    const e = validarFactura({ fecha: null, ivaPct: 120, retePct: 10, icaPct: 0, lineasElegidas: 0 })
    expect(e.fecha).toBeTruthy()
    expect(e.porcentajes).toBeTruthy()
    expect(e.lineas).toBeTruthy()
  })
  it('rechaza un subtotal negativo o en cero', () => {
    const base = { fecha: new Date(), ivaPct: 0, retePct: 10, icaPct: 0, lineasElegidas: 1 }
    expect(validarFactura({ ...base, subtotal: -93750 }).lineas).toMatch(/más de cero/)
    expect(validarFactura({ ...base, subtotal: 100 })).toEqual({})
  })
})
