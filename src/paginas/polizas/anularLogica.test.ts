import { describe, expect, test } from 'vitest'
import { alternarMarca, idsAAnular, mensajeAnulacion, textoPago, yaAnulado, type PagoAnulable } from './anularLogica'
import { textoMoverPago } from '../comisiones/moverPago'

const pago = (id: number, estado = 'R'): PagoAnulable => ({
  id,
  idrep_pago: 1339,
  fecha_pago: '2019-09-04T00:00:00+00:00',
  vlrabono_prima: 281731,
  estado_pago: estado,
})

describe('textoPago', () => {
  test('reporte, fecha y abono', () => {
    expect(textoPago(pago(1))).toBe('Reporte #1339 · 04/09/2019 · Abono $ 281.731')
  })

  test('sin reporte ni fecha', () => {
    expect(textoPago({ idrep_pago: null, fecha_pago: null, vlrabono_prima: 0 })).toBe('Reporte #— · sin fecha · Abono $ 0')
  })
})

describe('selección de pagos a anular', () => {
  test('alternarMarca no modifica el conjunto original', () => {
    const base = new Set([1])
    const con = alternarMarca(base, 2, true)
    expect([...con].sort()).toEqual([1, 2])
    expect([...base]).toEqual([1])
    expect([...alternarMarca(con, 1, false)]).toEqual([2])
  })

  test('solo se anulan los marcados que existen y no están anulados', () => {
    const abonos = [pago(1), pago(2), pago(3, 'A')]
    expect(idsAAnular(new Set([1, 3, 99]), abonos)).toEqual([1])
    expect(idsAAnular(new Set(), abonos)).toEqual([])
  })

  test('yaAnulado', () => {
    expect(yaAnulado(pago(1, 'A'))).toBe(true)
    expect(yaAnulado(pago(1, 'C'))).toBe(false)
  })
})

describe('mensajeAnulacion', () => {
  test('solo la póliza', () => {
    expect(mensajeAnulacion(0, 0)).toBe('Póliza anulada')
  })
  test('con pagos anulados', () => {
    expect(mensajeAnulacion(2, 0)).toBe('Póliza anulada y 2 pagos anulados')
  })
  test('con fallos', () => {
    expect(mensajeAnulacion(1, 1)).toBe(
      'Póliza anulada y 1 pago anulado. 1 pago no se pudo anular: revíselo en Editar abono',
    )
  })
})

describe('textoMoverPago', () => {
  test('confirmación con número y código de ambas pólizas', () => {
    const t = textoMoverPago({
      valorAbono: 373950,
      desde: { id: 21506, nro: '400-49-994000000228-0' },
      hacia: { id: 30, nro: null },
    })
    expect(t).toContain('El pago de $ 373.950 pasa de la póliza 400-49-994000000228-0 (cód. 21506) a la póliza 30 (cód. 30).')
    expect(t).toContain('Lo pagado y el estado de las dos pólizas se recalculan solos. ¿Continuar?')
  })
})
