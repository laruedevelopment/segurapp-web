import { describe, expect, it } from 'vitest'
import { ORIGEN_MANUAL, etiquetaOrigen, origenDeBorrador, origenDePendiente, origenEnBorrador } from './origen'

describe('origen', () => {
  it('etiquetas', () => {
    expect(etiquetaOrigen('ia')).toBe('Con IA (formulario)')
    expect(etiquetaOrigen('masiva')).toBe('Carga masiva con IA')
    expect(etiquetaOrigen('manual')).toBe('Manual')
    expect(etiquetaOrigen(null)).toBe('Sin dato')
  })
  it('el borrador recuerda el origen', () => {
    const datos = origenEnBorrador({ nro_poliza: '1' }, { origen: 'ia', iaDesde: '2026-11-19T10:00:00Z', iaHasta: '2026-11-19T10:00:09Z' })
    expect(datos.nro_poliza).toBe('1')
    expect(origenDeBorrador(datos)).toEqual({ origen: 'ia', iaDesde: '2026-11-19T10:00:00Z', iaHasta: '2026-11-19T10:00:09Z' })
  })
  it('borrador sin marca o con marca rara: manual', () => {
    expect(origenDeBorrador({})).toEqual(ORIGEN_MANUAL)
    expect(origenDeBorrador({ __origen: 'otro' })).toEqual(ORIGEN_MANUAL)
  })
  it('pendiente de carga masiva', () => {
    expect(origenDePendiente({ estado: 'pendiente_revision', datos: {} })).toEqual({ origen: 'masiva' })
    expect(origenDePendiente({ estado: 'borrador', datos: { __origen: 'ia' } }).origen).toBe('ia')
  })
})
