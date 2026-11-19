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
  const t = (tel ?? '').split(/[\/,;-]\s+|[\/,;]/)[0]?.trim()
  return t || null
}
