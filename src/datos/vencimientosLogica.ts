// Lógica pura del seguimiento de renovaciones: estados, semáforo por días y filtros.

export type EstadoSeguimiento = 'P' | 'C' | 'R' | 'F' | 'N'

export const ESTADOS_SEGUIMIENTO: { valor: EstadoSeguimiento; etiqueta: string }[] = [
  { valor: 'P', etiqueta: 'Por recordar' },
  { valor: 'C', etiqueta: 'Contactado' },
  { valor: 'R', etiqueta: 'Renovará' },
  { valor: 'F', etiqueta: 'Renovada' },
  { valor: 'N', etiqueta: 'No renueva' },
]

export const etiquetaEstado = (e: string | null | undefined) =>
  ESTADOS_SEGUIMIENTO.find((x) => x.valor === e)?.etiqueta ?? 'Por recordar'

/** Días antes del vencimiento desde los que la póliza aparece en la lista. */
export const DIAS_VENTANA = 45
/** Días de gracia después de vencida en que todavía aparece (para no perderla de vista). */
export const DIAS_VENCIDA = 30
/** Desde estos días o menos el semáforo pasa a rojo. */
export const DIAS_ROJO = 15

export type Semaforo = 'vencida' | 'rojo' | 'ambar' | 'verde'

export function semaforo(dias: number): Semaforo {
  if (dias < 0) return 'vencida'
  if (dias <= DIAS_ROJO) return 'rojo'
  if (dias <= 30) return 'ambar'
  return 'verde'
}

/** Estados que ya no requieren llamar al cliente. */
export const estaCerrado = (e: EstadoSeguimiento) => e === 'F' || e === 'N'

/** "5 días", "mañana", "hoy", "vencida hace 3 días". */
export function textoDias(dias: number): string {
  if (dias === 0) return 'Vence hoy'
  if (dias === 1) return 'Vence mañana'
  if (dias > 1) return `En ${dias} días`
  return dias === -1 ? 'Venció ayer' : `Venció hace ${-dias} días`
}

/** Número para marcar por WhatsApp (Colombia): solo dígitos, con 57 si es celular de 10 dígitos. */
export function telefonoWhatsapp(tel: string | null | undefined): string | null {
  const d = (tel ?? '').replace(/\D/g, '')
  if (d.length === 10 && d.startsWith('3')) return `57${d}`
  if (d.length === 12 && d.startsWith('573')) return d
  return null
}

/** Primer teléfono de un texto con varios ("3101234567 / 6076543210"). */
export function primerTelefono(tel: string | null | undefined): string | null {
  const t = (tel ?? '').split(/[/,;]|-\s+/)[0]?.trim()
  return t || null
}

export interface ResumenVencimientos {
  /** Sin atender (estado "Por recordar") que vencen en 15 días o menos, o ya vencidas. */
  urgentes: number
  vencidas: number
  rojo: number
  ambar: number
  /** Todas las que no están cerradas (renovada / no renueva). */
  porAtender: number
  renovara: number
}

export function resumir(filas: { dias: number; estado: EstadoSeguimiento }[]): ResumenVencimientos {
  const r: ResumenVencimientos = { urgentes: 0, vencidas: 0, rojo: 0, ambar: 0, porAtender: 0, renovara: 0 }
  for (const f of filas) {
    if (estaCerrado(f.estado)) continue
    r.porAtender++
    if (f.estado === 'R') r.renovara++
    const s = semaforo(f.dias)
    if (s === 'vencida') r.vencidas++
    else if (s === 'rojo') r.rojo++
    else if (s === 'ambar') r.ambar++
    if (f.estado === 'P' && f.dias <= DIAS_ROJO) r.urgentes++
  }
  return r
}

/** Texto de la tarjeta de inicio: "2 vencidas · 5 en rojo · 9 en ámbar · 14 por atender". */
export function textoResumen(r: ResumenVencimientos): string {
  if (r.porAtender === 0) return 'Nada por atender: todas las pólizas por vencer están cerradas'
  const partes = [
    r.vencidas ? `${r.vencidas} ${r.vencidas === 1 ? 'vencida' : 'vencidas'}` : '',
    r.rojo ? `${r.rojo} en rojo (15 días o menos)` : '',
    r.ambar ? `${r.ambar} en ámbar` : '',
    `${r.porAtender} por atender`,
    r.renovara ? `${r.renovara} ${r.renovara === 1 ? 'renovará' : 'renovarán'}` : '',
  ].filter(Boolean)
  return partes.join(' · ')
}

export interface RangoFechas {
  desde: string
  hasta: string
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Rango "hoy − [atras] días" a "hoy + [adelante] días" (fechas ISO). */
export function rangoDias(hoy: Date, atras: number, adelante: number): RangoFechas {
  return {
    desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - atras)),
    hasta: iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + adelante)),
  }
}

export const rangoPorDefecto = (hoy: Date) => rangoDias(hoy, DIAS_VENCIDA, DIAS_VENTANA)

/** Atajos de la pantalla. */
export const ATAJOS_RANGO: { clave: string; etiqueta: string; atras: number; adelante: number }[] = [
  { clave: 'vencidas', etiqueta: 'Ya vencidas', atras: 90, adelante: -1 },
  { clave: '7', etiqueta: '7 días', atras: 0, adelante: 7 },
  { clave: '15', etiqueta: '15 días', atras: 0, adelante: 15 },
  { clave: '30', etiqueta: '30 días', atras: 0, adelante: 30 },
  { clave: '60', etiqueta: '60 días', atras: 0, adelante: 60 },
  { clave: '90', etiqueta: '90 días', atras: 0, adelante: 90 },
]

/** Un rango es usable si ambas fechas existen y desde ≤ hasta. */
export const rangoValido = (r: RangoFechas) => !!r.desde && !!r.hasta && r.desde <= r.hasta
