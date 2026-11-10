// Lógica pura del panel "Consumo de IA": períodos, agrupación y totales.
// Sin red ni base de datos, para poder probarla.

export interface FilaConsumo {
  dia: string // YYYY-MM-DD (hora de Colombia)
  funcion: string
  tipoArchivo: string
  modelo: string
  usuarioId: number | null
  usuario: string
  llamadas: number
  lecturas: number
  exitosas: number
  reintentos: number
  tokensEntrada: number
  tokensCache: number
  tokensPensamiento: number
  tokensSalida: number
  costoUsd: number
}

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function filaDesdeRpc(raw: unknown): FilaConsumo {
  const m = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    dia: String(m.dia ?? '').slice(0, 10),
    funcion: String(m.funcion ?? ''),
    tipoArchivo: String(m.tipo_archivo ?? 'otro'),
    modelo: String(m.modelo ?? ''),
    usuarioId: m.usuario_id == null ? null : num(m.usuario_id),
    usuario: String(m.usuario ?? '—'),
    llamadas: num(m.llamadas),
    lecturas: num(m.lecturas),
    exitosas: num(m.exitosas),
    reintentos: num(m.reintentos),
    tokensEntrada: num(m.tokens_entrada),
    tokensCache: num(m.tokens_cache),
    tokensPensamiento: num(m.tokens_pensamiento),
    tokensSalida: num(m.tokens_salida),
    costoUsd: num(m.costo_usd),
  }
}

export const NOMBRE_FUNCION: Record<string, string> = {
  'extraer-poliza': 'Pólizas',
  'extraer-reporte-pago': 'Reportes de comisiones',
}
export const nombreFuncion = (f: string) => NOMBRE_FUNCION[f] ?? f

export const NOMBRE_TIPO: Record<string, string> = { pdf: 'PDF', xlsx: 'Excel', imagen: 'Imagen', otro: 'Otro' }
export const nombreTipo = (t: string) => NOMBRE_TIPO[t] ?? t

// ── Fechas (siempre como texto YYYY-MM-DD, sin husos horarios) ─────────────

const dos = (n: number) => String(n).padStart(2, '0')
export const aTexto = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
/** Mediodía local: evita corrimientos de día por el cambio de hora. */
export const deTexto = (t: string) => new Date(`${t}T12:00:00`)
const sumarDias = (t: string, n: number) => {
  const d = deTexto(t)
  d.setDate(d.getDate() + n)
  return aTexto(d)
}

export type Periodo = 'hoy' | 'ayer' | '7d' | '30d' | 'mes' | 'mes_pasado' | 'anio' | 'personalizado'

export const NOMBRE_PERIODO: Record<Periodo, string> = {
  hoy: 'Hoy',
  ayer: 'Ayer',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  mes: 'Este mes',
  mes_pasado: 'Mes pasado',
  anio: 'Este año',
  personalizado: 'Personalizado',
}

export interface Rango {
  desde: string
  hasta: string
}

export function rangoDePeriodo(p: Exclude<Periodo, 'personalizado'>, hoy = new Date()): Rango {
  const h = aTexto(hoy)
  switch (p) {
    case 'hoy':
      return { desde: h, hasta: h }
    case 'ayer':
      return { desde: sumarDias(h, -1), hasta: sumarDias(h, -1) }
    case '7d':
      return { desde: sumarDias(h, -6), hasta: h }
    case '30d':
      return { desde: sumarDias(h, -29), hasta: h }
    case 'mes':
      return { desde: aTexto(new Date(hoy.getFullYear(), hoy.getMonth(), 1, 12)), hasta: h }
    case 'mes_pasado':
      return {
        desde: aTexto(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1, 12)),
        hasta: aTexto(new Date(hoy.getFullYear(), hoy.getMonth(), 0, 12)),
      }
    case 'anio':
      return { desde: `${hoy.getFullYear()}-01-01`, hasta: h }
  }
}

/** Un rango válido: fechas bien escritas, desde ≤ hasta y máximo 731 días. */
export function rangoValido(r: Rango): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.desde) || !/^\d{4}-\d{2}-\d{2}$/.test(r.hasta)) return 'Elija las dos fechas.'
  if (r.desde > r.hasta) return 'La fecha inicial no puede ser posterior a la final.'
  const dias = (deTexto(r.hasta).getTime() - deTexto(r.desde).getTime()) / 86400000
  if (dias > 731) return 'El período no puede pasar de dos años.'
  return null
}

// ── Agrupación ──────────────────────────────────────────────────────────────

export interface Totales {
  llamadas: number
  lecturas: number
  exitosas: number
  reintentos: number
  tokensEntrada: number
  tokensCache: number
  tokensPensamiento: number
  tokensSalida: number
  costoUsd: number
}

const vacio = (): Totales => ({
  llamadas: 0,
  lecturas: 0,
  exitosas: 0,
  reintentos: 0,
  tokensEntrada: 0,
  tokensCache: 0,
  tokensPensamiento: 0,
  tokensSalida: 0,
  costoUsd: 0,
})

function sumar(t: Totales, f: FilaConsumo) {
  t.llamadas += f.llamadas
  t.lecturas += f.lecturas
  t.exitosas += f.exitosas
  t.reintentos += f.reintentos
  t.tokensEntrada += f.tokensEntrada
  t.tokensCache += f.tokensCache
  t.tokensPensamiento += f.tokensPensamiento
  t.tokensSalida += f.tokensSalida
  t.costoUsd += f.costoUsd
}

export function totales(filas: FilaConsumo[]): Totales {
  const t = vacio()
  for (const f of filas) sumar(t, f)
  return t
}

/** Totales por una clave cualquiera (función, tipo de archivo, usuario…), de mayor a menor costo. */
export function agruparPor(filas: FilaConsumo[], clave: (f: FilaConsumo) => string) {
  const mapa = new Map<string, Totales>()
  for (const f of filas) {
    const k = clave(f)
    const t = mapa.get(k) ?? vacio()
    sumar(t, f)
    mapa.set(k, t)
  }
  return [...mapa.entries()]
    .map(([nombre, t]) => ({ nombre, ...t }))
    .sort((a, b) => b.costoUsd - a.costoUsd || b.lecturas - a.lecturas)
}

export interface Cubeta {
  clave: string // YYYY-MM-DD o YYYY-MM
  etiqueta: string
  porFuncion: Record<string, Totales>
  total: Totales
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Cubetas por día o por mes, incluyendo los períodos sin consumo (en cero). */
export function cubetas(filas: FilaConsumo[], rango: Rango, por: 'dia' | 'mes'): Cubeta[] {
  const claveDe = (dia: string) => (por === 'dia' ? dia : dia.slice(0, 7))
  const etiquetaDe = (clave: string) => {
    if (por === 'mes') return `${MESES[Number(clave.slice(5, 7)) - 1]} ${clave.slice(2, 4)}`
    return `${clave.slice(8, 10)}/${clave.slice(5, 7)}`
  }
  const mapa = new Map<string, Cubeta>()
  const asegurar = (clave: string) => {
    let c = mapa.get(clave)
    if (!c) {
      c = { clave, etiqueta: etiquetaDe(clave), porFuncion: {}, total: vacio() }
      mapa.set(clave, c)
    }
    return c
  }
  // Se rellenan los huecos (máximo 731 días, el tope de rangoValido).
  let d = rango.desde
  for (let i = 0; i < 732 && d <= rango.hasta; i++) {
    asegurar(claveDe(d))
    d = sumarDias(d, 1)
  }
  for (const f of filas) {
    const c = asegurar(claveDe(f.dia))
    sumar(c.total, f)
    sumar((c.porFuncion[f.funcion] ??= vacio()), f)
  }
  return [...mapa.values()].sort((a, b) => a.clave.localeCompare(b.clave))
}

/** Costo estimado del mes completo si el período es "este mes" (null si no aplica). */
export function proyeccionMes(costoUsd: number, rango: Rango, hoy = new Date()): number | null {
  const inicioMes = aTexto(new Date(hoy.getFullYear(), hoy.getMonth(), 1, 12))
  if (rango.desde !== inicioMes || rango.hasta !== aTexto(hoy)) return null
  const transcurridos = hoy.getDate()
  const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
  if (transcurridos >= diasMes || costoUsd <= 0) return null
  return (costoUsd / transcurridos) * diasMes
}

// ── Formato ─────────────────────────────────────────────────────────────────

export function fmtUsd(n: number): string {
  const dec = Math.abs(n) > 0 && Math.abs(n) < 0.01 ? 4 : 2
  return `US$ ${n.toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`
}

export const fmtCop = (usd: number, trm: number) => `$ ${Math.round(usd * trm).toLocaleString('es-CO')}`

export function fmtTokens(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 2 })} M`
  if (n >= 1e3) return `${(n / 1e3).toLocaleString('es-CO', { maximumFractionDigits: 1 })} mil`
  return n.toLocaleString('es-CO')
}

export function fmtBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toLocaleString('es-CO', { maximumFractionDigits: 2 })} GB`
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toLocaleString('es-CO', { maximumFractionDigits: 1 })} MB`
  return `${Math.round(n / 1024).toLocaleString('es-CO')} KB`
}

/** Límites del plan gratuito de Supabase (referencia para las barras de uso). */
export const LIMITE_BASE_BYTES = 500 * 1024 ** 2
export const LIMITE_ARCHIVOS_BYTES = 1024 ** 3
