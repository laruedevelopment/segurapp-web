import { describe, expect, test } from 'vitest'
import {
  accionesDeCaso,
  casoDesdeFila,
  mensajeCerrados,
  nombreTipoCaso,
  resueltoAutomatico,
  textoResuelto,
  type CasoRevision,
} from './casosLogica'

const caso = (extra: Partial<CasoRevision> = {}): CasoRevision => ({
  id: 1,
  tipo: 'COMISION_RARA',
  titulo: 't',
  descripcion: 'd',
  pregunta: null,
  polizas: [10],
  reporte_id: 5,
  abono_id: 7,
  estado: 'P',
  respuesta: null,
  resuelto_por: null,
  fresuelto: null,
  fcreado: null,
  ...extra,
})

describe('nombreTipoCaso', () => {
  test('nombres en español y "Otro" para lo desconocido', () => {
    expect(nombreTipoCaso('PAGO_SIN_POLIZA')).toBe('Pago sin póliza')
    expect(nombreTipoCaso('POSIBLE_DUPLICADO')).toBe('Posible duplicado')
    expect(nombreTipoCaso('COMISION_RARA')).toBe('Comisión que no cuadra')
    expect(nombreTipoCaso('OTRO')).toBe('Otro')
    expect(nombreTipoCaso('XYZ')).toBe('Otro')
  })
})

describe('casoDesdeFila', () => {
  test('lee una fila completa con quien resolvió', () => {
    const c = casoDesdeFila({
      id: 12,
      tipo: 'POSIBLE_DUPLICADO',
      titulo: 'Póliza repetida',
      descripcion: 'Dos pólizas',
      pregunta: '¿Cuál sobra?',
      polizas: [237, '332'],
      reporte_id: null,
      abono_id: null,
      estado: 'R',
      respuesta: 'Se anuló la 332',
      resuelve: { apodo_usuario: 'ana' },
      fresuelto: '2026-10-01T15:30:00+00:00',
      fcreado: '2026-09-28T12:00:00+00:00',
    })
    expect(c.id).toBe(12)
    expect(c.polizas).toEqual([237, 332])
    expect(c.reporte_id).toBeNull()
    expect(c.resuelto_por).toBe('ana')
    expect(c.fresuelto?.toISOString()).toBe('2026-10-01T15:30:00.000Z')
  })

  test('tolera nulos, fechas inválidas y tipo ausente', () => {
    const c = casoDesdeFila({ id: 3, polizas: null, resuelve: null, fresuelto: 'no-es-fecha', abono_id: '18925' })
    expect(c.tipo).toBe('OTRO')
    expect(c.estado).toBe('P')
    expect(c.polizas).toEqual([])
    expect(c.resuelto_por).toBeNull()
    expect(c.fresuelto).toBeNull()
    expect(c.abono_id).toBe(18925)
    expect(c.titulo).toBe('')
  })
})

describe('resuelto automáticamente', () => {
  test('resuelto sin usuario = automático; pendiente nunca', () => {
    expect(resueltoAutomatico(caso({ estado: 'R', resuelto_por: null }))).toBe(true)
    expect(resueltoAutomatico(caso({ estado: 'R', resuelto_por: 'ana' }))).toBe(false)
    expect(resueltoAutomatico(caso({ estado: 'P' }))).toBe(false)
  })

  test('textos de cierre', () => {
    expect(textoResuelto(caso({ estado: 'R', resuelto_por: null }), '01/10/2026 10:30')).toBe(
      'Resuelto automáticamente el 01/10/2026 10:30',
    )
    expect(textoResuelto(caso({ estado: 'R', resuelto_por: 'ana' }), null)).toBe('Resuelto por ana')
  })

  test('mensaje de casos cerrados al revalidar', () => {
    expect(mensajeCerrados(0)).toBeNull()
    expect(mensajeCerrados(1)).toBe('Un caso ya estaba corregido y se marcó como resuelto.')
    expect(mensajeCerrados(3)).toBe('3 casos ya estaban corregidos y se marcaron como resueltos.')
  })
})

describe('accionesDeCaso', () => {
  test('duplicado pendiente: anular sí, corregir abono no', () => {
    const a = accionesDeCaso(caso({ tipo: 'POSIBLE_DUPLICADO' }), true)
    expect(a.anular).toBe(true)
    expect(a.corregirAbono).toBe(false)
  })

  test('comisión rara pendiente con abono: corregir abono para A y S, no para Digitador', () => {
    expect(accionesDeCaso(caso(), true).corregirAbono).toBe(true)
    const d = accionesDeCaso(caso(), false)
    expect(d.corregirAbono).toBe(false)
    expect(d.verReporte).toBe(false)
    expect(d.verPagos).toBe(false)
  })

  test('un caso resuelto no ofrece anular ni corregir', () => {
    const a = accionesDeCaso(caso({ tipo: 'POSIBLE_DUPLICADO', estado: 'R' }), true)
    expect(a.anular).toBe(false)
    expect(accionesDeCaso(caso({ estado: 'R' }), true).corregirAbono).toBe(false)
  })

  test('sin abono o sin reporte no hay botones de abono ni de reporte', () => {
    const a = accionesDeCaso(caso({ abono_id: null, reporte_id: null }), true)
    expect(a.corregirAbono).toBe(false)
    expect(a.verReporte).toBe(false)
  })
})
