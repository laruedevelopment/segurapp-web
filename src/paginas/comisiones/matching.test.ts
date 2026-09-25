import { describe, expect, test } from 'vitest'
import { anexoSiCorresponde, mismoDocumento, resolverMatch, seIncluyeSolo, type PolizaMatch } from './matching'

// Mismas pruebas de test/datos/matching_reporte_pago_test.dart (app Flutter).

const p = (id: number, nro: string, { doc = '900159756', aseg = 1, prima = 100 } = {}): PolizaMatch => ({
  id,
  nro_poliza: nro,
  doc_cliente: doc,
  aseg_id: aseg,
  prima_poliza: prima,
})

describe('anexoSiCorresponde', () => {
  test('segmento exacto devuelve el anexo registrado', () => {
    expect(anexoSiCorresponde('400-97-994000000046-6', '994000000046')).toBe('6')
    expect(anexoSiCorresponde('994000000046-0', '994000000046')).toBe('0')
  })
  test('no coincide por "contiene"', () => {
    expect(anexoSiCorresponde('994000000047-0', '994000000046')).toBeNull()
    expect(anexoSiCorresponde('1994000000046-0', '994000000046')).toBeNull()
    expect(anexoSiCorresponde('101010543-5', '10543')).toBeNull()
  })
  test('ignora ceros a la izquierda', () => {
    expect(anexoSiCorresponde('0994000000046-00', '994000000046')).toBe('0')
  })
  test('póliza registrada sin anexo', () => {
    expect(anexoSiCorresponde('B-100071475', '100071475')).toBe('')
    expect(anexoSiCorresponde('100071475', '100071475')).toBe('')
  })
  test('núcleo y anexo pegados en pólizas viejas', () => {
    expect(anexoSiCorresponde('9940000001936', '994000000193', '6')).toBe('6')
    expect(anexoSiCorresponde('9940000001936', '994000000193', '5')).toBeNull()
  })
})

describe('resolverMatch — casos del reporte de Solidaria (FUNDACION COLOMBIA COLLEGE)', () => {
  // En la base solo existe la …046 anexo 0.
  const base = [p(1, '994000000046-0')]

  test('046 anexo 0 → exacta', () => {
    const r = resolverMatch({ nucleo: '994000000046', anexo: '0', docCliente: '900159756', candidatos: base })
    expect(r.estado).toBe('exacta')
    expect(r.poliza!.id).toBe(1)
    expect(seIncluyeSolo(r)).toBe(true)
  })
  test('046 anexo 6 → anexo no registrado, sin asignar', () => {
    const r = resolverMatch({ nucleo: '994000000046', anexo: '6', docCliente: '900159756', candidatos: base })
    expect(r.estado).toBe('anexoNoRegistrado')
    expect(r.poliza).toBeNull()
    expect(r.candidatos.map((x) => x.id)).toEqual([1])
  })
  test('047 (otra póliza del mismo cliente) → no encontrada, NO se asigna la única del cliente', () => {
    const r = resolverMatch({
      nucleo: '994000000047',
      anexo: '0',
      docCliente: '900159756',
      candidatos: base,
      polizasDelCliente: base,
    })
    expect(r.estado).toBe('noEncontrada')
    expect(r.poliza).toBeNull()
    expect(r.candidatos.map((x) => x.id)).toEqual([1])
  })
})

describe('resolverMatch — varios anexos registrados', () => {
  const base = [p(1, '101003571-0'), p(2, '101003571-1'), p(3, '101003572-0')]

  test('elige el anexo exacto', () => {
    const r = resolverMatch({ nucleo: '101003571', anexo: '1', docCliente: '900159756', candidatos: base })
    expect(r.estado).toBe('exacta')
    expect(r.poliza!.id).toBe(2)
  })
  test('sin anexo en el reporte y varias → ambigua, ordenada por prima más cercana', () => {
    const ps = [p(1, '100078459-0', { prima: 500 }), p(2, '100078459-1', { prima: 1582395 })]
    const r = resolverMatch({ nucleo: '100078459', candidatos: ps, primaLinea: 1582395 })
    expect(r.estado).toBe('ambigua')
    expect(r.poliza).toBeNull()
    expect(r.candidatos[0].id).toBe(2)
  })
  test('sin anexo en el reporte y una sola → única', () => {
    const r = resolverMatch({
      nucleo: '100022101',
      candidatos: [p(9, '100022101-0', { doc: '91078726' })],
      docCliente: '91078726',
    })
    expect(r.estado).toBe('unicaSinAnexo')
    expect(r.poliza!.id).toBe(9)
  })
  test('mismo número+anexo registrado dos veces → ambigua', () => {
    const r = resolverMatch({ nucleo: '105005925', anexo: '0', candidatos: [p(1, '105005925-0'), p(2, '105005925-0')] })
    expect(r.estado).toBe('ambigua')
  })
})

describe('resolverMatch — verificaciones de seguridad', () => {
  test('documento distinto → revisar (asignada pero no se incluye sola)', () => {
    const r = resolverMatch({
      nucleo: '101011263',
      anexo: '1',
      docCliente: '1098633206',
      candidatos: [p(1, '101011263-1', { doc: '999' })],
    })
    expect(r.estado).toBe('revisar')
    expect(r.poliza!.id).toBe(1)
    expect(seIncluyeSolo(r)).toBe(false)
  })
  test('documento con puntos se compara normalizado', () => {
    const r = resolverMatch({
      nucleo: '101011263',
      anexo: '1',
      docCliente: '1.098.633.206',
      candidatos: [p(1, '101011263-1', { doc: '1098633206' })],
    })
    expect(r.estado).toBe('exacta')
  })
  test('otra aseguradora con el mismo número se descarta', () => {
    const r = resolverMatch({
      nucleo: '101011263',
      anexo: '1',
      aseguradoraId: 1,
      candidatos: [p(1, '101011263-1', { aseg: 2 })],
    })
    expect(r.estado).toBe('noEncontrada')
  })
  test('póliza registrada sin anexo y reporte con anexo → revisar', () => {
    const r = resolverMatch({ nucleo: '100071475', anexo: '3', candidatos: [p(1, 'B-100071475')] })
    expect(r.estado).toBe('revisar')
    expect(seIncluyeSolo(r)).toBe(false)
  })
  test('candidatos repetidos no generan falsa ambigüedad', () => {
    const x = p(1, '994000000193-6')
    const r = resolverMatch({ nucleo: '994000000193', anexo: '6', candidatos: [x, x] })
    expect(r.estado).toBe('exacta')
  })
})

describe('ajustes de la revisión', () => {
  test('número y anexo pegados nunca es exacta', () => {
    const r = resolverMatch({ nucleo: '100071475', anexo: '1', candidatos: [p(1, '1000714751')] })
    expect(r.estado).toBe('revisar')
    expect(seIncluyeSolo(r)).toBe(false)
  })
  test('número muy corto solo coincide con el número completo', () => {
    expect(anexoSiCorresponde('400-97-994000000046-6', '97')).toBeNull()
    expect(anexoSiCorresponde('400-97-994000000046-6', '400')).toBeNull()
    expect(anexoSiCorresponde('97', '97')).toBe('')
  })
  test('segmento con letras pegadas', () => {
    expect(anexoSiCorresponde('AUT12345-1', '12345')).toBe('1')
  })
  test('documento con o sin dígito de verificación', () => {
    expect(mismoDocumento('900159756', '900159756-1')).toBe(true)
    expect(mismoDocumento('900159756', '900159757')).toBe(false)
    const r = resolverMatch({
      nucleo: '994000000046',
      anexo: '0',
      docCliente: '900159756',
      candidatos: [p(1, '994000000046-0', { doc: '900159756-1' })],
    })
    expect(r.estado).toBe('exacta')
  })
})
