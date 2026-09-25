import { describe, expect, test } from 'vitest'
import {
  abonosVigentes,
  calcularPorcPagado,
  calcularSaldo,
  calcularTotales,
  comisionAbono,
  etiquetaSaldo,
  fmtPct1,
  nombreArchivoPdf,
  type AbonoMontos,
} from './estado-cuenta-calculos'

const ab = (estado: string, abono: number | null, com: number | null, comad: number | null = 0): AbonoMontos => ({
  estado_pago: estado,
  vlrabono_prima: abono,
  vlrcomision: com,
  vlrcomad: comad,
})

describe('calcularTotales', () => {
  test('los anulados no suman pero sí se cuentan como abonos listados', () => {
    const t = calcularTotales([ab('C', 1000, 100, 10), ab('A', 5000, 500, 50), ab('I', 2000, 200, 0)])
    expect(t.totalAbonado).toBe(3000)
    expect(t.totalComisionBase).toBe(300)
    expect(t.totalComisionAdicional).toBe(10)
    expect(t.totalComision).toBe(310)
    expect(t.numAbonos).toBe(3)
  })

  test('suma exacta sin error de redondeo', () => {
    const lista = Array.from({ length: 10 }, () => ab('C', 100000.1, 0.1, 0.2))
    const t = calcularTotales(lista)
    expect(t.totalAbonado).toBe(1000001)
    expect(t.totalComision).toBe(3)
  })

  test('valores nulos cuentan como cero', () => {
    const t = calcularTotales([ab('C', null, null, null), ab('R', 50, 5, null)])
    expect(t.totalAbonado).toBe(50)
    expect(t.totalComision).toBe(5)
  })

  test('sin abonos', () => {
    expect(calcularTotales([])).toEqual({
      totalAbonado: 0,
      totalComisionBase: 0,
      totalComisionAdicional: 0,
      totalComision: 0,
      numAbonos: 0,
    })
  })
})

describe('abonosVigentes y comisionAbono', () => {
  test('filtra solo el estado A', () => {
    expect(abonosVigentes([ab('A', 1, 1), ab('V', 2, 2), ab('R', 3, 3)]).map((a) => a.vlrabono_prima)).toEqual([2, 3])
  })
  test('comisión total de un abono', () => {
    expect(comisionAbono({ vlrcomision: 0.1, vlrcomad: 0.2 })).toBe(0.3)
    expect(comisionAbono({ vlrcomision: null, vlrcomad: 7 })).toBe(7)
  })
})

describe('saldo y % pagado', () => {
  test('saldo pendiente', () => {
    expect(calcularSaldo(1000, 400)).toBe(600)
    expect(etiquetaSaldo(600)).toBe('Saldo pendiente')
    expect(etiquetaSaldo(0)).toBe('Saldo pendiente')
  })
  test('pago de más: saldo a favor', () => {
    const s = calcularSaldo(1000, 1250.5)
    expect(s).toBe(-250.5)
    expect(etiquetaSaldo(s)).toBe('Saldo a favor')
  })
  test('saldo exacto con decimales', () => {
    expect(calcularSaldo(0.3, 0.1)).toBe(0.2)
    expect(calcularSaldo(null, 100)).toBe(-100)
  })
  test('% pagado sin tope', () => {
    expect(calcularPorcPagado(1000, 500)).toBe(50)
    expect(calcularPorcPagado(1000, 1250)).toBe(125)
    expect(calcularPorcPagado(0, 500)).toBe(0)
    expect(calcularPorcPagado(null, 500)).toBe(0)
  })
  test('formato del % con un decimal', () => {
    expect(fmtPct1(112.5)).toBe('112,5%')
    expect(fmtPct1(100)).toBe('100,0%')
    expect(fmtPct1(33.333)).toBe('33,3%')
  })
})

describe('nombreArchivoPdf', () => {
  test('sanea caracteres no permitidos', () => {
    expect(nombreArchivoPdf('estado_cuenta_poliza_12')).toBe('estado_cuenta_poliza_12.pdf')
    expect(nombreArchivoPdf('factura_FE 12/3')).toBe('factura_FE_12_3.pdf')
    expect(nombreArchivoPdf('factura_Nº-5.á')).toBe('factura_N_-5__.pdf')
    expect(nombreArchivoPdf('')).toBe('documento.pdf')
  })
})
