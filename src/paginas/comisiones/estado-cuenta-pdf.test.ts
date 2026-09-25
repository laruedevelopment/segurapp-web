import { describe, expect, test, vi } from 'vitest'
import type { AbonoPoliza, ReportePago } from '@/datos/pagos'
import { filasInfoPoliza, filasInfoReporte, pdfComprobante, pdfEstadoCuentaPoliza, pdfEstadoCuentaReporte } from './pdf'

// Sin credenciales en las pruebas: el cliente de Supabase no se usa aquí.
vi.mock('@/lib/supabase', () => ({ db: {}, fijarToken: () => {} }))

const abono = (id: number, estado: string, valor: number): AbonoPoliza =>
  ({
    id,
    idrep_pago: 7,
    id_poliza: 55,
    fecha_pago: '2026-09-25T00:00:00+00:00',
    vlrprima_poliza: 1000000,
    vlrabono_prima: valor,
    porccomision: 10,
    vlrcomision: valor / 10,
    porccomad: 2,
    vlrcomad: valor / 50,
    idfactura: null,
    num_factura: 'FE-12/3',
    estado_pago: estado,
    obs_pago: 'Pago parcial',
    usuario_id: 1,
    fcreado: '2026-09-25T14:05:00+00:00',
    fultmod: null,
    nro_poliza: 'ABC-123',
    prima_poliza: 1000000,
    bien_asegurado: 'Vehículo placa XYZ123',
    fini_poliza: '2026-01-01T00:00:00+00:00',
    ffin_poliza: '2027-01-01T00:00:00+00:00',
    estado_poliza_id: 'V',
    nombre_cliente: 'PÉREZ, JUAN',
    doc_cliente: '9002278851',
    tipodoc_cliente: 'NIT',
    tel_cliente: null,
    correo_cliente: null,
    dir_cliente: null,
    nombre_ramo: 'Autos',
    nombre_prod: 'Todo riesgo',
    nombre_aseg: 'Aseguradora X',
    apodo_usuario: 'javi',
    nombre_usuario: 'Javier',
  }) as AbonoPoliza

const reporte = {
  id: 7,
  fecha_rep: '2026-09-25T00:00:00+00:00',
  fini_rep: '2026-09-01T00:00:00+00:00',
  ffin_rep: '2026-09-30T00:00:00+00:00',
  nombre_aseg: 'Aseguradora X',
  nombre_interm: null,
  estado_rep: 'I',
} as ReportePago

const texto = (doc: { output: (t: 'arraybuffer') => ArrayBuffer }) =>
  new TextDecoder('latin1').decode(doc.output('arraybuffer'))

describe('PDF del estado de cuenta', () => {
  test('filas de información', () => {
    const f = filasInfoPoliza(abono(1, 'C', 1), 55, 1000000)
    expect(f).toContainEqual(['Vigencia', '01/01/2026 – 01/01/2027'])
    expect(f).toContainEqual(['Prima total', '$ 1.000.000'])
    expect(filasInfoReporte(reporte)).toContainEqual(['Período', '01/09/2026 – 30/09/2026'])
  })

  test('por póliza: pago de más sale como saldo a favor y los anulados no suman', () => {
    const lista = [abono(1, 'C', 600000), abono(2, 'A', 999999), abono(3, 'R', 500000)]
    const t = texto(pdfEstadoCuentaPoliza({ abonos: lista, info: filasInfoPoliza(lista[0], 55), prima: 1000000, logo: null }))
    expect(t).toContain('Saldo a favor')
    expect(t).toContain('$ 100.000')
    expect(t).toContain('$ 1.100.000')
    expect(t).not.toContain('$ 2.099.999')
  })

  test('por reporte con muchas filas pasa a varias páginas', () => {
    const lista = Array.from({ length: 80 }, (_, i) => abono(i + 1, 'C', 1000))
    const doc = pdfEstadoCuentaReporte({ abonos: lista, reporte, idReporte: 7, logo: null })
    expect(doc.getNumberOfPages()).toBeGreaterThan(1)
    expect(texto(doc)).toContain(`de ${doc.getNumberOfPages()}`)
    expect(texto(doc)).toContain('$ 80.000')
  })

  test('comprobante', () => {
    const t = texto(pdfComprobante({ abono: abono(1, 'C', 500000), logo: null }))
    expect(t).toContain('COMPROBANTE DE PAGO')
    expect(t).toContain('$ 60.000')
  })
})
