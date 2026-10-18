import { describe, expect, test } from 'vitest'
import { normalizarTexto, resolverMunicipio } from './municipios'

const lista = [
  { id: 1, nombre_munic: 'Bogotá, D.C.' },
  { id: 2, nombre_munic: 'Medellín' },
  { id: 3, nombre_munic: 'Santa Rosa' },
  { id: 4, nombre_munic: 'Santa Rosa' },
  { id: 5, nombre_munic: 'Cali' },
  { id: 6, nombre_munic: 'Calima' },
  { id: 7, nombre_munic: 'Ñapa' },
]

describe('normalizarTexto', () => {
  test('sin tildes, minúsculas, sin signos y con espacios simples', () => {
    expect(normalizarTexto('Bogotá, D.C.')).toBe('bogota d c')
    expect(normalizarTexto('  MEDELLÍN  ')).toBe('medellin')
    expect(normalizarTexto('Ñapa')).toBe('napa')
    expect(normalizarTexto('...')).toBe('')
  })
})

describe('resolverMunicipio', () => {
  test('coincidencia exacta ignorando tildes, mayúsculas y espacios', () => {
    expect(resolverMunicipio(lista, 'medellin')?.id).toBe(2)
    expect(resolverMunicipio(lista, '  MEDELLÍN ')?.id).toBe(2)
    expect(resolverMunicipio(lista, 'bogota d c')?.id).toBe(1)
    expect(resolverMunicipio(lista, 'napa')?.id).toBe(7)
  })
  test('sin exacta, un único municipio que empiece por el texto', () => {
    expect(resolverMunicipio(lista, 'mede')?.id).toBe(2)
    expect(resolverMunicipio(lista, 'bogo')?.id).toBe(1)
  })
  test('la exacta gana aunque haya otros que empiezan igual (Cali / Calima)', () => {
    expect(resolverMunicipio(lista, 'cali')?.id).toBe(5)
  })
  test('ambiguo → null', () => {
    expect(resolverMunicipio(lista, 'santa rosa')).toBeNull() // dos con el mismo nombre
    expect(resolverMunicipio(lista, 'cal')).toBeNull() // Cali y Calima
  })
  test('sin coincidencia o vacío → null', () => {
    expect(resolverMunicipio(lista, 'Pasto')).toBeNull()
    expect(resolverMunicipio(lista, '   ')).toBeNull()
    expect(resolverMunicipio([], 'cali')).toBeNull()
  })
})
