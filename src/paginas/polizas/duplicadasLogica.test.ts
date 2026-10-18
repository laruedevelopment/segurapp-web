import { describe, expect, test } from 'vitest'
import { grupoResuelto, polizasActivas, resumirGrupos, tipoDeGrupo, type PolizaClasificable } from './duplicadasLogica'

const p = (extra: Partial<PolizaClasificable> = {}): PolizaClasificable => ({
  estado_poliza_id: 'V',
  cliente_id: 1,
  prima_poliza: 1000,
  fini_poliza: '2026-01-01',
  ffin_poliza: '2027-01-01',
  ...extra,
})

describe('tipoDeGrupo', () => {
  test('idénticas: mismo cliente, prima y vigencia', () => {
    expect(tipoDeGrupo([p(), p()])).toBe('identicas')
  })

  test('distinta prima o distinta vigencia', () => {
    expect(tipoDeGrupo([p(), p({ prima_poliza: 1200 })])).toBe('distintaPrimaOVigencia')
    expect(tipoDeGrupo([p(), p({ ffin_poliza: '2027-02-01' })])).toBe('distintaPrimaOVigencia')
  })

  test('distinto cliente gana sobre prima distinta', () => {
    expect(tipoDeGrupo([p(), p({ cliente_id: 2, prima_poliza: 5 })])).toBe('distintoCliente')
  })

  test('las anuladas no cuentan mientras queden dos activas', () => {
    const g = [p(), p(), p({ estado_poliza_id: 'A', cliente_id: 9, prima_poliza: 1 })]
    expect(tipoDeGrupo(g)).toBe('identicas')
  })

  test('si queda una sola activa, se clasifica con todas las pólizas del grupo', () => {
    const g = [p(), p({ estado_poliza_id: 'A', cliente_id: 2 })]
    expect(tipoDeGrupo(g)).toBe('distintoCliente')
  })
})

describe('grupo resuelto', () => {
  test('resuelto cuando queda menos de dos activas', () => {
    expect(grupoResuelto([p(), p()])).toBe(false)
    expect(grupoResuelto([p(), p({ estado_poliza_id: 'A' })])).toBe(true)
    expect(grupoResuelto([p({ estado_poliza_id: 'A' }), p({ estado_poliza_id: 'A' })])).toBe(true)
  })

  test('polizasActivas quita las anuladas', () => {
    expect(polizasActivas([p(), p({ estado_poliza_id: 'A' }), p({ estado_poliza_id: null })])).toHaveLength(2)
  })
})

describe('resumirGrupos', () => {
  const identicas = [p(), p()]
  const distintaPrima = [p(), p({ prima_poliza: 7 }), p({ prima_poliza: 8 })]
  const otroCliente = [p(), p({ cliente_id: 3 })]
  const resuelto = [p(), p({ estado_poliza_id: 'A' })]
  const grupos = [identicas, distintaPrima, otroCliente, resuelto]

  test('por defecto solo los pendientes, con conteos por tipo', () => {
    const r = resumirGrupos(grupos, false, null)
    expect(r.base).toHaveLength(3)
    expect(r.resueltos).toBe(1)
    expect(r.conteo).toEqual({ identicas: 1, distintaPrimaOVigencia: 1, distintoCliente: 1 })
    expect(r.visibles).toHaveLength(3)
    expect(r.totalPolizas).toBe(7)
  })

  test('incluir resueltos suma el grupo resuelto al conteo (clasificado con todas sus pólizas)', () => {
    const r = resumirGrupos(grupos, true, null)
    expect(r.base).toHaveLength(4)
    // El resuelto (una activa + una anulada del mismo cliente, misma prima) cuenta como "idéntico".
    expect(r.conteo).toEqual({ identicas: 2, distintaPrimaOVigencia: 1, distintoCliente: 1 })
  })

  test('el filtro deja solo el tipo elegido y recalcula el total de pólizas', () => {
    const r = resumirGrupos(grupos, false, 'distintaPrimaOVigencia')
    expect(r.visibles).toEqual([distintaPrima])
    expect(r.totalPolizas).toBe(3)
  })

  test('sin grupos todo queda en cero', () => {
    const r = resumirGrupos([], false, 'identicas')
    expect(r.visibles).toEqual([])
    expect(r.resueltos).toBe(0)
    expect(r.totalPolizas).toBe(0)
  })
})
