import { describe, expect, test } from 'vitest'
import {
  DIAS_RETENCION,
  diasParaBorrarse,
  filtrarYOrdenar,
  limitePurga,
  nroPolizaDe,
  plural,
  quienSubio,
  resumenDe,
  verboOrigen,
  type PendienteBasico,
} from './pendientesLogica'

const dia = 24 * 60 * 60 * 1000
const ahora = new Date('2026-10-18T12:00:00Z')
const hace = (ms: number) => new Date(ahora.getTime() - ms).toISOString()

const p = (id: number, extra: Partial<PendienteBasico> = {}): PendienteBasico => ({
  id,
  datos: {},
  nombre_archivo: null,
  usuario_id: null,
  fcreado: hace(id * dia),
  fdescartado: null,
  ...extra,
})

describe('diasParaBorrarse', () => {
  test('null si no está descartada', () => {
    expect(diasParaBorrarse(null, ahora)).toBeNull()
  })
  test('recién descartada: 7 días', () => {
    expect(diasParaBorrarse(ahora.toISOString(), ahora)).toBe(DIAS_RETENCION)
  })
  test('trunca a días completos, como Dart', () => {
    expect(diasParaBorrarse(hace(2 * dia), ahora)).toBe(5)
    expect(diasParaBorrarse(hace(2 * dia + 3600_000), ahora)).toBe(4) // faltan 4 días y 23 h
    expect(diasParaBorrarse(hace(6 * dia + 12 * 3600_000), ahora)).toBe(0) // falta medio día
  })
  test('vencida o fecha en el futuro quedan dentro de 0 a 7', () => {
    expect(diasParaBorrarse(hace(30 * dia), ahora)).toBe(0)
    expect(diasParaBorrarse(new Date(ahora.getTime() + 3 * dia).toISOString(), ahora)).toBe(7)
  })
  test('fecha inválida → null', () => {
    expect(diasParaBorrarse('no-es-fecha', ahora)).toBeNull()
  })
})

describe('limitePurga', () => {
  test('7 días antes de ahora', () => {
    expect(limitePurga(ahora)).toBe('2026-10-11T12:00:00.000Z')
  })
})

describe('textos', () => {
  test('plural', () => {
    expect(plural(1, 'día', 'días')).toBe('1 día')
    expect(plural(0, 'día', 'días')).toBe('0 días')
    expect(plural(5, 'día', 'días')).toBe('5 días')
  })
  test('resumen: cliente, si no número, si no "Sin datos"', () => {
    expect(resumenDe({ nombre_cliente: ' ACME SAS ', nro_poliza: '1' })).toBe('ACME SAS')
    expect(resumenDe({ nro_poliza: '96-1' })).toBe('96-1')
    expect(resumenDe({ nombre_cliente: '  ' })).toBe('Sin datos')
    expect(resumenDe({})).toBe('Sin datos')
  })
  test('número de póliza', () => {
    expect(nroPolizaDe({ nro_poliza: ' 12-3 ' })).toBe('12-3')
    expect(nroPolizaDe({})).toBe('')
  })
  test('quién la subió', () => {
    const u = new Map([[3, 'DIANA']])
    expect(quienSubio({ usuario_id: 3 }, u)).toBe('DIANA')
    expect(quienSubio({ usuario_id: 9 }, u)).toBe('usuario 9')
    expect(quienSubio({ usuario_id: null }, u)).toBeNull()
    expect(verboOrigen('manual')).toBe('Creada')
    expect(verboOrigen('ia_carga_masiva')).toBe('Subida')
  })
})

describe('filtrarYOrdenar', () => {
  const usuarios = new Map([[1, 'diana'], [2, 'Luis']])
  const lista = [
    p(1, { datos: { nro_poliza: 'AB-100', nombre_cliente: 'Pérez SAS' }, nombre_archivo: 'poliza_uno.pdf', usuario_id: 1 }),
    p(2, { datos: { nro_poliza: 'ZZ-9' }, usuario_id: 2 }),
    p(3, { datos: {}, nombre_archivo: 'scan.jpg' }),
    p(4, { datos: { nro_poliza: 'aa-5' }, usuario_id: 1 }),
  ]
  const base = { texto: '', orden: 'fecha' as const, ascendente: false, descartadas: false, usuarios }
  const ids = (r: PendienteBasico[]) => r.map((x) => x.id)

  test('por fecha de guardado: la más reciente primero (id 1 es la más nueva)', () => {
    expect(ids(filtrarYOrdenar(lista, base))).toEqual([1, 2, 3, 4])
    expect(ids(filtrarYOrdenar(lista, { ...base, ascendente: true }))).toEqual([4, 3, 2, 1])
  })
  test('por código', () => {
    expect(ids(filtrarYOrdenar(lista, { ...base, orden: 'cod' }))).toEqual([4, 3, 2, 1])
    expect(ids(filtrarYOrdenar(lista, { ...base, orden: 'cod', ascendente: true }))).toEqual([1, 2, 3, 4])
  })
  test('por número: las que no tienen quedan siempre al final', () => {
    expect(ids(filtrarYOrdenar(lista, { ...base, orden: 'nro', ascendente: true }))).toEqual([4, 1, 2, 3])
    expect(ids(filtrarYOrdenar(lista, { ...base, orden: 'nro', ascendente: false }))).toEqual([2, 1, 4, 3])
  })
  test('en descartadas ordena por la fecha de descarte', () => {
    const d = [p(1, { fdescartado: hace(1 * dia) }), p(2, { fdescartado: hace(5 * dia) }), p(3, { fdescartado: hace(3 * dia) })]
    expect(ids(filtrarYOrdenar(d, { ...base, descartadas: true }))).toEqual([1, 3, 2])
    expect(ids(filtrarYOrdenar(d, { ...base, descartadas: true, ascendente: true }))).toEqual([2, 3, 1])
  })
  test('filtra por código (con o sin #)', () => {
    expect(ids(filtrarYOrdenar(lista, { ...base, texto: '#3' }))).toEqual([3])
    expect(ids(filtrarYOrdenar(lista, { ...base, texto: '2' }))).toEqual([2])
  })
  test('filtra por número de póliza ignorando guiones y mayúsculas', () => {
    expect(ids(filtrarYOrdenar(lista, { ...base, texto: 'ab100' }))).toEqual([1])
    expect(ids(filtrarYOrdenar(lista, { ...base, texto: 'AA 5' }))).toEqual([4])
  })
  test('filtra por archivo, cliente y quien la subió', () => {
    expect(ids(filtrarYOrdenar(lista, { ...base, texto: 'scan' }))).toEqual([3])
    expect(ids(filtrarYOrdenar(lista, { ...base, texto: 'pérez' }))).toEqual([1])
    expect(ids(filtrarYOrdenar(lista, { ...base, texto: 'DIANA' }))).toEqual([1, 4])
    expect(ids(filtrarYOrdenar(lista, { ...base, texto: 'luis' }))).toEqual([2])
  })
  test('sin coincidencias → vacío, y no altera la lista original', () => {
    const copia = [...lista]
    expect(filtrarYOrdenar(lista, { ...base, texto: 'inexistente' })).toEqual([])
    expect(lista).toEqual(copia)
  })
})
