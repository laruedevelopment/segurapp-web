import { describe, expect, it } from 'vitest'
import { coberturaPorRamo, lineaDeTiempo, polizasDelCliente, resumenCliente, type PolCliente } from './cliente360Logica'

const HOY = '2026-11-25'
const p = (o: Partial<PolCliente> & { id: number }): PolCliente => ({
  nro: null, asegId: 1, ramoId: 1, nombreRamo: 'AUTOS', nombreAseg: 'SURA', fini: '2026-01-01', fin: '2027-01-01', prima: 100, valor: 1000, bien: null, obs: null, ...o,
})

describe('ficha 360° del cliente', () => {
  const pols = [
    p({ id: 1, nro: '400-40-994000012539-0', fini: '2026-03-01', fin: '2027-03-01', prima: 100, valor: 1000, bien: 'ABC123' }),
    p({ id: 2, nro: '400-40-994000012539-1', fini: '2026-03-01', fin: '2027-03-01', prima: 50, valor: 500, bien: 'KTL356' }),
    p({ id: 3, nro: 'X-77777-0', ramoId: 2, nombreRamo: 'HOGAR', asegId: 2, fini: '2024-05-01', fin: '2025-05-01', prima: 70, valor: 700 }),
  ]

  it('une los anexos de una vigencia en una sola póliza', () => {
    const c = polizasDelCliente(pols, HOY)
    expect(c).toHaveLength(2)
    expect(c[0].vigente).toBe(true)
    expect(c[0].anexos).toBe(1)
    expect(c[0].placas).toEqual(['ABC123', 'KTL356'])
    expect(c[1].vigente).toBe(false)
  })

  it('suma prima y valor de todas las filas vigentes (incluye anexos)', () => {
    const r = resumenCliente(pols, HOY)
    expect(r).toMatchObject({ vigentes: 1, vencidas: 1, primaVigente: 150, valorVigente: 1500, desde: 2024, anios: 2, aseguradoras: 1 })
  })

  it('sin fecha de fin no se da por vigente', () => {
    expect(resumenCliente([p({ id: 9, fin: null, fini: null })], HOY)).toMatchObject({ vigentes: 0, vencidas: 1, desde: null, anios: 0 })
  })

  it('cobertura: vigente, vencido y sin ramo', () => {
    const ramos = [
      { id: 1, nombre_ramo: 'AUTOS' }, { id: 2, nombre_ramo: 'HOGAR' }, { id: 3, nombre_ramo: 'VIDA' }, { id: 4, nombre_ramo: 'VIEJO', estado_ramo: false },
    ]
    const c = coberturaPorRamo(pols, ramos, HOY)
    expect(c.map((x) => [x.nombre, x.estado])).toEqual([['AUTOS', 'vigente'], ['HOGAR', 'vencido'], ['VIDA', 'sin']])
  })

  it('línea de tiempo: lo más reciente primero, con próximo vencimiento', () => {
    const l = lineaDeTiempo(pols, HOY)
    expect(l[0]).toMatchObject({ fecha: '2027-03-01', tipo: 'vence' })
    expect(l.at(-1)).toMatchObject({ fecha: '2024-05-01', tipo: 'inicio' })
    expect(l.some((e) => e.tipo === 'vencio' && e.fecha === '2025-05-01')).toBe(true)
  })
})
