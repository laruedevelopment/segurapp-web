// Fechas de negocio sin hora (expedición, inicio y fin de vigencia, fecha de
// reporte). La base las guarda como timestamptz a medianoche UTC: si se
// convirtieran a la hora de Colombia (UTC−5) caerían en el día anterior. Se
// conserva el día calendario tal como está guardado.

/** "2026-09-25T00:00:00+00:00" → Date local del 25/09/2026 a medianoche. */
export function aFecha(v: string | null | undefined): Date | null {
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** Fecha+hora real (fcreado, fultmod): se muestra en la hora local. */
export function aFechaHora(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

const dos = (n: number) => String(n).padStart(2, '0')

/** Date → "2026-09-25" para guardar en la base (día calendario, sin zona). */
export function aISO(d: Date | null | undefined): string | null {
  if (!d) return null
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
}

/** Date → "25/09/2026". */
export function fmtFecha(d: Date | null | undefined): string {
  if (!d) return ''
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** Date → "25/09/2026 14:05". */
export function fmtFechaHora(d: Date | null | undefined): string {
  if (!d) return ''
  return `${fmtFecha(d)} ${dos(d.getHours())}:${dos(d.getMinutes())}`
}

/** "25/09/2026", "25-9-26", "25092026" → Date. Null si no es una fecha válida. */
export function parseFecha(texto: string): Date | null {
  const t = texto.trim()
  if (!t) return null
  let d: number, m: number, y: number
  const sep = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2,4})$/.exec(t)
  const pegado = /^(\d{2})(\d{2})(\d{4})$/.exec(t)
  if (sep) {
    d = Number(sep[1])
    m = Number(sep[2])
    y = Number(sep[3])
  } else if (pegado) {
    d = Number(pegado[1])
    m = Number(pegado[2])
    y = Number(pegado[3])
  } else {
    return null
  }
  if (y < 100) y += 2000
  const f = new Date(y, m - 1, d)
  if (f.getFullYear() !== y || f.getMonth() !== m - 1 || f.getDate() !== d) return null
  return f
}

/** Hoy a medianoche local. */
export function hoy(): Date {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

/** Suma años conservando el día (29/02 → 28/02 si el año no es bisiesto). */
export function sumarAnios(d: Date, anios: number): Date {
  const r = new Date(d.getFullYear() + anios, d.getMonth(), d.getDate())
  if (r.getMonth() !== d.getMonth()) return new Date(d.getFullYear() + anios, d.getMonth() + 1, 0)
  return r
}

/** Días entre dos fechas calendario (b − a). */
export function diasEntre(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((ub - ua) / 86_400_000)
}

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
