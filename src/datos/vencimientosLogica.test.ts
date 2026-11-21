import { describe, expect, it } from 'vitest'
import { claveRenovacion, renovadasAutomaticamente, rangoDias, rangoPorDefecto, rangoValido, estaCerrado, resumir, textoResumen, etiquetaEstado, primerTelefono, semaforo, telefonoWhatsapp, textoDias } from './vencimientosLogica'

describe('semaforo', () => {
  it('clasifica por días', () => {
    expect(semaforo(-1)).toBe('vencida')
    expect(semaforo(0)).toBe('rojo')
    expect(semaforo(15)).toBe('rojo')
    expect(semaforo(16)).toBe('ambar')
    expect(semaforo(30)).toBe('ambar')
    expect(semaforo(31)).toBe('verde')
  })
})

describe('textoDias', () => {
  it('redacta', () => {
    expect(textoDias(0)).toBe('Vence hoy')
    expect(textoDias(1)).toBe('Vence mañana')
    expect(textoDias(9)).toBe('En 9 días')
    expect(textoDias(-1)).toBe('Venció ayer')
    expect(textoDias(-4)).toBe('Venció hace 4 días')
  })
})

describe('estados', () => {
  it('etiqueta y cierre', () => {
    expect(etiquetaEstado(null)).toBe('Por recordar')
    expect(etiquetaEstado('R')).toBe('Renovará')
    expect(estaCerrado('F')).toBe(true)
    expect(estaCerrado('N')).toBe(true)
    expect(estaCerrado('C')).toBe(false)
  })
})

describe('teléfonos', () => {
  it('WhatsApp solo con celulares', () => {
    expect(telefonoWhatsapp('310 123 4567')).toBe('573101234567')
    expect(telefonoWhatsapp('+57 310 123 4567')).toBe('573101234567')
    expect(telefonoWhatsapp('6076543210')).toBeNull()
    expect(telefonoWhatsapp(null)).toBeNull()
  })
  it('toma el primero', () => {
    expect(primerTelefono('3101234567 / 6076543210')).toBe('3101234567')
    expect(primerTelefono('')).toBeNull()
  })
})

describe('resumen', () => {
  it('cuenta por semáforo e ignora las cerradas', () => {
    const r = resumir([
      { dias: -3, estado: 'P' },
      { dias: 5, estado: 'P' },
      { dias: 5, estado: 'C' },
      { dias: 20, estado: 'R' },
      { dias: 40, estado: 'P' },
      { dias: 2, estado: 'F' },
    ])
    expect(r).toEqual({ urgentes: 2, vencidas: 1, rojo: 2, ambar: 1, verde: 1, porAtender: 5, renovara: 1 })
    expect(textoResumen(r)).toBe('1 vencida · 2 en rojo (15 días o menos) · 1 en ámbar · 5 por atender · 1 renovará')
  })
  it('sin nada por atender', () => {
    expect(textoResumen(resumir([]))).toContain('Nada por atender')
  })
})

describe('rangos', () => {
  it('calcula por defecto y valida', () => {
    const h = new Date(2026, 10, 19)
    expect(rangoPorDefecto(h)).toEqual({ desde: '2026-10-20', hasta: '2027-01-03' })
    expect(rangoDias(h, 0, 7)).toEqual({ desde: '2026-11-19', hasta: '2026-11-26' })
    expect(rangoValido({ desde: '2026-11-20', hasta: '2026-11-19' })).toBe(false)
    expect(rangoValido({ desde: '', hasta: '2026-11-19' })).toBe(false)
    expect(rangoValido({ desde: '2026-11-19', hasta: '2026-11-19' })).toBe(true)
  })
})

describe('renovación automática', () => {
  const base = { clienteId: 1, ramoId: 7 }
  it('clave por placa o por texto, y null sin bien', () => {
    expect(claveRenovacion({ ramoId: 7, bien: 'dsr-643' })).toBe('7|DSR643')
    expect(claveRenovacion({ ramoId: 7, bien: 'Casa Cra. 5 #3' })).toBe('7|casacra53')
    expect(claveRenovacion({ ramoId: 7, bien: '  ' })).toBeNull()
    expect(claveRenovacion({ ramoId: null, bien: 'ABC123' })).toBeNull()
  })
  it('marca renovada si hay otra posterior con la misma placa', () => {
    const a = { id: 1, ...base, bien: 'DSR643', vence: '2026-11-25' }
    const b = { id: 2, ...base, bien: 'DSR 643', vence: '2027-11-25' }
    const otraPlaca = { id: 3, ...base, bien: 'KTL356', vence: '2026-12-01' }
    const otroCliente = { id: 4, clienteId: 2, ramoId: 7, bien: 'KTL356', vence: '2027-12-01' }
    const r = renovadasAutomaticamente([a, b, otraPlaca], [a, b, otraPlaca, otroCliente])
    expect([...r]).toEqual([1])
  })
  it('no marca si la otra es anterior o el ramo es distinto', () => {
    const a = { id: 1, ...base, bien: 'DSR643', vence: '2026-11-25' }
    const antes = { id: 2, ...base, bien: 'DSR643', vence: '2025-11-25' }
    const otroRamo = { id: 3, clienteId: 1, ramoId: 8, bien: 'DSR643', vence: '2027-11-25' }
    expect(renovadasAutomaticamente([a], [a, antes, otroRamo]).size).toBe(0)
  })
})

describe('renovación de pólizas colectivas', () => {
  const base = { clienteId: 1, ramoId: 7 }
  it('basta con una placa en común con una póliza posterior', () => {
    const vieja = { id: 1, ...base, bien: 'ABC123, KTL356, DSR643', vence: '2026-10-01' }
    const renovada = { id: 2, ...base, bien: 'KTL356, NQS607', vence: '2027-10-01' }
    const otraGente = { id: 3, clienteId: 2, ramoId: 7, bien: 'ABC123', vence: '2027-10-01' }
    expect([...renovadasAutomaticamente([vieja], [vieja, renovada, otraGente])]).toEqual([1])
  })
  it('sin ninguna placa en común no cuenta como renovada', () => {
    const vieja = { id: 1, ...base, bien: 'ABC123, KTL356', vence: '2026-10-01' }
    const otra = { id: 2, ...base, bien: 'DSR643', vence: '2027-10-01' }
    expect(renovadasAutomaticamente([vieja], [vieja, otra]).size).toBe(0)
  })
})
