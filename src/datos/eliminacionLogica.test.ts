import { describe, expect, it } from 'vitest'
import {
  MAX_SELECCION,
  agruparPorLote,
  alternarSeleccion,
  confirmacionValida,
  elegidasVisibles,
  idsMarcadas,
  mensajeMarcadas,
  mensajeResueltas,
  motivoValido,
  palabraPlural,
  parsearHistorial,
  parsearResultado,
  parsearSolicitud,
  plural,
  seleccionarVisibles,
  sinIdsEnCache,
  tituloOmitidasResolver,
  tituloOmitidasSolicitar,
} from './eliminacionLogica'

const filas = (n: number, desde = 1) => Array.from({ length: n }, (_, i) => ({ id: desde + i }))

describe('motivoValido', () => {
  it('exige 5 caracteres que no sean espacios', () => {
    expect(motivoValido('')).toBe(false)
    expect(motivoValido('    ')).toBe(false)
    expect(motivoValido('ab c d')).toBe(false) // 4 reales
    expect(motivoValido('ab c de')).toBe(true) // 5 reales
    expect(motivoValido('repetida')).toBe(true)
  })
  it('no cuenta saltos de línea, tabs ni espacios duros', () => {
    expect(motivoValido('a\n\tb c d')).toBe(false)
    expect(motivoValido('\n\n  a b c d e  \t')).toBe(true)
  })
})

describe('confirmacionValida', () => {
  it('acepta ELIMINAR sin importar mayúsculas ni espacios de los lados', () => {
    expect(confirmacionValida('ELIMINAR')).toBe(true)
    expect(confirmacionValida('  eliminar ')).toBe(true)
    expect(confirmacionValida('Eliminar')).toBe(true)
    expect(confirmacionValida('ELIMINA')).toBe(false)
    expect(confirmacionValida('')).toBe(false)
    expect(confirmacionValida('ELIMI NAR')).toBe(false)
  })
})

describe('plurales', () => {
  it('usa singular solo con 1', () => {
    expect(plural(0, 'póliza', 'pólizas')).toBe('0 pólizas')
    expect(plural(1, 'póliza', 'pólizas')).toBe('1 póliza')
    expect(plural(2, 'póliza', 'pólizas')).toBe('2 pólizas')
    expect(palabraPlural(1, 'tiene', 'tienen')).toBe('tiene')
    expect(palabraPlural(3, 'tiene', 'tienen')).toBe('tienen')
  })
})

describe('selección', () => {
  it('alterna una póliza', () => {
    const a = alternarSeleccion(new Set(), 5)
    expect([...a.sel]).toEqual([5])
    const b = alternarSeleccion(a.sel, 5)
    expect(b.sel.size).toBe(0)
    expect(b.excedido).toBe(false)
  })
  it('no pasa del máximo y avisa', () => {
    const llena = new Set(filas(MAX_SELECCION).map((p) => p.id))
    const r = alternarSeleccion(llena, 9999)
    expect(r.excedido).toBe(true)
    expect(r.sel.size).toBe(MAX_SELECCION)
    expect(r.sel.has(9999)).toBe(false)
    // Quitar una estando llena sí se puede.
    expect(alternarSeleccion(llena, 1).sel.size).toBe(MAX_SELECCION - 1)
  })
  it('no modifica el conjunto original', () => {
    const base = new Set([1])
    alternarSeleccion(base, 2)
    expect([...base]).toEqual([1])
  })
  it('"seleccionar todas las visibles" recorta a 200', () => {
    const corto = seleccionarVisibles(filas(3))
    expect(corto.sel.size).toBe(3)
    expect(corto.recortado).toBe(false)
    const largo = seleccionarVisibles(filas(250))
    expect(largo.sel.size).toBe(MAX_SELECCION)
    expect(largo.recortado).toBe(true)
    expect(largo.sel.has(201)).toBe(false)
  })
  it('solo cuentan las seleccionadas que siguen visibles con el filtro', () => {
    const sel = new Set([1, 2, 3, 99])
    const visibles = [{ id: 2 }, { id: 3 }, { id: 4 }]
    expect(elegidasVisibles(visibles, sel).map((p) => p.id)).toEqual([2, 3])
    expect(elegidasVisibles([], sel)).toEqual([])
  })
})

describe('parsearResultado', () => {
  it('lee solicitadas y omitidas', () => {
    const r = parsearResultado({ solicitadas: 3, omitidas: [{ id: 7, razon: 'Tiene pagos' }, { id: '9', razon: null }] })
    expect(r.hechas).toBe(3)
    expect(r.omitidas).toEqual([
      { id: 7, razon: 'Tiene pagos' },
      { id: 9, razon: '' },
    ])
  })
  it('lee resueltas (resolver)', () => {
    expect(parsearResultado({ resueltas: 2, omitidas: [] })).toEqual({ hechas: 2, omitidas: [] })
  })
  it('no se rompe con datos raros', () => {
    expect(parsearResultado(null)).toEqual({ hechas: 0, omitidas: [] })
    expect(parsearResultado('x')).toEqual({ hechas: 0, omitidas: [] })
    expect(parsearResultado({ solicitadas: 'dos', omitidas: 'no' })).toEqual({ hechas: 0, omitidas: [] })
    expect(parsearResultado({ resueltas: 1, omitidas: [null, {}, { id: 4, razon: 'r' }] }).omitidas).toEqual([{ id: 4, razon: 'r' }])
  })
  it('idsMarcadas descarta las omitidas', () => {
    const r = parsearResultado({ solicitadas: 2, omitidas: [{ id: 2, razon: 'x' }] })
    expect(idsMarcadas([1, 2, 3], r)).toEqual([1, 3])
  })
})

describe('parsearSolicitud / parsearHistorial', () => {
  it('convierte los campos de la base', () => {
    const s = parsearSolicitud({
      id: 10,
      poliza_id: '55',
      lote: 'abc',
      motivo: 'repetida',
      solicitado_en: '2026-10-01T10:00:00Z',
      solicitado_por: 'maria',
      nro_poliza: '1-2',
      prima: '1500000.5',
      n_pagos: 2,
    })
    expect(s).toMatchObject({ id: 10, polizaId: 55, lote: 'abc', prima: 1500000.5, nPagos: 2, cliente: null, solicitadoPor: 'maria' })
    expect(parsearSolicitud({}).solicitadoPor).toBe('—')
    const h = parsearHistorial({ id: 1, poliza_id: 2, estado: 'aprobada', resuelto_por: 'admin', nota: 'ok' })
    expect(h).toMatchObject({ estado: 'aprobada', resueltoPor: 'admin', nota: 'ok', solicitadoPor: '—' })
  })
  it('agrupa por lote conservando el orden', () => {
    const mk = (id: number, lote: string) => parsearSolicitud({ id, poliza_id: id, lote })
    const g = agruparPorLote([mk(1, 'a'), mk(2, 'b'), mk(3, 'a')])
    expect(g.map((l) => l.map((s) => s.id))).toEqual([[1, 3], [2]])
  })
})

describe('textos', () => {
  it('mensajes de marcado', () => {
    expect(mensajeMarcadas(1, { id: 8, nro_poliza: 'X-1' })).toContain('Quedó marcada la póliza X-1 (cód. 8)')
    expect(mensajeMarcadas(1, { id: 8, nro_poliza: null })).toContain('sin número')
    expect(mensajeMarcadas(4)).toContain('Quedaron marcadas 4 pólizas')
  })
  it('títulos de resultados parciales', () => {
    expect(tituloOmitidasSolicitar(2, 1)).toBe('Se enviaron 2; 1 no se pudieron enviar')
    expect(tituloOmitidasSolicitar(0, 1)).toBe('No se pudo enviar la póliza')
    expect(tituloOmitidasSolicitar(0, 3)).toBe('No se pudo enviar ninguna')
    expect(tituloOmitidasResolver(true, 2, 1)).toBe('Se eliminaron 2. No se pudieron eliminar 1')
    expect(tituloOmitidasResolver(false, 2, 1)).toBe('Se restauraron 2. No se pudieron restaurar 1')
  })
  it('mensajes al resolver, con plural real', () => {
    expect(mensajeResueltas(true, 1)).toBe('Listo: 1 póliza eliminada para siempre.')
    expect(mensajeResueltas(true, 3)).toBe('Listo: 3 pólizas eliminadas para siempre.')
    expect(mensajeResueltas(false, 1)).toBe('Listo: 1 póliza volvió a las listas.')
    expect(mensajeResueltas(false, 2)).toBe('Listo: 2 pólizas volvieron a las listas.')
  })
})

describe('sinIdsEnCache', () => {
  const fuera = new Set([2])
  it('filtra listas y la copia completa', () => {
    expect(sinIdsEnCache([{ id: 1 }, { id: 2 }], fuera)).toEqual([{ id: 1 }])
    const completa = { polizas: [{ id: 1 }, { id: 2 }], cargadasEn: 'x' }
    expect(sinIdsEnCache(completa, fuera)).toEqual({ polizas: [{ id: 1 }], cargadasEn: 'x' })
  })
  it('deja igual lo que no es una lista de pólizas', () => {
    expect(sinIdsEnCache(undefined, fuera)).toBeUndefined()
    expect(sinIdsEnCache(5, fuera)).toBe(5)
  })
})
