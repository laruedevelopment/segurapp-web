import { describe, expect, test } from 'vitest'
import { advertenciaComision } from './comisionesRevisionLogica'

describe('advertenciaComision', () => {
  test('un % mayor que 100 o negativo advierte', () => {
    expect(advertenciaComision({ porcCom: 175, vlrCom: 100, prima: 1000 })).toMatch(/no puede ser menor que 0 ni mayor que 100/)
    expect(advertenciaComision({ porcCom: -5, vlrCom: 0, prima: 1000 })).not.toBeNull()
  })
  test('comisión mayor que la prima advierte', () => {
    expect(advertenciaComision({ porcCom: 50, vlrCom: 1500, prima: 1000 })).toMatch(/mayor que la prima/)
  })
  test('valores normales no advierten', () => {
    expect(advertenciaComision({ porcCom: 17.5, vlrCom: 175, prima: 1000 })).toBeNull()
    expect(advertenciaComision({ porcCom: 100, vlrCom: 1000, prima: 1000 })).toBeNull()
    expect(advertenciaComision({ porcCom: null, vlrCom: null, prima: null })).toBeNull()
    // prima negativa (anulación): no se compara
    expect(advertenciaComision({ porcCom: 21.1, vlrCom: -7563, prima: -35847 })).toBeNull()
  })
})
