import { describe, expect, test, vi } from 'vitest'
import type { Aseguradora, Producto, Ramo } from '@/lib/tipos'
import {
  aplicarExtraccion,
  aprendizajeAlGuardar,
  buscarClienteExtraido,
  clienteExtraidoPorRol,
  fechaISO,
  matchPorNombre,
  normalizarTextoIA,
  sugerenciaVacia,
  type DepsExtraccion,
} from './extraccion'
import { formVacio, type ClienteSel } from './logica'

const aseg = (id: number, nombre: string): Aseguradora => ({ id, nombre_aseg: nombre, nit_aseg: null, clave: null, estado_aseg: true })
const ramo = (id: number, nombre: string): Ramo => ({ id, nombre_ramo: nombre, estado_ramo: true, obs_ramo: null, porcom_base_ramo: null })
const prod = (id: number, nombre: string, ramo_id: number, aseguradora_id: number, extra: Partial<Producto> = {}): Producto => ({
  id,
  nombre_prod: nombre,
  ramo_id,
  aseguradora_id,
  estado_prod: true,
  vlrfijocom_prod: null,
  porccom_prod: null,
  desc_prod: null,
  porcad_prod: null,
  obs_prod: null,
  ...extra,
})
const cli = (id: number, nombre: string): ClienteSel => ({ id, nombre_cliente: nombre, tipodoc_cliente: null, doc_cliente: null })

const cat = {
  aseguradoras: [aseg(1, 'SURA'), aseg(2, 'Seguros Bolívar')],
  ramos: [ramo(10, 'Autos'), ramo(11, 'Hogar'), ramo(12, 'Accidentes Personales'), ramo(13, 'Vida')],
  productos: [
    prod(100, 'Autos Clásico', 10, 1, { porccom_prod: 12 }),
    prod(101, 'Hogar Plus', 11, 1),
    prod(102, 'Accidentes Escolares', 12, 2, { porccom_prod: 20, porcad_prod: 3 }),
  ],
}

const deps = (extra: Partial<DepsExtraccion> = {}): DepsExtraccion => ({
  buscarClientePorDoc: async () => null,
  buscarClientes: async () => [],
  buscarProductoAprendido: async () => null,
  ...extra,
})

describe('normalización y matching por nombre', () => {
  test('igual que Flutter: mayúsculas y sin tildes (sin colapsar espacios)', () => {
    expect(normalizarTextoIA('  Bolívar Ñandú ')).toBe('BOLIVAR NANDU')
    expect(normalizarTextoIA('a  b')).toBe('A  B')
  })
  test('igual, contenido y mismas palabras en otro orden', () => {
    const lista = ['Seguros Bolívar', 'SURA', 'Juan Pérez Gómez']
    expect(matchPorNombre(lista, (x) => x, 'SEGUROS BOLIVAR')).toBe('Seguros Bolívar')
    expect(matchPorNombre(lista, (x) => x, 'Bolívar')).toBe('Seguros Bolívar')
    expect(matchPorNombre(lista, (x) => x, 'PEREZ GOMEZ, JUAN')).toBe('Juan Pérez Gómez')
    expect(matchPorNombre(lista, (x) => x, 'Allianz')).toBeNull()
    expect(matchPorNombre(lista, (x) => x, '  ')).toBeNull()
  })
  test('fechas ISO de la IA', () => {
    expect(fechaISO('2026-03-05')).toEqual(new Date(2026, 2, 5))
    expect(fechaISO('2026-02-30')).toBeNull()
    expect(fechaISO('')).toBeNull()
    expect(fechaISO(5)).toBeNull()
  })
})

describe('cliente por documento en cascada', () => {
  test('gana el primer documento que ya existe, sin importar el rol', async () => {
    const porDoc = vi.fn(async (d: string) => (d === '900123' ? cli(7, 'ACME') : null))
    const r = await buscarClienteExtraido(
      [
        { rol: 'tomador', nombre: 'X', doc: '111' },
        { rol: 'asegurado', nombre: 'ACME', doc: '900.123' },
        { rol: 'beneficiario', nombre: 'Y', doc: '222' },
      ],
      deps({ buscarClientePorDoc: porDoc }),
    )
    expect(r).toEqual({ cliente: cli(7, 'ACME'), rol: 'asegurado' })
    expect(porDoc).toHaveBeenCalledTimes(2)
  })
  test('sin documento, busca el nombre del tomador por su palabra más larga', async () => {
    const buscar = vi.fn(async () => [cli(1, 'Pedro Gómez'), cli(2, 'Juan Pérez Gómez')])
    const r = await buscarClienteExtraido(
      [
        { rol: 'tomador', nombre: 'PEREZ GOMEZ, JUAN', doc: null },
        { rol: 'asegurado', nombre: null, doc: null },
      ],
      deps({ buscarClientes: buscar }),
    )
    expect(buscar).toHaveBeenCalledWith('PEREZ', 20)
    expect(r.cliente?.id).toBe(2)
    expect(r.rol).toBe('tomador')
  })
  test('un error en la búsqueda no rompe la importación', async () => {
    const r = await buscarClienteExtraido(
      [{ rol: 'tomador', nombre: 'A', doc: '1' }],
      deps({ buscarClientePorDoc: async () => { throw new Error('red') } }),
    )
    expect(r).toEqual({ cliente: null, rol: null })
  })
})

describe('aplicarExtraccion', () => {
  test('completa campos, deriva el ramo del producto y aplica sus %', async () => {
    const r = await aplicarExtraccion(
      { ...formVacio(), asesor1Id: 5, porcAsesor1: 100 },
      {
        nro_poliza: 'B-100-0',
        nombre_aseguradora: 'Seguros Bolivar',
        nombre_producto: 'ACCIDENTES ESCOLARES',
        fecha_inicio: '2026-01-10',
        prima: 1_000_000,
        bien_asegurado: 'Colegio',
        doc_cliente: '900.123.456-7',
      },
      cat,
      deps({ buscarClientePorDoc: async (d) => (d === '9001234567' ? cli(9, 'COLEGIO') : null) }),
    )
    expect(r.form).toMatchObject({
      nro: 'B-100-0',
      asegId: 2,
      ramoId: 12,
      productoId: 102,
      porcCom: 20,
      porcomAdic: 3,
      vlrBaseCom: 1_000_000,
      vlrCom: 200_000,
      bien: 'Colegio',
      asesor1Id: 5,
    })
    expect(r.form.cliente?.id).toBe(9)
    // Sin fecha fin en el documento: inicio + 1 año, marcada automática.
    expect(r.form.fFin).toEqual(new Date(2027, 0, 10))
    // nro, aseg, cliente, f.ini, prima, bien, ramo, producto
    expect(r.completados).toBe(8)
    expect(r.sugerencia).toEqual({
      productoSugeridoId: 102,
      textoProducto: 'ACCIDENTES ESCOLARES',
      asegIdProducto: 2,
      clienteSugeridoId: 9,
      rolCliente: 'tomador',
      asegIdCliente: 2,
    })
  })
  test('el producto aprendido tiene prioridad', async () => {
    const r = await aplicarExtraccion(
      formVacio(),
      { nombre_aseguradora: 'SURA', nombre_producto: 'PLAN HOGAR' },
      cat,
      deps({ buscarProductoAprendido: async (a, t) => (a === 1 && t === 'PLAN HOGAR' ? 101 : null) }),
    )
    expect(r.form.productoId).toBe(101)
    expect(r.form.ramoId).toBe(11)
  })
  test('el nombre del ramo también sirve para encontrar el producto', async () => {
    const r = await aplicarExtraccion(formVacio(), { nombre_aseguradora: 'SURA', nombre_ramo: 'Autos', nombre_producto: 'Todo riesgo' }, cat, deps())
    expect(r.form).toMatchObject({ ramoId: 10, productoId: 100, porcCom: 12 })
    expect(r.sugerencia.productoSugeridoId).toBe(100)
  })
  test('sin producto, intenta el ramo por nombre y guarda el texto para aprender', async () => {
    const r = await aplicarExtraccion(formVacio(), { nombre_aseguradora: 'SURA', nombre_ramo: 'Vida', nombre_producto: 'Todo riesgo' }, cat, deps())
    expect(r.form.ramoId).toBe(13)
    expect(r.form.productoId).toBeNull()
    expect(r.sugerencia.textoProducto).toBe('TODO RIESGO')
    expect(r.sugerencia.productoSugeridoId).toBeNull()
  })
  test('otra aseguradora limpia el ramo/producto que no le pertenecen', async () => {
    const r = await aplicarExtraccion(
      { ...formVacio(), asegId: 1, ramoId: 10, productoId: 100 },
      { nombre_aseguradora: 'Seguros Bolívar' },
      cat,
      deps(),
    )
    expect(r.form).toMatchObject({ asegId: 2, ramoId: null, productoId: null })
  })
  test('documento sin datos', async () => {
    const r = await aplicarExtraccion(formVacio(), {}, cat, deps())
    expect(r.completados).toBe(0)
    expect(r.sugerencia).toEqual(sugerenciaVacia())
  })
})

describe('aprendizaje al guardar', () => {
  const sug = {
    productoSugeridoId: 100,
    textoProducto: 'AUTOS',
    asegIdProducto: 1,
    clienteSugeridoId: 9,
    rolCliente: 'asegurado' as const,
    asegIdCliente: 1,
  }
  test('corrigió el producto: se registra; lo dejó igual: no', () => {
    expect(aprendizajeAlGuardar(sug, { productoId: 101, clienteId: null, asegId: 1 }).producto).toEqual({
      asegId: 1,
      texto: 'AUTOS',
      productoId: 101,
    })
    expect(aprendizajeAlGuardar(sug, { productoId: 100, clienteId: null, asegId: 1 }).producto).toBeNull()
    // Cambió la aseguradora: no se aprende.
    expect(aprendizajeAlGuardar(sug, { productoId: 101, clienteId: null, asegId: 2 }).producto).toBeNull()
  })
  test('eligió un producto cuando la IA no encontró ninguno', () => {
    expect(aprendizajeAlGuardar({ ...sug, productoSugeridoId: null }, { productoId: 100, clienteId: null, asegId: 1 }).producto).not.toBeNull()
  })
  test('refuerza el rol solo si confirmó el mismo cliente y aseguradora', () => {
    expect(aprendizajeAlGuardar(sug, { productoId: null, clienteId: 9, asegId: 1 }).rol).toEqual({ asegId: 1, rol: 'asegurado' })
    expect(aprendizajeAlGuardar(sug, { productoId: null, clienteId: 8, asegId: 1 }).rol).toBeNull()
    expect(aprendizajeAlGuardar(sugerenciaVacia(), { productoId: 1, clienteId: 1, asegId: 1 })).toEqual({ producto: null, rol: null })
  })
  test('cliente sugerido según el rol preferido', () => {
    const datos = { nombre_cliente: 'T', doc_cliente: '1', nombre_asegurado: 'A', doc_asegurado: '2' }
    expect(clienteExtraidoPorRol(datos, 'asegurado')).toEqual({ nombre: 'A', doc: '2' })
    expect(clienteExtraidoPorRol(datos, null)).toEqual({ nombre: 'T', doc: '1' })
  })
})
