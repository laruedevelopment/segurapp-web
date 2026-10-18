import { describe, expect, test } from 'vitest'
import { filtroBusquedaReportes, limitesRangoFechas } from '@/datos/pagos-filtros'
import { filtrarAbonos } from './estado-cuenta-calculos'

describe('filtroBusquedaReportes', () => {
  test('vacío no filtra', () => {
    expect(filtroBusquedaReportes('   ')).toBe('')
  })
  test('texto: aseguradora e intermediario, sin código', () => {
    const f = filtroBusquedaReportes('sura')
    expect(f).toContain('nombre_aseg.ilike."%sura%"')
    expect(f).toContain('nombre_interm.ilike."%sura%"')
    expect(f).not.toContain('id.eq')
  })
  test('número o #número agrega id.eq', () => {
    expect(filtroBusquedaReportes('1418')).toContain(',id.eq.1418')
    expect(filtroBusquedaReportes('#1418')).toContain(',id.eq.1418')
    expect(filtroBusquedaReportes('# 1418')).toContain(',id.eq.1418')
  })
  test('no numérico con # no agrega código', () => {
    expect(filtroBusquedaReportes('#14a')).not.toContain('id.eq')
  })
  test('escapa comas, paréntesis y comillas', () => {
    const f = filtroBusquedaReportes('ACME, (LTDA) "X"')
    expect(f).toContain('nombre_aseg.ilike."%ACME, (LTDA) \\"X\\"%"')
  })
})

describe('limitesRangoFechas', () => {
  test('ambos días incluidos y en día local', () => {
    expect(limitesRangoFechas(new Date(2026, 0, 5), new Date(2026, 0, 31, 23, 59))).toEqual({
      gte: '2026-01-05',
      lte: '2026-01-31',
    })
  })
  test('extremos vacíos', () => {
    expect(limitesRangoFechas(null, undefined)).toEqual({ gte: null, lte: null })
    expect(limitesRangoFechas(new Date(2026, 8, 1), null)).toEqual({ gte: '2026-09-01', lte: null })
  })
})

describe('filtrarAbonos', () => {
  const abonos = [
    { id_poliza: 57, nro_poliza: 'AB-123/4', nombre_cliente: 'Juan Pérez' },
    { id_poliza: 570, nro_poliza: null, nombre_cliente: 'María Gómez' },
    { id_poliza: 9, nro_poliza: '999', nombre_cliente: null },
  ]
  test('sin texto devuelve todo', () => {
    expect(filtrarAbonos(abonos, '  ')).toHaveLength(3)
  })
  test('código exacto, con o sin #', () => {
    expect(filtrarAbonos(abonos, '57').map((a) => a.id_poliza)).toEqual([57])
    expect(filtrarAbonos(abonos, '#9').map((a) => a.id_poliza)).toEqual([9])
  })
  test('número normalizado', () => {
    expect(filtrarAbonos(abonos, 'ab123 4').map((a) => a.id_poliza)).toEqual([57])
  })
  test('cliente sin importar mayúsculas', () => {
    expect(filtrarAbonos(abonos, 'gómez').map((a) => a.id_poliza)).toEqual([570])
  })
  test('sin coincidencias', () => {
    expect(filtrarAbonos(abonos, 'zzz')).toEqual([])
  })
})
