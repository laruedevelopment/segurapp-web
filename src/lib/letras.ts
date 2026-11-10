// Valor en letras en español de Colombia: 1234567 → "UN MILLÓN DOSCIENTOS TREINTA Y CUATRO MIL
// QUINIENTOS SESENTA Y SIETE PESOS M/CTE". Se usa en las cuentas de cobro.

const UNIDADES = [
  'CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE',
  'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS',
  'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
]
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const CENTENAS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS',
  'NOVECIENTOS',
]

/** 0–999 (sin el cero). */
function centenas(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'CIEN'
  const c = Math.floor(n / 100)
  const r = n % 100
  const partes: string[] = []
  if (c) partes.push(CENTENAS[c])
  if (r) {
    if (r < 30) partes.push(UNIDADES[r])
    else {
      const d = Math.floor(r / 10)
      const u = r % 10
      partes.push(u ? `${DECENAS[d]} Y ${UNIDADES[u]}` : DECENAS[d])
    }
  }
  return partes.join(' ')
}

/** Entero ≥ 0 hasta 999.999.999.999 en letras ("UN" antes de un sustantivo, "UNO" suelto). */
export function enteroEnLetras(n: number): string {
  n = Math.floor(Math.abs(n))
  if (n === 0) return 'CERO'
  const miles_millon = Math.floor(n / 1_000_000)
  const resto = n % 1_000_000
  const miles = Math.floor(resto / 1000)
  const unidades = resto % 1000
  const partes: string[] = []
  if (miles_millon) {
    partes.push(miles_millon === 1 ? 'UN MILLÓN' : `${enteroEnLetras(miles_millon).replace(/UNO$/, 'UN')} MILLONES`)
  }
  if (miles) partes.push(miles === 1 ? 'MIL' : `${centenas(miles).replace(/UNO$/, 'UN')} MIL`)
  if (unidades) partes.push(centenas(unidades))
  // "un millón de pesos" cuando no hay nada después de los millones
  return partes.join(' ')
}

/** "UN MILLÓN DE PESOS M/CTE", "MIL PESOS M/CTE", "UN PESO M/CTE"; los centavos van como "CON 50/100". */
export function pesosEnLetras(valor: number): string {
  const v = Math.round(Math.abs(valor) * 100) / 100
  const pesos = Math.floor(v)
  const centavos = Math.round((v - pesos) * 100)
  const negativo = valor < 0 && v > 0 ? 'MENOS ' : ''
  let base: string
  if (pesos === 1) base = 'UN PESO'
  else if (pesos > 0 && pesos % 1_000_000 === 0) base = `${enteroEnLetras(pesos).replace(/UNO$/, 'UN')} DE PESOS`
  else base = `${enteroEnLetras(pesos).replace(/UNO$/, 'UN')} PESOS`
  const cent = centavos ? ` CON ${String(centavos).padStart(2, '0')}/100` : ''
  return `${negativo}${base}${cent} M/CTE`
}
