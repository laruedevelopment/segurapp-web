import { describe, expect, it } from 'vitest'
import { EMPRESA_POR_DEFECTO } from '@/lib/empresa'
import { validarEmpresa } from './logica'

describe('validarEmpresa', () => {
  it('los datos de Rueda Serrano son válidos', () => {
    expect(validarEmpresa(EMPRESA_POR_DEFECTO)).toEqual({})
  })
  it('exige lo obligatorio', () => {
    const e = validarEmpresa({ ...EMPRESA_POR_DEFECTO, nombre: ' ', nit: '', ciudad: '' })
    expect(e).toEqual({ nombre: 'Obligatorio', nit: 'Obligatorio', ciudad: 'Obligatorio' })
  })
  it('la frase y el país pueden ir vacíos', () => {
    expect(validarEmpresa({ ...EMPRESA_POR_DEFECTO, eslogan: '', pais: '' })).toEqual({})
  })
  it('valida el correo, el teléfono y el largo', () => {
    expect(validarEmpresa({ ...EMPRESA_POR_DEFECTO, correo: 'sin-arroba' }).correo).toMatch(/válido/)
    expect(validarEmpresa({ ...EMPRESA_POR_DEFECTO, celular: '12' }).celular).toMatch(/válido/)
    expect(validarEmpresa({ ...EMPRESA_POR_DEFECTO, nombre: 'x'.repeat(121) }).nombre).toMatch(/Máximo 120/)
  })
})
