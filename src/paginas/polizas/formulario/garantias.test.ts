import { describe, expect, test, vi } from 'vitest'
import type { Aseguradora, Producto, Ramo } from '@/lib/tipos'
import {
  aplicarExtraccion,
  avisoExtraccion,
  buscarClienteExtraido,
  esFamiliaGarantia,
  esPolizaDeGarantia,
  esProductoSeriedad,
  requiereConfirmarSeriedad,
  textoIndicaSeriedad,
  type DepsExtraccion,
} from './extraccion'
import { formVacio, rotulosCliente, type ClienteSel } from './logica'

const aseg = (id: number, nombre: string): Aseguradora => ({ id, nombre_aseg: nombre, nit_aseg: null, clave: null, estado_aseg: true })
const ramo = (id: number, nombre: string): Ramo => ({ id, nombre_ramo: nombre, estado_ramo: true, obs_ramo: null, porcom_base_ramo: null })
const prod = (id: number, nombre: string, ramo_id: number, aseguradora_id: number): Producto => ({
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
})
const cli = (id: number, nombre: string, doc: string | null = null): ClienteSel => ({
  id,
  nombre_cliente: nombre,
  tipodoc_cliente: doc ? 'NIT' : null,
  doc_cliente: doc,
})

const deps = (extra: Partial<DepsExtraccion> = {}): DepsExtraccion => ({
  buscarClientePorDoc: async () => null,
  buscarClientes: async () => [],
  buscarProductoAprendido: async () => null,
  ...extra,
})

describe('detección de garantías', () => {
  test('cumplimiento o seriedad, sin importar tildes ni mayúsculas', () => {
    expect(esFamiliaGarantia(['Cumplimiento'])).toBe(true)
    expect(esFamiliaGarantia([null, 'Garantía de SERIEDAD de la oferta'])).toBe(true)
    expect(esFamiliaGarantia(['Autos', undefined])).toBe(false)
    expect(esFamiliaGarantia([])).toBe(false)
  })
  test('por ramo, producto o bien asegurado de lo que leyó la IA', () => {
    expect(esPolizaDeGarantia({ nombre_ramo: 'Cumplimiento' })).toBe(true)
    expect(esPolizaDeGarantia({ nombre_producto: 'Seriedad de oferta' })).toBe(true)
    expect(esPolizaDeGarantia({ bien_asegurado: 'Contrato de obra: cumplimiento del contrato' })).toBe(true)
    expect(esPolizaDeGarantia({ nombre_ramo: 'Hogar', bien_asegurado: 'Casa' })).toBe(false)
    expect(esPolizaDeGarantia({})).toBe(false)
  })
  test('seriedad', () => {
    expect(textoIndicaSeriedad(['x', 'Seriedad de la oferta'])).toBe(true)
    expect(textoIndicaSeriedad(['Cumplimiento'])).toBe(false)
    expect(esProductoSeriedad({ nombre_prod: 'Seriedad de Oferta' })).toBe(true)
    expect(esProductoSeriedad({ nombre_prod: 'Cumplimiento estatal' })).toBe(false)
    expect(esProductoSeriedad(null)).toBe(false)
  })
})

describe('confirmación "¿Es una póliza de seriedad?" al guardar', () => {
  const cumpl = { nombre_prod: 'Cumplimiento estatal' }
  const base = { ramo: 'Cumplimiento', producto: cumpl, bien: 'Contrato 123', obs: '' }
  test('pide confirmar si habla de seriedad y el producto es de cumplimiento', () => {
    expect(requiereConfirmarSeriedad({ ...base, obs: 'Seriedad de la oferta licitación 5' })).toBe(true)
    expect(requiereConfirmarSeriedad({ ...base, bien: 'SERIEDAD DE OFERTA' })).toBe(true)
  })
  test('no pide si el producto ya es de seriedad, si no es garantía o no habla de seriedad', () => {
    expect(requiereConfirmarSeriedad({ ...base, obs: 'seriedad', producto: { nombre_prod: 'Seriedad de oferta' } })).toBe(false)
    expect(requiereConfirmarSeriedad({ ramo: 'Autos', producto: { nombre_prod: 'Clásico' }, bien: 'seriedad', obs: '' })).toBe(false)
    expect(requiereConfirmarSeriedad(base)).toBe(false)
  })
  test('sin producto elegido, pero ramo de cumplimiento y texto de seriedad: pide confirmar', () => {
    expect(requiereConfirmarSeriedad({ ramo: 'Cumplimiento', producto: null, bien: '', obs: 'seriedad' })).toBe(true)
  })
})

describe('cliente de una garantía: solo el tomador, por NIT', () => {
  const candidatos = [
    { rol: 'tomador' as const, nombre: 'CONSTRUCTORA X SAS', doc: '900.123.456-7' },
    { rol: 'asegurado' as const, nombre: 'ALCALDIA', doc: '800.1-2' },
  ]
  test('soloDocumento: si el NIT no existe no cae al nombre ni a otro rol', async () => {
    const buscarClientes = vi.fn(async () => [cli(5, 'CONSTRUCTORA X SAS')])
    const r = await buscarClienteExtraido(candidatos.slice(0, 1), deps({ buscarClientes }), true)
    expect(r).toEqual({ cliente: null, rol: null })
    expect(buscarClientes).not.toHaveBeenCalled()
  })
  test('soloDocumento: encuentra al tomador por NIT normalizado', async () => {
    const buscarClientePorDoc = vi.fn(async (d: string) => (d === '9001234567' ? cli(7, 'CONSTRUCTORA X SAS', '9001234567') : null))
    const r = await buscarClienteExtraido(candidatos.slice(0, 1), deps({ buscarClientePorDoc }), true)
    expect(r.cliente?.id).toBe(7)
    expect(r.rol).toBe('tomador')
  })
  test('sin soloDocumento sigue cayendo al nombre del tomador', async () => {
    const r = await buscarClienteExtraido(candidatos, deps({ buscarClientes: async () => [cli(5, 'Constructora X SAS')] }))
    expect(r.cliente?.id).toBe(5)
  })
})

describe('aplicarExtraccion con garantías', () => {
  const cat = {
    aseguradoras: [aseg(1, 'SURA')],
    ramos: [ramo(20, 'Cumplimiento')],
    productos: [prod(200, 'Cumplimiento estatal', 20, 1), prod(201, 'Seriedad de oferta', 20, 1)],
  }
  const datos = {
    nombre_aseguradora: 'SURA',
    nombre_ramo: 'Cumplimiento',
    nombre_producto: 'Cumplimiento estatal',
    bien_asegurado: 'Seriedad de la oferta de la licitación 9',
    nombre_cliente: 'CONSTRUCTORA X SAS',
    doc_cliente: '900123456-7',
    nombre_asegurado: 'ALCALDIA',
    doc_asegurado: '8001',
  }

  test('el producto es el de seriedad aunque el texto diga Cumplimiento, y el cliente solo se busca por NIT', async () => {
    const buscarClientePorDoc = vi.fn(async () => null)
    const buscarClientes = vi.fn(async () => [cli(5, 'CONSTRUCTORA X SAS')])
    const r = await aplicarExtraccion(formVacio(), datos, cat, deps({ buscarClientePorDoc, buscarClientes }))
    expect(r.esGarantia).toBe(true)
    expect(r.form.productoId).toBe(201)
    expect(r.form.cliente).toBeNull()
    expect(r.seriedadSinProducto).toBe(false)
    // Solo se probó el NIT del tomador; el asegurado (entidad contratante) no es cliente.
    expect(buscarClientePorDoc).toHaveBeenCalledTimes(1)
    expect(buscarClientePorDoc).toHaveBeenCalledWith('9001234567')
    expect(buscarClientes).not.toHaveBeenCalled()
  })
  test('el tomador existe por NIT: queda como cliente', async () => {
    const r = await aplicarExtraccion(formVacio(), datos, cat, deps({ buscarClientePorDoc: async () => cli(7, 'CONSTRUCTORA X SAS', '9001234567') }))
    expect(r.form.cliente?.id).toBe(7)
  })
  test('seriedad sin producto de seriedad en el catálogo: avisa y deja el de cumplimiento', async () => {
    const sinSeriedad = { ...cat, productos: [prod(200, 'Cumplimiento estatal', 20, 1)] }
    const r = await aplicarExtraccion(formVacio(), datos, sinSeriedad, deps())
    expect(r.seriedadSinProducto).toBe(true)
    expect(r.form.productoId).toBe(200)
  })
  test('una póliza que no es de garantía sigue buscando por nombre y por otros roles', async () => {
    const hogar = { nombre_aseguradora: 'SURA', nombre_ramo: 'Hogar', nombre_cliente: 'Juan Perez', doc_cliente: '1' }
    const buscarClientes = vi.fn(async () => [cli(3, 'Juan Perez')])
    const r = await aplicarExtraccion(formVacio(), hogar, cat, deps({ buscarClientes }))
    expect(r.esGarantia).toBe(false)
    expect(r.form.cliente?.id).toBe(3)
  })
})

describe('avisoExtraccion', () => {
  test('junta aviso_total y aviso_lectura, con un espacio inicial', () => {
    expect(avisoExtraccion({ aviso_total: 'El total no cuadraba.', aviso_lectura: 'Lectura parcial.' })).toBe(
      ' El total no cuadraba. Lectura parcial.',
    )
    expect(avisoExtraccion({ aviso_lectura: 'Solo este.' })).toBe(' Solo este.')
  })
  test('vacío si no hay avisos o no son texto', () => {
    expect(avisoExtraccion({})).toBe('')
    expect(avisoExtraccion({ aviso_total: '', aviso_lectura: null })).toBe('')
    expect(avisoExtraccion({ aviso_total: 5 })).toBe('')
  })
})

describe('rotulosCliente (panel NIT y nombre)', () => {
  test('jurídica o NIT: "NIT" y "Razón social"', () => {
    expect(rotulosCliente({ tipopers_cliente: 'J', tipodoc_cliente: null })).toEqual({ documento: 'NIT', nombre: 'Razón social' })
    expect(rotulosCliente({ tipopers_cliente: 'N', tipodoc_cliente: 'NIT' })).toEqual({ documento: 'NIT', nombre: 'Nombre' })
  })
  test('natural: el tipo de documento, o "Documento"', () => {
    expect(rotulosCliente({ tipopers_cliente: 'N', tipodoc_cliente: 'CC' })).toEqual({ documento: 'CC', nombre: 'Nombre' })
    expect(rotulosCliente({ tipodoc_cliente: null })).toEqual({ documento: 'Documento', nombre: 'Nombre' })
  })
})
