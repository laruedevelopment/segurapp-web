// Lógica pura de "Casos por revisar" (sin base de datos, para poder probarla).
// Réplica de lib/datos/repositorio_casos.dart de la app Flutter.

export interface CasoRevision {
  id: number
  tipo: string
  titulo: string
  descripcion: string
  pregunta: string | null
  polizas: number[]
  reporte_id: number | null
  abono_id: number | null
  /** P = pendiente, R = resuelto. */
  estado: string
  respuesta: string | null
  /** Apodo de quien lo resolvió (null si lo cerró la revalidación automática). */
  resuelto_por: string | null
  fresuelto: Date | null
  fcreado: Date | null
}

export const TIPO_PAGO_SIN_POLIZA = 'PAGO_SIN_POLIZA'
export const TIPO_POSIBLE_DUPLICADO = 'POSIBLE_DUPLICADO'
export const TIPO_COMISION_RARA = 'COMISION_RARA'

export function nombreTipoCaso(tipo: string): string {
  switch (tipo) {
    case TIPO_PAGO_SIN_POLIZA:
      return 'Pago sin póliza'
    case TIPO_POSIBLE_DUPLICADO:
      return 'Posible duplicado'
    case TIPO_COMISION_RARA:
      return 'Comisión que no cuadra'
    default:
      return 'Otro'
  }
}

export const estaResuelto = (c: Pick<CasoRevision, 'estado'>) => c.estado === 'R'

/** Lo cerró la revalidación automática (no hay usuario que lo resolviera). */
export const resueltoAutomatico = (c: Pick<CasoRevision, 'estado' | 'resuelto_por'>) =>
  estaResuelto(c) && c.resuelto_por == null

/** "Resuelto por ana el 01/10/2026 10:30" o "Resuelto automáticamente el …". */
export function textoResuelto(c: Pick<CasoRevision, 'estado' | 'resuelto_por'>, fecha: string | null): string {
  const quien = resueltoAutomatico(c) ? 'Resuelto automáticamente' : `Resuelto por ${c.resuelto_por ?? '—'}`
  return fecha ? `${quien} el ${fecha}` : quien
}

/** Aviso tras revalidar al cargar la bandeja; null si no se cerró ninguno. */
export function mensajeCerrados(n: number): string | null {
  if (n <= 0) return null
  return n === 1
    ? 'Un caso ya estaba corregido y se marcó como resuelto.'
    : `${n} casos ya estaban corregidos y se marcaron como resueltos.`
}

const aFechaOpcional = (v: unknown): Date | null => {
  if (v == null || v === '') return null
  const d = new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d
}

const aEnteroOpcional = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

/** Fila de casos_revision (con el apodo de quien resolvió embebido) → CasoRevision. */
export function casoDesdeFila(fila: Record<string, unknown>): CasoRevision {
  const resuelve = fila.resuelve
  const apodo =
    resuelve && typeof resuelve === 'object' && !Array.isArray(resuelve)
      ? (resuelve as { apodo_usuario?: unknown }).apodo_usuario
      : null
  const polizas = Array.isArray(fila.polizas)
    ? fila.polizas.map((p) => aEnteroOpcional(p)).filter((p): p is number => p != null)
    : []
  const texto = (v: unknown) => (typeof v === 'string' ? v : null)
  return {
    id: Number(fila.id),
    tipo: texto(fila.tipo) ?? 'OTRO',
    titulo: texto(fila.titulo) ?? '',
    descripcion: texto(fila.descripcion) ?? '',
    pregunta: texto(fila.pregunta),
    polizas,
    reporte_id: aEnteroOpcional(fila.reporte_id),
    abono_id: aEnteroOpcional(fila.abono_id),
    estado: texto(fila.estado) ?? 'P',
    respuesta: texto(fila.respuesta),
    resuelto_por: typeof apodo === 'string' ? apodo : null,
    fresuelto: aFechaOpcional(fila.fresuelto),
    fcreado: aFechaOpcional(fila.fcreado),
  }
}

export interface AccionesCaso {
  /** Botón "Anular cód. N" por cada póliza del caso. */
  anular: boolean
  /** Botón "Corregir abono". */
  corregirAbono: boolean
  /** Botón "Reporte #N". */
  verReporte: boolean
  /** Botones "Pagos cód. N" (el Digitador no ve pagos). */
  verPagos: boolean
}

/** Qué botones muestra un caso según su tipo, estado y el rol (A/S ven comisiones). */
export function accionesDeCaso(c: CasoRevision, veComisiones: boolean): AccionesCaso {
  const pendiente = !estaResuelto(c)
  return {
    anular: pendiente && c.tipo === TIPO_POSIBLE_DUPLICADO,
    corregirAbono: pendiente && c.abono_id != null && veComisiones && c.tipo !== TIPO_POSIBLE_DUPLICADO,
    verReporte: c.reporte_id != null && veComisiones,
    verPagos: veComisiones,
  }
}
