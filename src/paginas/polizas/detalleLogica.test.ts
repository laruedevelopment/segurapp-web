import { describe, expect, it } from 'vitest'
import { entradasDetalle } from './detalleLogica'

describe('entradasDetalle', () => {
  it('ordena lo conocido, formatea y omite vacíos e ids', () => {
    const r = entradasDetalle({
      id: 5,
      prima: 1000,
      nro_poliza: 'A-1',
      nombre_cliente: '',
      fecha_inicio: '2026-01-09',
      cliente_id: 3,
      campo_raro: 'x',
      nulo: null,
    })
    expect(r.map((e) => e.etiqueta)).toEqual(['N.º de póliza', 'Inicio de vigencia', 'Prima', 'Campo raro'])
    expect(r[1].valor).toContain('2026')
    expect(r[2].valor).toContain('1.000')
  })

  it('no repite una etiqueta cuando llegan dos claves equivalentes', () => {
    const r = entradasDetalle({ nombre_aseg: 'SOLIDARIA', nombre_aseguradora: 'SOLIDARIA' })
    expect(r).toHaveLength(1)
  })
})
