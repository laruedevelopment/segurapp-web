import { describe, expect, it } from 'vitest'
import { esErrorDeVersionNueva } from './versionNueva'

describe('esErrorDeVersionNueva', () => {
  it('reconoce los mensajes de los navegadores', () => {
    expect(esErrorDeVersionNueva(new TypeError('Failed to fetch dynamically imported module: https://x/assets/Formulario-abc.js'))).toBe(true)
    expect(esErrorDeVersionNueva(new Error('error loading dynamically imported module'))).toBe(true)
    expect(esErrorDeVersionNueva(new TypeError('Importing a module script failed.'))).toBe(true)
  })
  it('ignora otros errores', () => {
    expect(esErrorDeVersionNueva(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(esErrorDeVersionNueva(null)).toBe(false)
  })
})
