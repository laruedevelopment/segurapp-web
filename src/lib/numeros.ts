// Números en formato colombiano: puntos de miles, coma decimal. Misma lógica
// que lib/utils/numeros_co.dart de la app Flutter (con pruebas en
// numeros.test.ts).

/**
 * Convierte texto numérico escrito en Colombia a número.
 *
 *   "1.234.567,89" → 1234567.89     "12,5" → 12.5      "1.500" → 1500
 *   "12.5" → 12.5 (un solo punto seguido de 1 o 2 dígitos = decimal)
 *   "(168.093,5)" → -168093.5       "-1.234" → -1234   "1,234,567.89" → 1234567.89
 *   "$ 1.500" → 1500                "" / "-" → null
 */
export function parseNumCO(texto: string | null | undefined): number | null {
  if (texto == null) return null
  let s = texto.trim()
  if (!s) return null

  let negativo = false
  if (s.startsWith('(') && s.endsWith(')')) {
    negativo = true
    s = s.slice(1, -1)
  }
  s = s.replace(/[\s$%]/g, '')
  if (s.startsWith('-')) {
    negativo = !negativo
    s = s.slice(1)
  }
  s = s.replace(/[^0-9.,]/g, '')
  if (!s) return null

  const ultimaComa = s.lastIndexOf(',')
  const ultimoPunto = s.lastIndexOf('.')
  const puntos = (s.match(/\./g) ?? []).length
  const decimalesTrasPunto = s.length - ultimoPunto - 1

  let normal: string
  if (ultimaComa >= 0 && ultimoPunto > ultimaComa) {
    normal = s.replace(/,/g, '')
  } else if (ultimaComa >= 0) {
    normal = s.replace(/\./g, '').replace(/,/g, '.')
  } else if (ultimoPunto >= 0 && puntos === 1 && decimalesTrasPunto >= 1 && decimalesTrasPunto <= 2) {
    normal = s
  } else {
    normal = s.replace(/\./g, '')
  }

  const n = Number(normal)
  if (!Number.isFinite(n) || normal === '' || normal === '.') return null
  return negativo ? -n : n
}

function miles(digitos: string): string {
  let out = ''
  for (let i = 0; i < digitos.length; i++) {
    if (i > 0 && (digitos.length - i) % 3 === 0) out += '.'
    out += digitos[i]
  }
  return out
}

/**
 * Número a texto colombiano para un campo editable: puntos de miles, coma
 * decimal y solo los decimales que hacen falta (1500 → "1.500", 12.5 → "12,5").
 */
export function formatearNumCO(n: number | null | undefined, maxDecimales = 2): string {
  if (n == null || !Number.isFinite(n)) return ''
  const negativo = n < 0
  const texto = Math.abs(n).toFixed(maxDecimales)
  const [entero, decRaw = ''] = texto.split('.')
  const dec = decRaw.replace(/0+$/, '')
  let res = miles(entero)
  if (dec) res += ',' + dec
  return negativo && (entero !== '0' || dec) ? '-' + res : res
}

/**
 * Formatea mientras se escribe (para inputs de dinero y porcentajes). Un "."
 * escrito al final se toma como coma decimal. Un valor pegado completo se
 * interpreta con parseNumCO.
 */
export function formatearMientrasEscribe(
  anterior: string,
  nuevo: string,
  { maxDecimales = 2, permitirNegativos = true } = {},
): string {
  let t = nuevo
  if (!t.trim()) return ''

  if (t.length - anterior.length > 1) {
    const v = parseNumCO(t)
    if (v == null) return anterior
    return formatearNumCO(permitirNegativos ? v : Math.abs(v), maxDecimales)
  }

  if (maxDecimales > 0 && t.endsWith('.') && !t.slice(0, -1).includes(',') && t.length > anterior.length) {
    t = t.slice(0, -1) + ','
  }

  const negativo = permitirNegativos && /^\s*[-(]/.test(t)
  const partes = t.replace(/[^0-9,]/g, '').split(',')
  const entero = partes[0].replace(/^0+(?=\d)/, '')
  let fmt = (negativo ? '-' : '') + miles(entero)
  if (partes.length > 1 && maxDecimales > 0) {
    const dec = partes.slice(1).join('')
    fmt += ',' + dec.slice(0, maxDecimales)
  }
  return fmt
}

/** Suma exacta de dinero: acumula en centavos enteros. */
export function sumarDinero(valores: Iterable<number | null | undefined>): number {
  let centavos = 0
  for (const v of valores) centavos += Math.round((v ?? 0) * 100)
  return centavos / 100
}

const fmtCache = new Map<number, Intl.NumberFormat>()
function formateador(dec: number) {
  let f = fmtCache.get(dec)
  if (!f) {
    f = new Intl.NumberFormat('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec })
    fmtCache.set(dec, f)
  }
  return f
}

/** Valor para mostrar: 1234567 → "1.234.567". Vacío si no hay valor. */
export function fmtNum(n: number | null | undefined, dec = 0): string {
  if (n == null || !Number.isFinite(n)) return ''
  return formateador(dec).format(n)
}

/** Dinero para mostrar: "$ 1.234.567". */
export function fmtDinero(n: number | null | undefined, dec = 0): string {
  if (n == null || !Number.isFinite(n)) return ''
  return '$ ' + formateador(dec).format(n)
}

/** Porcentaje para mostrar: 12.5 → "12,5%". */
export function fmtPct(n: number | null | undefined, maxDec = 2): string {
  if (n == null || !Number.isFinite(n)) return ''
  return formatearNumCO(n, maxDec) + '%'
}

/**
 * Documento de identidad con puntos: "9002278851" → "9.002.278.851",
 * "900227885-1" → "900.227.885-1". Si tiene letras se deja tal cual.
 */
export function fmtDoc(raw: string | null | undefined): string {
  const s = (raw ?? '').trim()
  if (!s) return s
  const guion = s.indexOf('-')
  const numero = guion === -1 ? s : s.slice(0, guion)
  const sufijo = guion === -1 ? '' : s.slice(guion)
  if (!/^\d+$/.test(numero)) return s
  return miles(numero) + sufijo
}
