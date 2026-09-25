import { describe, expect, test } from 'vitest'
import type { Poliza, Producto, Ramo } from '@/lib/tipos'
import {
  activosMasSeleccionados,
  aplicarDefaultsProducto,
  cambiarAseguradora,
  conPrima,
  datosParaActualizar,
  debeVerificarNro,
  desdeBorrador,
  desdePoliza,
  excede100,
  formatearNroPoliza,
  formVacio,
  mapaActual,
  nombreArchivoSugerido,
  productosDisponibles,
  ramosDisponibles,
  recalcularComision,
  sugerirComDistrib,
  sugerirFin,
  sumaPorcPrincipal,
  validar,
  vlrParticipante,
  type EstadoForm,
} from './logica'

const ramo = (id: number, nombre = `R${id}`): Ramo => ({ id, nombre_ramo: nombre, estado_ramo: true, obs_ramo: null, porcom_base_ramo: null })
const prod = (id: number, ramo_id: number, aseguradora_id: number, extra: Partial<Producto> = {}): Producto => ({
  id,
  nombre_prod: `P${id}`,
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

const lleno = (extra: Partial<EstadoForm> = {}): EstadoForm => ({
  ...formVacio(),
  fFin: new Date(2027, 0, 1),
  asegId: 1,
  ramoId: 2,
  productoId: 3,
  formaPagoId: 4,
  cliente: { id: 5, nombre_cliente: 'ACME', tipodoc_cliente: 'NIT', doc_cliente: '900' },
  bien: 'Placa ABC123',
  asesor1Id: 6,
  porcAsesor1: 100,
  ...extra,
})

describe('cálculo de comisiones', () => {
  test('la prima es la base y Vlr. Com. = base × %', () => {
    const f = conPrima({ ...formVacio(), porcCom: 12.5, vlrComFija: 1000 }, 1_500_000)
    expect(f.vlrBaseCom).toBe(1_500_000)
    expect(f.vlrCom).toBe(187_500)
    expect(f.comDistrib).toBe(188_500)
  })
  test('redondea a 2 decimales', () => {
    const f = recalcularComision({ ...formVacio(), vlrBaseCom: 100, porcCom: 33.33333 })
    expect(f.vlrCom).toBe(33.33)
  })
  test('sin prima, base y comisión quedan en 0', () => {
    const f = conPrima({ ...formVacio(), porcCom: 10 }, null)
    expect(f.vlrBaseCom).toBe(0)
    expect(f.vlrCom).toBe(0)
  })
  test('el producto trae % com. y % adicional solo si los tiene', () => {
    const base = { ...formVacio(), vlrBaseCom: 1000, porcCom: 5, porcomAdic: 2 }
    const f = aplicarDefaultsProducto(base, { porccom_prod: 10, porcad_prod: null })
    expect(f.porcCom).toBe(10)
    expect(f.porcomAdic).toBe(2)
    expect(f.vlrCom).toBe(100)
  })
  test('Com. a distribuir sugerida = Vlr. Com. + Com. fija', () => {
    expect(sugerirComDistrib({ ...formVacio(), vlrCom: 100.5, vlrComFija: 50 }).comDistrib).toBe(150.5)
  })
  test('valor del participante', () => {
    expect(vlrParticipante(200_000, 25)).toBe(50_000)
    expect(vlrParticipante(null, 25)).toBe(0)
  })
})

describe('tolerancia del 100%', () => {
  test('33,33333 + 33,33333 + 33,33334 no excede', () => {
    const f = { ...formVacio(), porcAsesor1: 33.33333, porcAsesor2: 33.33333, porcAsesor3: 33.33334 }
    expect(excede100(sumaPorcPrincipal(f))).toBe(false)
  })
  test('100,001 sí excede', () => {
    expect(excede100(100.001)).toBe(true)
  })
})

describe('fecha fin automática', () => {
  test('pone inicio + 1 año si está vacía', () => {
    const f = sugerirFin(formVacio(), new Date(2026, 1, 28))
    expect(f.fFin).toEqual(new Date(2027, 1, 28))
    expect(f.finAutomatica).toBe(true)
  })
  test('29 de febrero → 28 de febrero', () => {
    expect(sugerirFin(formVacio(), new Date(2028, 1, 29)).fFin).toEqual(new Date(2029, 1, 28))
  })
  test('no pisa una fecha fin digitada', () => {
    const f = sugerirFin({ ...formVacio(), fFin: new Date(2026, 5, 1), finAutomatica: false }, new Date(2026, 0, 1))
    expect(f.fFin).toEqual(new Date(2026, 5, 1))
  })
  test('sí recalcula la que puso el cálculo', () => {
    const f = sugerirFin({ ...formVacio(), fFin: new Date(2027, 0, 1), finAutomatica: true }, new Date(2026, 3, 10))
    expect(f.fFin).toEqual(new Date(2027, 3, 10))
  })
})

describe('número de póliza', () => {
  test('espacios → guiones', () => {
    expect(formatearNroPoliza(' 1 0987  2 ')).toBe('1-0987-2')
  })
  test('verificar duplicado', () => {
    expect(debeVerificarNro('', 1, null)).toBe(false)
    expect(debeVerificarNro('123', 1, null)).toBe(true)
    expect(debeVerificarNro('1-23', 1, { nro: '1 23', asegId: 1 })).toBe(false)
    expect(debeVerificarNro('124', 1, { nro: '123', asegId: 1 })).toBe(true)
    // Cambió la aseguradora: se vuelve a verificar.
    expect(debeVerificarNro('123', 2, { nro: '123', asegId: 1 })).toBe(true)
  })
})

describe('cascada aseguradora → ramo → producto', () => {
  const ramos = [ramo(1), ramo(2), ramo(3)]
  const productos = [prod(10, 1, 100), prod(11, 2, 100), prod(12, 3, 200), prod(13, 2, 100, { estado_prod: false })]
  test('ramos de la aseguradora', () => {
    expect(ramosDisponibles(ramos, productos, 100).map((r) => r.id)).toEqual([1, 2])
    expect(ramosDisponibles(ramos, productos, null).length).toBe(3)
    expect(ramosDisponibles(ramos, productos, 100, 3).map((r) => r.id)).toEqual([1, 2, 3])
    // Aseguradora sin productos: todos.
    expect(ramosDisponibles(ramos, productos, 999).length).toBe(3)
  })
  test('productos activos del ramo + el inactivo ya elegido', () => {
    expect(productosDisponibles(productos, 2, 100, null).map((p) => p.id)).toEqual([11])
    expect(productosDisponibles(productos, 2, 100, 13).map((p) => p.id)).toEqual([11, 13])
    expect(productosDisponibles(productos, 2, 100, 12).map((p) => p.id)).toEqual([11])
    expect(productosDisponibles(productos, null, 100, 11)).toEqual([])
  })
  test('cambiar aseguradora limpia ramo ajeno y producto', () => {
    const f = cambiarAseguradora({ ...formVacio(), asegId: 100, ramoId: 1, productoId: 10 }, 200, ramos, productos)
    expect(f).toMatchObject({ asegId: 200, ramoId: null, productoId: null })
    const g = cambiarAseguradora({ ...formVacio(), asegId: 200, ramoId: 2, productoId: 12 }, 100, ramos, productos)
    expect(g).toMatchObject({ asegId: 100, ramoId: 2, productoId: null })
  })
  test('activos + seleccionados', () => {
    const lista = [
      { id: 1, activo: true },
      { id: 2, activo: false },
      { id: 3, activo: false },
    ]
    expect(activosMasSeleccionados(lista, (x) => x.activo, [3, null]).map((x) => x.id)).toEqual([1, 3])
  })
})

describe('validar', () => {
  test('formulario completo no tiene errores', () => {
    expect(validar(lleno())).toEqual([])
  })
  test('obligatorios en orden de pantalla', () => {
    expect(validar(formVacio()).map((e) => e.campo)).toEqual([
      'fFin', 'aseg', 'ramo', 'producto', 'formaPago', 'cliente', 'bien', 'asesor1',
    ])
  })
  test('fecha fin anterior al inicio', () => {
    const e = validar(lleno({ fIni: new Date(2027, 5, 1) }))
    expect(e[0].campo).toBe('fFin')
  })
  test('suma de porcentajes', () => {
    expect(validar(lleno({ porcAsesor1: 60, porcAgencia: 41 })).map((e) => e.campo)).toEqual(['porcPrincipal'])
    expect(validar(lleno({ porcAsesorAd: 50, porcAgenciaAd: 50.5 })).map((e) => e.campo)).toEqual(['porcAdicional'])
  })
  test('Com. a distribuir con medio centavo de margen', () => {
    expect(validar(lleno({ vlrCom: 100, vlrComFija: 0, comDistrib: 100.004 }))).toEqual([])
    expect(validar(lleno({ vlrCom: 100, vlrComFija: 0, comDistrib: 100.01 })).map((e) => e.campo)).toEqual(['comDistrib'])
  })
})

describe('guardar', () => {
  test('mapa con ids válidos, fechas ISO y prima/valor en 0', () => {
    const m = mapaActual(lleno({ nro: '12 34', fIni: new Date(2026, 8, 5), intermediarioId: 0, obs: '  ' }), 9)
    expect(m.nro_poliza).toBe('12-34')
    expect(m.fini_poliza).toBe('2026-09-05')
    expect(m.intermediario_id).toBeNull()
    expect(m.prima_poliza).toBe(0)
    expect(m.valor_poliza).toBe(0)
    expect(m.obs_poliza).toBeNull()
    expect(m.cliente_id).toBe(5)
    expect(m.usuario_id).toBe(9)
  })
  test('al editar no envía usuario, ni estado/prima pagada sin cambios', () => {
    const m = mapaActual(lleno({ estadoId: 'I', primaPagada: 500 }), 9)
    const d = datosParaActualizar(m, { estadoId: 'I', primaPagada: 500 })
    expect('usuario_id' in d).toBe(false)
    expect('estado_poliza_id' in d).toBe(false)
    expect('vlrprimapagada_poliza' in d).toBe(false)
    const d2 = datosParaActualizar(m, { estadoId: 'C', primaPagada: 400 })
    expect(d2.estado_poliza_id).toBe('I')
    expect(d2.vlrprimapagada_poliza).toBe(500)
  })
  test('prima pagada vacía que ya estaba vacía no se envía', () => {
    const d = datosParaActualizar(mapaActual(lleno(), 1), { estadoId: null, primaPagada: null })
    expect('vlrprimapagada_poliza' in d).toBe(false)
  })
})

describe('cargar', () => {
  test('borrador guardado por Flutter (fechas con hora)', () => {
    const base = { ...formVacio(), formaPagoId: 7, estadoId: 'I', asesor1Id: 1, porcAsesor1: 100 }
    const { form, clienteId } = desdeBorrador(
      base,
      {
        nro_poliza: 'AB-1',
        cliente_id: 44,
        producto_id: 10,
        ramo_id: 1,
        fini_poliza: '2026-09-01T00:00:00.000',
        ffin_poliza: '2027-09-01T00:00:00.000',
        prima_poliza: 1000,
        vlrcom_poliza: 100,
        vlrcomfija_poliza: 20,
        forma_pago_id: null,
      },
      [prod(10, 1, 100)],
    )
    expect(clienteId).toBe(44)
    expect(form.asegId).toBe(100)
    expect(form.fIni).toEqual(new Date(2026, 8, 1))
    expect(form.comDistrib).toBe(120)
    expect(form.formaPagoId).toBe(7)
    expect(form.estadoId).toBe('I')
    // Como en Flutter, el asesor del borrador reemplaza al predigitado.
    expect(form.asesor1Id).toBeNull()
  })
  test('póliza guardada', () => {
    const p = {
      id: 1, nro_poliza: 'X', cliente_id: 3, nombre_cliente: 'Ana', tipodoc_cliente: 'CC', doc_cliente: '1',
      vlrcom_poliza: 10, vlrcomfija_poliza: 5, vlrcomadic_poliza: 7, fini_poliza: '2026-01-02T00:00:00+00:00',
    } as unknown as Poliza
    const f = desdePoliza(p)
    expect(f.cliente?.nombre_cliente).toBe('Ana')
    expect(f.comDistrib).toBe(15)
    expect(f.comAdicDistrib).toBe(7)
    expect(f.fIni).toEqual(new Date(2026, 0, 2))
  })
  test('nombre de archivo sugerido', () => {
    expect(nombreArchivoSugerido(123, 'poliza.pdf')).toBe('123 - poliza.pdf')
    expect(nombreArchivoSugerido(123, null)).toBeNull()
  })
})
