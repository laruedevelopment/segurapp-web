// Formato de cifras del dashboard (igual que dashboard_widgets.dart de Flutter):
// "$ 1,2 M", "3,4 mil M", "850 mil", "12,5%". Se arma a mano (sin Intl) para
// que los puntos de miles y la coma decimal no dependan del navegador.

const miles = (digitos: string) => digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/** Redondeo "hacia afuera del cero" (como Dart), no hacia +infinito. */
const redondear = (n: number) => Math.sign(n) * Math.round(Math.abs(n))

function numCO(n: number, dec: number): string {
  const neg = n < 0
  const [ent, d] = Math.abs(n).toFixed(dec).split('.')
  const txt = miles(ent) + (d ? ',' + d : '')
  return neg && Number(Math.abs(n).toFixed(dec)) !== 0 ? '-' + txt : txt
}

/** 1234567 → "1.234.567" */
export const fmtEntero = (n: number): string => numCO(redondear(n), 0)

/** Monto completo: "$ 1.234.567" */
export const fmtMonto = (n: number): string => `$ ${fmtEntero(n)}`

/** Monto compacto para tarjetas y ejes: 1,2 M · 3,4 mil M · 850 mil. */
export function fmtCompacto(n: number, signo = false): string {
  const a = Math.abs(n)
  const s = n < 0 ? '-' : signo && n > 0 ? '+' : ''
  if (a >= 1e9) return `${s}${numCO(a / 1e9, 1)} mil M`
  if (a >= 1e6) return `${s}${numCO(a / 1e6, 1)} M`
  if (a >= 1e3) return `${s}${numCO(Math.round(a / 1e3), 0)} mil`
  return `${s}${numCO(Math.round(a), 0)}`
}

/** Compacto con el signo de pesos: "$ 1,2 M". */
export const fmtPesosCompacto = (n: number): string => `$ ${fmtCompacto(n)}`

/** 12.5 → "12,5%" (1 decimal por defecto). */
export const fmtPct = (n: number, dec = 1): string => `${numCO(n, dec)}%`

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "sep" o, con año, "sep 26". */
export const mesCorto = (d: Date, anio = false): string =>
  `${MESES_CORTOS[d.getMonth()]}${anio ? ' ' + String(d.getFullYear() % 100).padStart(2, '0') : ''}`

/** Etiquetas de un eje de meses: con año si hay más de 12. */
export const etiquetasMeses = (m: Date[]): string[] => m.map((d) => mesCorto(d, m.length > 12))

export const MESES_12 = Array.from({ length: 12 }, (_, i) => MESES_CORTOS[i])
