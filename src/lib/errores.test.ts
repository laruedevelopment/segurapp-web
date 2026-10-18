import { describe, expect, test, vi } from 'vitest'
import { mensajeAmigable } from './errores'

vi.spyOn(console, 'error').mockImplementation(() => {})

describe('mensajeAmigable', () => {
  test('llave foránea → "en uso", sin texto técnico', () => {
    const m = mensajeAmigable({ code: '23503', message: 'violates foreign key constraint' }, 'No se pudo eliminar')
    expect(m.startsWith('No se pudo eliminar. ')).toBe(true)
    expect(m).toContain('en uso')
    expect(m.toLowerCase()).not.toContain('constraint')
  })
  test('duplicado, permisos y sesión', () => {
    expect(mensajeAmigable({ code: '23505' })).toContain('Ya existe')
    expect(mensajeAmigable({ code: '42501' })).toContain('permiso')
    expect(mensajeAmigable({ code: 'PGRST301', message: 'JWT expired' })).toContain('sesión venció')
  })
  test('mensajes de las funciones de la base (P0001) pasan tal cual', () => {
    expect(mensajeAmigable({ code: 'P0001', message: 'Solo un Administrador puede ver el historial.' })).toBe(
      'Solo un Administrador puede ver el historial.',
    )
  })
  test('red y tiempo', () => {
    expect(mensajeAmigable(new TypeError('Failed to fetch'))).toContain('Sin conexión')
    expect(mensajeAmigable(new Error('timeout'))).toContain('tardó demasiado')
  })
  test('errores propios de la app y desconocidos', () => {
    expect(mensajeAmigable(new Error('El archivo pesa más de 15 MB.'), 'Error al importar')).toBe(
      'Error al importar. El archivo pesa más de 15 MB.',
    )
    expect(mensajeAmigable(undefined)).toContain('error inesperado')
  })
})
