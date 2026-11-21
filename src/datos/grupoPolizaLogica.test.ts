import { describe, expect, it } from 'vitest'
import { anexoDe, claveGrupo, colapsarAnexos, nucleoPoliza, vigenciasDe } from './grupoPolizaLogica'

describe('número base y anexo', () => {
  it('con los números reales de la agencia', () => {
    expect(nucleoPoliza('400-40-994000012539-5')).toBe('994000012539')
    expect(nucleoPoliza('400-40-994000012539')).toBe('994000012539')
    expect(nucleoPoliza('101004014-0')).toBe('101004014')
    expect(nucleoPoliza('101004014')).toBe('101004014')
    expect(nucleoPoliza('3001-4411030-0')).toBe('4411030')
    expect(nucleoPoliza('96-31-101000745-0')).toBe('101000745')
    expect(nucleoPoliza('0013300-1')).toBe('13300')
  })
  it('sin número usable', () => {
    expect(nucleoPoliza(null)).toBeNull()
    expect(nucleoPoliza('12-3')).toBeNull()
  })
  it('el anexo es el último segmento si no es el número base', () => {
    expect(anexoDe('400-40-994000012539-5')).toBe('5')
    expect(anexoDe('400-40-994000012539-0')).toBe('0')
    expect(anexoDe('101004014')).toBe('')
    expect(anexoDe('400-40-994000012539')).toBe('')
  })
  it('la clave del grupo une aseguradora y número base', () => {
    expect(claveGrupo(10, '400-40-994000012539-5')).toBe('10|994000012539')
    expect(claveGrupo(10, '400-40-994000012539-8')).toBe('10|994000012539')
    expect(claveGrupo(3, '400-40-994000012539-5')).not.toBe(claveGrupo(10, '400-40-994000012539-5'))
    expect(claveGrupo(null, '101004014-0')).toBeNull()
  })
})

describe('vigencias de un grupo', () => {
  const f = (id: number, nro: string, fin: string, bien: string | null = null, obs: string | null = null) => ({ id, nro, fin, bien, obs })
  it('una vigencia por año, la más reciente primero, con los anexos adentro y las placas de todos', () => {
    const v = vigenciasDe([
      f(1, '3001-4411030-0', '2025-10-10', 'KSW194'),
      f(2, '3001-4411030-3', '2026-10-10', 'COLECTIVA', 'KSW194 - KTK168'),
      f(3, '3001-4411030-4', '2026-10-10', 'COLECTIVA', 'LVY184'),
      f(4, '3001-4411030-2', '2026-10-10', 'COLECTIVA', 'KSW194 - KTK168'),
    ])
    expect(v.map((x) => x.fin)).toEqual(['2026-10-10', '2025-10-10'])
    expect(v[0].filas.map((x) => x.id)).toEqual([4, 2, 3]) // por anexo: 2, 3, 4
    expect(v[0].placas).toEqual(['KSW194', 'KTK168', 'LVY184'])
    expect(v[1].placas).toEqual(['KSW194'])
  })
})

describe('colapsar anexos de la misma vigencia', () => {
  const f = (id: number, nro: string, fin: string, bien: string | null, obs: string | null = null, asegId = 10) => ({ id, nro, fin, bien, obs, asegId })
  it('deja una fila por vigencia, con la cuenta de anexos y todas las placas', () => {
    const r = colapsarAnexos([
      f(1, '3001-4411030-2', '2026-10-10', 'COLECTIVA', 'KSW194 - KTK168'),
      f(2, '3001-4411030-3', '2026-10-10', 'COLECTIVA', 'LVY184'),
      f(3, '3001-4411030-1', '2025-10-10', 'KSW194'),
      f(4, '77-12', '2026-01-01', 'sin numero util'),
    ])
    expect(r.map((x) => [x.id, x.anexos])).toEqual([[2, 1], [3, 0], [4, 0]])
    expect(r[0].placas).toEqual(['KSW194', 'KTK168', 'LVY184'])
  })
  it('mismo número base en otra aseguradora no se mezcla', () => {
    const r = colapsarAnexos([f(1, '3001-4411030-2', '2026-10-10', 'A', null, 10), f(2, '3001-4411030-3', '2026-10-10', 'B', null, 3)])
    expect(r).toHaveLength(2)
  })
})
