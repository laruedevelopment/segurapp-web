import { afterEach, describe, expect, it } from 'vitest'
import { EMPRESA_POR_DEFECTO, contactoEmpresa, empresaActual, fijarEmpresa } from './empresa'

afterEach(() => fijarEmpresa(null))

describe('empresa', () => {
  it('sin configuración es Rueda Serrano', () => {
    expect(empresaActual()).toEqual(EMPRESA_POR_DEFECTO)
    expect(contactoEmpresa()).toEqual(['Celular: 3153729644', 'Correo: lstellaserranom@yahoo.com', 'Bucaramanga - Colombia'])
  })
  it('aplica lo configurado y respalda lo vacío', () => {
    fijarEmpresa({ nombre: ' Agencia Norte ', nit: '900.111.222-3', ciudad: '', correo: null })
    expect(empresaActual().nombre).toBe('Agencia Norte')
    expect(empresaActual().nit).toBe('900.111.222-3')
    expect(empresaActual().ciudad).toBe('Bucaramanga')
    expect(empresaActual().correo).toBe(EMPRESA_POR_DEFECTO.correo)
  })
})
