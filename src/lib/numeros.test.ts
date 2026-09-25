import { describe, expect, test } from 'vitest'
import { fmtDoc, formatearMientrasEscribe, formatearNumCO, parseNumCO, sumarDinero } from './numeros'

describe('parseNumCO', () => {
  test('formato colombiano', () => {
    expect(parseNumCO('1.234.567,89')).toBe(1234567.89)
    expect(parseNumCO('12,5')).toBe(12.5)
    expect(parseNumCO('1.500')).toBe(1500)
    expect(parseNumCO('815.175')).toBe(815175)
  })
  test('un solo punto con 1-2 decimales es decimal', () => {
    expect(parseNumCO('12.5')).toBe(12.5)
    expect(parseNumCO('168093.5')).toBe(168093.5)
    expect(parseNumCO('100.25')).toBe(100.25)
  })
  test('negativos con signo o entre paréntesis', () => {
    expect(parseNumCO('-1.234')).toBe(-1234)
    expect(parseNumCO('(168.093,5)')).toBe(-168093.5)
    expect(parseNumCO('-12,5')).toBe(-12.5)
  })
  test('coma de miles y punto decimal', () => {
    expect(parseNumCO('1,234,567.89')).toBe(1234567.89)
  })
  test('símbolos y vacíos', () => {
    expect(parseNumCO('$ 1.500')).toBe(1500)
    expect(parseNumCO('35%')).toBe(35)
    expect(parseNumCO('')).toBeNull()
    expect(parseNumCO('-')).toBeNull()
    expect(parseNumCO(null)).toBeNull()
  })
})

describe('formatearNumCO', () => {
  test('miles y decimales justos', () => {
    expect(formatearNumCO(1500)).toBe('1.500')
    expect(formatearNumCO(12.5)).toBe('12,5')
    expect(formatearNumCO(1234567.891)).toBe('1.234.567,89')
    expect(formatearNumCO(33.33333, 5)).toBe('33,33333')
    expect(formatearNumCO(-168093.5)).toBe('-168.093,5')
    expect(formatearNumCO(0)).toBe('0')
  })
  test('ida y vuelta sin perder valor', () => {
    for (const v of [0.5, 12.5, 1500, 1234567.89, -168093.5, 33.333]) {
      expect(parseNumCO(formatearNumCO(v, 5))).toBe(v)
    }
  })
})

describe('sumarDinero', () => {
  test('sin error de redondeo', () => {
    const cuotas = Array(10).fill(100000.1)
    expect(cuotas.reduce((s, v) => s + v, 0) >= 1000001).toBe(false)
    expect(sumarDinero(cuotas)).toBe(1000001)
  })
})

describe('formatearMientrasEscribe', () => {
  const tipear = (antes: string, despues: string) => formatearMientrasEscribe(antes, despues)
  test('agrega puntos de miles', () => {
    expect(tipear('123', '1234')).toBe('1.234')
  })
  test('el punto del teclado numérico se vuelve coma decimal', () => {
    expect(tipear('12', '12.')).toBe('12,')
    expect(tipear('12,', '12,5')).toBe('12,5')
  })
  test('pegar valores completos', () => {
    expect(tipear('', '168093.5')).toBe('168.093,5')
    expect(tipear('', '(168.093,5)')).toBe('-168.093,5')
    expect(tipear('', '1,234,567.89')).toBe('1.234.567,89')
  })
  test('respeta el máximo de decimales', () => {
    expect(tipear('1,23', '1,234')).toBe('1,23')
  })
})

describe('fmtDoc', () => {
  test('agrega puntos y respeta el dígito de verificación', () => {
    expect(fmtDoc('9002278851')).toBe('9.002.278.851')
    expect(fmtDoc('900227885-1')).toBe('900.227.885-1')
    expect(fmtDoc('AB123')).toBe('AB123')
  })
})
