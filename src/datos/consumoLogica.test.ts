import { describe, expect, it } from 'vitest'
import {
  agruparPor,
  cubetas,
  filaDesdeRpc,
  fmtBytes,
  fmtUsd,
  proyeccionMes,
  rangoDePeriodo,
  rangoValido,
  totales,
  type FilaConsumo,
} from './consumoLogica'

const HOY = new Date(2026, 10, 10, 15, 0) // 10 de noviembre de 2026

const fila = (o: Partial<FilaConsumo>): FilaConsumo => ({
  dia: '2026-11-05',
  funcion: 'extraer-poliza',
  tipoArchivo: 'pdf',
  modelo: 'm',
  usuarioId: 1,
  usuario: 'ANA',
  llamadas: 1,
  lecturas: 1,
  exitosas: 1,
  reintentos: 0,
  tokensEntrada: 1000,
  tokensCache: 0,
  tokensPensamiento: 0,
  tokensSalida: 100,
  costoUsd: 0.5,
  ...o,
})

describe('rangoDePeriodo', () => {
  it('calcula los períodos habituales', () => {
    expect(rangoDePeriodo('hoy', HOY)).toEqual({ desde: '2026-11-10', hasta: '2026-11-10' })
    expect(rangoDePeriodo('ayer', HOY)).toEqual({ desde: '2026-11-09', hasta: '2026-11-09' })
    expect(rangoDePeriodo('7d', HOY)).toEqual({ desde: '2026-11-04', hasta: '2026-11-10' })
    expect(rangoDePeriodo('30d', HOY)).toEqual({ desde: '2026-10-12', hasta: '2026-11-10' })
    expect(rangoDePeriodo('mes', HOY)).toEqual({ desde: '2026-11-01', hasta: '2026-11-10' })
    expect(rangoDePeriodo('mes_pasado', HOY)).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' })
    expect(rangoDePeriodo('anio', HOY)).toEqual({ desde: '2026-01-01', hasta: '2026-11-10' })
  })
  it('el mes pasado de enero es diciembre del año anterior', () => {
    expect(rangoDePeriodo('mes_pasado', new Date(2026, 0, 15))).toEqual({ desde: '2025-12-01', hasta: '2025-12-31' })
  })
})

describe('rangoValido', () => {
  it('acepta un rango correcto y rechaza los malos', () => {
    expect(rangoValido({ desde: '2026-11-01', hasta: '2026-11-10' })).toBeNull()
    expect(rangoValido({ desde: '', hasta: '2026-11-10' })).toMatch(/dos fechas/)
    expect(rangoValido({ desde: '2026-11-10', hasta: '2026-11-01' })).toMatch(/posterior/)
    expect(rangoValido({ desde: '2020-01-01', hasta: '2026-11-01' })).toMatch(/dos años/)
  })
})

describe('totales y agrupaciones', () => {
  const filas = [
    fila({ costoUsd: 1, lecturas: 2, llamadas: 3, reintentos: 1 }),
    fila({ funcion: 'extraer-reporte-pago', tipoArchivo: 'xlsx', costoUsd: 3, usuario: 'LUIS', usuarioId: 2 }),
  ]
  it('suma todo', () => {
    const t = totales(filas)
    expect(t.costoUsd).toBe(4)
    expect(t.lecturas).toBe(3)
    expect(t.llamadas).toBe(4)
    expect(t.reintentos).toBe(1)
  })
  it('agrupa de mayor a menor costo', () => {
    const g = agruparPor(filas, (f) => f.funcion)
    expect(g.map((x) => x.nombre)).toEqual(['extraer-reporte-pago', 'extraer-poliza'])
  })
})

describe('cubetas', () => {
  it('rellena los días sin consumo con cero', () => {
    const c = cubetas([fila({ dia: '2026-11-03' }), fila({ dia: '2026-11-05', costoUsd: 2 })], { desde: '2026-11-02', hasta: '2026-11-06' }, 'dia')
    expect(c.map((x) => x.clave)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'])
    expect(c.map((x) => x.total.costoUsd)).toEqual([0, 0.5, 0, 2, 0])
    expect(c[1].etiqueta).toBe('03/11')
  })
  it('agrupa por mes', () => {
    const c = cubetas([fila({ dia: '2026-10-30' }), fila({ dia: '2026-11-02' }), fila({ dia: '2026-11-09' })], { desde: '2026-10-01', hasta: '2026-11-30' }, 'mes')
    expect(c.map((x) => x.clave)).toEqual(['2026-10', '2026-11'])
    expect(c[1].total.lecturas).toBe(2)
    expect(c[1].etiqueta).toBe('nov 26')
  })
})

describe('proyeccionMes', () => {
  it('proyecta solo cuando el período es "este mes"', () => {
    // 10 días, US$ 5 → 30 días = US$ 15
    expect(proyeccionMes(5, { desde: '2026-11-01', hasta: '2026-11-10' }, HOY)).toBeCloseTo(15)
    expect(proyeccionMes(5, { desde: '2026-10-01', hasta: '2026-10-31' }, HOY)).toBeNull()
    expect(proyeccionMes(0, { desde: '2026-11-01', hasta: '2026-11-10' }, HOY)).toBeNull()
  })
})

describe('formato y conversión', () => {
  it('formatea dinero y bytes', () => {
    expect(fmtUsd(1.5)).toContain('1,50')
    expect(fmtUsd(0.0042)).toContain('0,0042')
    expect(fmtBytes(5 * 1024 * 1024)).toBe('5 MB')
  })
  it('convierte la fila del RPC aunque vengan textos o nulos', () => {
    const f = filaDesdeRpc({ dia: '2026-11-05', funcion: 'x', costo_usd: '0.25', llamadas: '3', tokens_entrada: null })
    expect(f.costoUsd).toBe(0.25)
    expect(f.llamadas).toBe(3)
    expect(f.tokensEntrada).toBe(0)
    expect(f.tipoArchivo).toBe('otro')
  })
})
