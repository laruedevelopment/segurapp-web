import { describe, expect, test } from 'vitest'
import { correoValido, docEsNumerico, docParaGuardar, formatearDoc, limpiar, nitLimpio, oNull, porcentajeValido } from './utilidades'

describe('formatearDoc', () => {
  test('numérico: puntos de miles y guion del NIT', () => {
    expect(formatearDoc('1234567', true)).toBe('1.234.567')
    expect(formatearDoc('900227885-1', true)).toBe('900.227.885-1')
    expect(formatearDoc('1.2a34', true)).toBe('1.234')
    expect(formatearDoc('', true)).toBe('')
  })
  test('con letras: mayúscula, sin puntos ni espacios', () => {
    expect(formatearDoc('ab 12.3-x', false)).toBe('AB123-X')
  })
})

describe('docParaGuardar', () => {
  test('sin puntos; vacío es null', () => {
    expect(docParaGuardar('1.234.567')).toBe('1234567')
    expect(docParaGuardar('900.227.885-1')).toBe('900227885-1')
    expect(docParaGuardar('  ')).toBeNull()
  })
})

describe('otros', () => {
  test('tipos numéricos', () => {
    expect(docEsNumerico('CC')).toBe(true)
    expect(docEsNumerico(null)).toBe(true)
    expect(docEsNumerico('PAS')).toBe(false)
    expect(docEsNumerico('CE')).toBe(false)
  })
  test('limpiar y oNull', () => {
    expect(limpiar('  a   b ')).toBe('a b')
    expect(oNull('   ')).toBeNull()
  })
  test('correo', () => {
    expect(correoValido('')).toBe(true)
    expect(correoValido('a@b.co')).toBe(true)
    expect(correoValido('a@b')).toBe(false)
  })
  test('NIT y porcentaje', () => {
    expect(nitLimpio('860.002.184-6')).toBe('8600021846')
    expect(nitLimpio(' ')).toBeNull()
    expect(porcentajeValido(100)).toBe(true)
    expect(porcentajeValido(100.5)).toBe(false)
    expect(porcentajeValido(-1)).toBe(false)
    expect(porcentajeValido(null)).toBe(true)
  })
})
