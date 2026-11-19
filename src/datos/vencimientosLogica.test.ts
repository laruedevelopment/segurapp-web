import { describe, expect, it } from 'vitest'
import { rangoDias, rangoPorDefecto, rangoValido, estaCerrado, resumir, textoResumen, etiquetaEstado, primerTelefono, semaforo, telefonoWhatsapp, textoDias } from './vencimientosLogica'

describe('semaforo', () => {
  it('clasifica por días', () => {
    expect(semaforo(-1)).toBe('vencida')
    expect(semaforo(0)).toBe('rojo')
    expect(semaforo(15)).toBe('rojo')
    expect(semaforo(16)).toBe('ambar')
    expect(semaforo(30)).toBe('ambar')
    expect(semaforo(31)).toBe('verde')
  })
})

describe('textoDias', () => {
  it('redacta', () => {
    expect(textoDias(0)).toBe('Vence hoy')
    expect(textoDias(1)).toBe('Vence mañana')
    expect(textoDias(9)).toBe('En 9 días')
    expect(textoDias(-1)).toBe('Venció ayer')
    expect(textoDias(-4)).toBe('Venció hace 4 días')
  })
})

describe('estados', () => {
  it('etiqueta y cierre', () => {
    expect(etiquetaEstado(null)).toBe('Por recordar')
    expect(etiquetaEstado('R')).toBe('Renovará')
    expect(estaCerrado('F')).toBe(true)
    expect(estaCerrado('N')).toBe(true)
    expect(estaCerrado('C')).toBe(false)
  })
})

describe('teléfonos', () => {
  it('WhatsApp solo con celulares', () => {
    expect(telefonoWhatsapp('310 123 4567')).toBe('573101234567')
    expect(telefonoWhatsapp('+57 310 123 4567')).toBe('573101234567')
    expect(telefonoWhatsapp('6076543210')).toBeNull()
    expect(telefonoWhatsapp(null)).toBeNull()
  })
  it('toma el primero', () => {
    expect(primerTelefono('3101234567 / 6076543210')).toBe('3101234567')
    expect(primerTelefono('')).toBeNull()
  })
})

describe('resumen', () => {
  it('cuenta por semáforo e ignora las cerradas', () => {
    const r = resumir([
      { dias: -3, estado: 'P' },
      { dias: 5, estado: 'P' },
      { dias: 5, estado: 'C' },
      { dias: 20, estado: 'R' },
      { dias: 40, estado: 'P' },
      { dias: 2, estado: 'F' },
    ])
    expect(r).toEqual({ urgentes: 2, vencidas: 1, rojo: 2, ambar: 1, verde: 1, porAtender: 5, renovara: 1 })
    expect(textoResumen(r)).toBe('1 vencida · 2 en rojo (15 días o menos) · 1 en ámbar · 5 por atender · 1 renovará')
  })
  it('sin nada por atender', () => {
    expect(textoResumen(resumir([]))).toContain('Nada por atender')
  })
})

describe('rangos', () => {
  it('calcula por defecto y valida', () => {
    const h = new Date(2026, 10, 19)
    expect(rangoPorDefecto(h)).toEqual({ desde: '2026-10-20', hasta: '2027-01-03' })
    expect(rangoDias(h, 0, 7)).toEqual({ desde: '2026-11-19', hasta: '2026-11-26' })
    expect(rangoValido({ desde: '2026-11-20', hasta: '2026-11-19' })).toBe(false)
    expect(rangoValido({ desde: '', hasta: '2026-11-19' })).toBe(false)
    expect(rangoValido({ desde: '2026-11-19', hasta: '2026-11-19' })).toBe(true)
  })
})
