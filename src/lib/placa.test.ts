import { describe, expect, it } from 'vitest'
import { esRamoVehiculo, extraerPlaca, extraerPlacas, nombreBien } from './placa'

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

describe('pólizas colectivas (varias placas)', () => {
  it('extrae todas las placas, sin repetir y en orden', () => {
    expect(extraerPlacas('FLOTA: ABC123, KTL-356 y moto XYZ45D. Remolque R54321. Repite abc 123')).toEqual(['ABC123', 'KTL356', 'XYZ45D', 'R54321'])
    expect(extraerPlacas('sin placas')).toEqual([])
    expect(extraerPlaca('KTL356 y ABC123')).toBe('KTL356')
  })
  it('el nombre del bien muestra todas las placas de un vehículo colectivo', () => {
    expect(nombreBien('5 vehículos: ABC123, KTL356, DSR643, NQS607, TUV482', 'LIVIANOS', 'AUTOMOVILES')).toBe('ABC123 · KTL356 · DSR643 · NQS607 · TUV482')
    expect(nombreBien('Local ABC 123 piso 2', 'INCENDIO')).toBe('Local ABC 123 piso 2')
  })
})
