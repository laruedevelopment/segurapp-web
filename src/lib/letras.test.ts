import { describe, expect, it } from 'vitest'
import { enteroEnLetras, pesosEnLetras } from './letras'

describe('pesosEnLetras', () => {
  it.each([
    [0, 'CERO PESOS M/CTE'],
    [1, 'UN PESO M/CTE'],
    [21, 'VEINTIUN PESOS M/CTE'],
    [100, 'CIEN PESOS M/CTE'],
    [101, 'CIENTO UNO PESOS M/CTE'.replace('UNO', 'UN')],
    [1000, 'MIL PESOS M/CTE'],
    [21000, 'VEINTIUN MIL PESOS M/CTE'],
    [1_000_000, 'UN MILLÓN DE PESOS M/CTE'],
    [2_000_000, 'DOS MILLONES DE PESOS M/CTE'],
    [1_234_567, 'UN MILLÓN DOSCIENTOS TREINTA Y CUATRO MIL QUINIENTOS SESENTA Y SIETE PESOS M/CTE'],
    [93_750, 'NOVENTA Y TRES MIL SETECIENTOS CINCUENTA PESOS M/CTE'],
    [1500.5, 'MIL QUINIENTOS PESOS CON 50/100 M/CTE'],
  ])('%s', (n, esperado) => expect(pesosEnLetras(n)).toBe(esperado))
  it('negativo', () => expect(pesosEnLetras(-500)).toBe('MENOS QUINIENTOS PESOS M/CTE'))
  it('enteroEnLetras', () => expect(enteroEnLetras(31)).toBe('TREINTA Y UNO'))
})
