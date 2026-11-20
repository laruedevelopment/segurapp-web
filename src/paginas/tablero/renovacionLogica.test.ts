import { describe, expect, it } from 'vitest'
import type { PolizaLista } from '@/lib/tipos'
import { prepararFilas } from '@/paginas/reportes/calculos'
import { analizarRenovacion, vencePorMes } from './renovacionLogica'

const HOY = new Date(2026, 10, 19)
let sig = 1
const mk = (d: Partial<PolizaLista>) => prepararFilas([{ id: sig++, estado_poliza_id: 'I', cliente_id: 1, ramo_id: 7, valor_poliza: 0, prima_poliza: 0, ...d } as PolizaLista])[0]

describe('analizarRenovacion', () => {
  const a1 = mk({ bien_asegurado: 'ABC123', ffin_poliza: '2026-09-01', nombre_aseg: 'SURA', nombre_asesor: 'LUZ', valor_poliza: 100 })
  const a1r = mk({ bien_asegurado: 'ABC123', ffin_poliza: '2027-09-01', nombre_aseg: 'SURA', nombre_asesor: 'LUZ' })
  const b = mk({ bien_asegurado: 'KTL356', ffin_poliza: '2026-10-15', nombre_aseg: 'SURA', nombre_asesor: 'LUZ', valor_poliza: 900 })
  const c = mk({ bien_asegurado: 'DSR643', ffin_poliza: '2026-05-01', nombre_aseg: 'ESTADO', nombre_asesor: 'ANA', valor_poliza: 50 })
  const vieja = mk({ bien_asegurado: 'XYZ789', ffin_poliza: '2024-01-01' })
  const todas = [a1, a1r, b, c, vieja]
  it('tasa de los últimos 12 meses y lo que sigue sin renovar (90 días, mayor valor primero)', () => {
    const r = analizarRenovacion(todas, todas, HOY, { minimoGrupo: 1 })
    expect(r.vencidas).toBe(3)
    expect(r.renovadas).toBe(1)
    expect(r.tasa).toBeCloseTo(1 / 3)
    expect(r.sinRenovar.map((x) => x.p.bien_asegurado)).toEqual(['KTL356'])
    expect(r.porAseguradora.map((g) => [g.nombre, g.vencidas, g.renovadas])).toEqual([['SURA', 2, 1], ['ESTADO', 1, 0]])
  })
  it('el mínimo del grupo oculta los muy pequeños', () => {
    expect(analizarRenovacion(todas, todas, HOY).porAseguradora).toEqual([])
  })
})

describe('vencePorMes', () => {
  it('cuenta lo que vence en cada uno de los próximos meses', () => {
    const f = [
      mk({ ffin_poliza: '2026-11-25', valor_poliza: 10, prima_poliza: 8 }),
      mk({ ffin_poliza: '2026-11-10' }), // ya venció este mes: no cuenta
      mk({ ffin_poliza: '2026-12-31', valor_poliza: 5 }),
      mk({ ffin_poliza: '2027-11-30' }), // fuera de los 12 meses
    ]
    const r = vencePorMes(f, HOY)
    expect(r.etiquetas[0]).toBe('nov 26')
    expect(r.etiquetas[11]).toBe('oct 27')
    expect(r.registros.slice(0, 2)).toEqual([1, 1])
    expect(r.valor[0]).toBe(10)
    expect(r.prima[0]).toBe(8)
    expect(r.registros.reduce((a, b) => a + b, 0)).toBe(2)
  })
})
