import { describe, expect, it } from 'vitest'
import { esRamoVehiculo, extraerPlaca, nombreBien } from './placa'

describe('extraerPlaca', () => {
  it('carros, motos y remolques', () => {
    expect(extraerPlaca('MAZDA 3 2020 PLACA abc-123 color rojo')).toBe('ABC123')
    expect(extraerPlaca('Moto AKT placa XYZ 45D')).toBe('XYZ45D')
    expect(extraerPlaca('Semirremolque S12345')).toBe('S12345')
    expect(extraerPlaca('Casa calle 5 # 3-21')).toBeNull()
    expect(extraerPlaca(null)).toBeNull()
  })
  it('toma la primera si hay varias', () => {
    expect(extraerPlaca('Tractocamión SZZ123 con remolque R54321')).toBe('SZZ123')
  })
})

describe('esRamoVehiculo', () => {
  it('reconoce vehículos', () => {
    expect(esRamoVehiculo('AUTOMOVILES', 'TODO RIESGO')).toBe(true)
    expect(esRamoVehiculo('Vehículos pesados')).toBe(true)
    expect(esRamoVehiculo('TODO RIESGO', null)).toBe(true)
    expect(esRamoVehiculo('SOAT')).toBe(true)
  })
  it('descarta lo demás', () => {
    expect(esRamoVehiculo('TODO RIESGO MAQUINARIA')).toBe(false)
    expect(esRamoVehiculo('INCENDIO', 'HOGAR')).toBe(false)
    expect(esRamoVehiculo('CUMPLIMIENTO')).toBe(false)
  })
})

describe('nombreBien', () => {
  it('solo la placa en vehículos', () => {
    expect(nombreBien('MAZDA 3 2020 PLACA ABC123', 'AUTOMOVILES', 'LIVIANOS')).toBe('ABC123')
  })
  it('deja igual lo que no es vehículo o no tiene placa', () => {
    expect(nombreBien('Edificio ABC 123 piso 4', 'INCENDIO')).toBe('Edificio ABC 123 piso 4')
    expect(nombreBien('Mazda sin placa', 'AUTOMOVILES')).toBe('Mazda sin placa')
    expect(nombreBien('  ', 'AUTOMOVILES')).toBeNull()
  })
})
