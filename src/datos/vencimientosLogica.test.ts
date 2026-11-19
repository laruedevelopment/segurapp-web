import { describe, expect, it } from 'vitest'
import { estaCerrado, etiquetaEstado, primerTelefono, semaforo, telefonoWhatsapp, textoDias } from './vencimientosLogica'

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
