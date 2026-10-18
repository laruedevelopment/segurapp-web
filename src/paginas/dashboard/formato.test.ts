import { describe, expect, it } from 'vitest'
import { fmtCompacto, fmtEntero, fmtMonto, fmtPct, mesCorto } from './formato'
import { fraccionesMeta, metaDe, repartirEnMeses, variacion, type Meta } from './motor'

describe('formato de cifras', () => {
  it('compacto: mil, M y mil M con coma decimal', () => {
    expect(fmtCompacto(999)).toBe('999')
    expect(fmtCompacto(850_000)).toBe('850 mil')
    expect(fmtCompacto(1_234_567)).toBe('1,2 M')
    expect(fmtCompacto(3_400_000_000)).toBe('3,4 mil M')
    expect(fmtCompacto(-2_500_000)).toBe('-2,5 M')
    expect(fmtCompacto(2_500_000, true)).toBe('+2,5 M')
    expect(fmtCompacto(0)).toBe('0')
  })
  it('entero, monto y porcentaje con puntos de miles', () => {
    expect(fmtEntero(1234567.4)).toBe('1.234.567')
    expect(fmtEntero(1234)).toBe('1.234')
    expect(fmtMonto(1234567)).toBe('$ 1.234.567')
    expect(fmtPct(12.5)).toBe('12,5%')
    expect(fmtPct(66.666, 0)).toBe('67%')
  })
  it('mes corto', () => {
    expect(mesCorto(new Date(2026, 8, 1))).toBe('sep')
    expect(mesCorto(new Date(2026, 8, 1), true)).toBe('sep 26')
  })
})

describe('variación y metas', () => {
  it('variación null sin base', () => {
    expect(variacion(10, null)).toBeNull()
    expect(variacion(10, 0)).toBeNull()
    expect(variacion(150, 100)).toBe(50)
    expect(variacion(50, 100)).toBe(-50)
  })
  it('repartir en 12 meses: el último absorbe el redondeo', () => {
    const r = repartirEnMeses(1_000_000)
    expect(r.length).toBe(12)
    expect(r.reduce((s, v) => s + v, 0)).toBe(1_000_000)
    expect(r[0]).toBe(83_333)
    expect(r[11]).toBe(83_337)
  })
  it('meta del mes por indicador y alcance', () => {
    const metas: Meta[] = [
      { anio: 2026, mes: 3, indicador: 'prima', asesorId: 0, valor: 100 },
      { anio: 2026, mes: 3, indicador: 'prima', asesorId: 7, valor: 40 },
      { anio: 2026, mes: 3, indicador: 'polizas', asesorId: 0, valor: 5 },
    ]
    expect(metaDe(metas, 'prima', 3, 0)).toBe(100)
    expect(metaDe(metas, 'prima', 3, 7)).toBe(40)
    expect(metaDe(metas, 'prima', 4, 0)).toBe(0)
    expect(metaDe(null, 'prima', 3, 0)).toBe(0)
  })
  it('fracciones de ritmo: año pasado completo, futuro sin empezar, actual a medias', () => {
    const hoy = new Date(2026, 9, 14)
    expect(fraccionesMeta(2025, hoy)).toEqual({ mesRef: 12, fracMes: 1, fracAnio: 1 })
    expect(fraccionesMeta(2027, hoy)).toEqual({ mesRef: 1, fracMes: 0, fracAnio: 0 })
    const a = fraccionesMeta(2026, hoy)
    expect(a.mesRef).toBe(10)
    expect(a.fracMes).toBeCloseTo(14 / 31, 9)
    expect(a.fracAnio).toBeCloseTo(287 / 365, 9)
  })
})
