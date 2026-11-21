import { describe, expect, it } from 'vitest'
import type { Producto, Ramo } from '@/lib/tipos'
import { formVacio } from './logica'
import { prellenarSoat } from './soat'

const ramo = (id: number, nombre: string, activo = true) => ({ id, nombre_ramo: nombre, estado_ramo: activo }) as Ramo
const prod = (id: number, nombre: string, ramoId: number, aseg = 9) => ({ id, nombre_prod: nombre, ramo_id: ramoId, aseguradora_id: aseg, estado_prod: true }) as Producto
const vehiculo = { cliente: { id: 5, nombre_cliente: 'ANA', tipodoc_cliente: 'CC', doc_cliente: '1' }, bien: 'MAZDA 3 PLACA ABC123', asesor1Id: 3, porcAsesor1: 100, intermediarioId: 2 }

describe('prellenarSoat', () => {
  it('arma el SOAT con la placa, el cliente y el producto REC SOAT', () => {
    const f = prellenarSoat(formVacio(), vehiculo, '2027-11-25', [ramo(1, 'LIVIANOS'), ramo(2, 'SOAT')], [prod(10, 'OTRO', 2), prod(11, 'REC SOAT', 2, 7)])!
    expect(f.bien).toBe('ABC123')
    expect(f.ramoId).toBe(2)
    expect(f.productoId).toBe(11)
    expect(f.asegId).toBe(7)
    expect(f.cliente?.id).toBe(5)
    expect(f.asesor1Id).toBe(3)
    expect(f.fFin?.getFullYear()).toBe(2027)
  })
  it('en una póliza colectiva registra la placa elegida', () => {
    const colectiva = { ...vehiculo, bien: 'FLOTA ABC123, KTL356, DSR643' }
    const f = prellenarSoat(formVacio(), colectiva, null, [ramo(2, 'SOAT')], [prod(11, 'REC SOAT', 2)], 'ktl356')!
    expect(f.bien).toBe('KTL356')
    expect(prellenarSoat(formVacio(), colectiva, null, [ramo(2, 'SOAT')], [prod(11, 'REC SOAT', 2)])!.bien).toBe('ABC123')
  })
  it('sin fecha deja el fin vacío; sin ramo SOAT devuelve null', () => {
    const f = prellenarSoat(formVacio(), vehiculo, null, [ramo(2, 'SOAT')], [prod(11, 'REC SOAT', 2)])!
    expect(f.fFin).toBeNull()
    expect(prellenarSoat(formVacio(), vehiculo, null, [ramo(1, 'LIVIANOS')], [])).toBeNull()
  })
})
