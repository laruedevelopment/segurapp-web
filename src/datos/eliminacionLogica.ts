// Lógica pura de "Eliminar pólizas con autorización del administrador"
// (sin red ni React, para poder probarla). Igual que la app de Flutter.

/** Máximo de pólizas por vez (la base también lo exige). */
export const MAX_SELECCION = 200
/** Caracteres mínimos del motivo, sin contar espacios, saltos ni tabs (igual que la base). */
export const MIN_MOTIVO = 5
export const MAX_MOTIVO = 300
export const PALABRA_CONFIRMAR = 'ELIMINAR'

/** "1 póliza" / "3 pólizas": plural real en vez de "póliza(s)". */
export const plural = (n: number, singular: string, pl: string) => `${n} ${n === 1 ? singular : pl}`
/** Solo la palabra, sin el número. */
export const palabraPlural = (n: number, singular: string, pl: string) => (n === 1 ? singular : pl)

/** Motivo con al menos 5 caracteres que no sean espacios. */
export const motivoValido = (motivo: string) => motivo.replace(/[\s ]/g, '').length >= MIN_MOTIVO

/** ¿Escribió ELIMINAR? (sin importar mayúsculas ni espacios de los lados). */
export const confirmacionValida = (texto: string) => texto.trim().toUpperCase() === PALABRA_CONFIRMAR

// ── Selección en la lista ────────────────────────────────────────────────

/** Marca o desmarca [id]. Si ya hay [MAX_SELECCION], no agrega y avisa con `excedido`. */
export function alternarSeleccion(sel: ReadonlySet<number>, id: number): { sel: Set<number>; excedido: boolean } {
  const nuevo = new Set(sel)
  if (nuevo.delete(id)) return { sel: nuevo, excedido: false }
  if (nuevo.size >= MAX_SELECCION) return { sel: nuevo, excedido: true }
  nuevo.add(id)
  return { sel: nuevo, excedido: false }
}

/** Selecciona (hasta [MAX_SELECCION]) las pólizas que hoy se ven con los filtros. */
export function seleccionarVisibles(visibles: readonly { id: number }[]): { sel: Set<number>; recortado: boolean } {
  return {
    sel: new Set(visibles.slice(0, MAX_SELECCION).map((p) => p.id)),
    recortado: visibles.length > MAX_SELECCION,
  }
}

/**
 * Las seleccionadas que se ven con la búsqueda y los filtros de ahora: el
 * diálogo y el contador solo usan estas, nunca pólizas que quedaron ocultas.
 */
export function elegidasVisibles<T extends { id: number }>(visibles: readonly T[], sel: ReadonlySet<number>): T[] {
  return visibles.filter((p) => sel.has(p.id))
}

/** Quita [fuera] de lo que haya en caché (lista completa, recientes, búsquedas…). */
export function sinIdsEnCache(viejo: unknown, fuera: ReadonlySet<number>): unknown {
  if (Array.isArray(viejo)) return viejo.filter((p) => !fuera.has((p as { id: number }).id))
  if (viejo && typeof viejo === 'object' && Array.isArray((viejo as { polizas?: unknown }).polizas)) {
    const v = viejo as { polizas: { id: number }[] }
    return { ...v, polizas: v.polizas.filter((p) => !fuera.has(p.id)) }
  }
  return viejo
}

// ── Resultados de las funciones de la base ───────────────────────────────

export interface Omitida {
  id: number
  razon: string
}

export interface ResultadoEliminacion {
  /** Pólizas marcadas (solicitar) o solicitudes resueltas (resolver). */
  hechas: number
  omitidas: Omitida[]
}

const aEntero = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.trunc(n) : null
}
const aNumero = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}
const txt = (v: unknown): string | null => (v == null ? null : String(v))
const reg = (v: unknown) => (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>

/** Interpreta `{solicitadas|resueltas: n, omitidas: [{id, razon}]}` sin romperse con datos raros. */
export function parsearResultado(raw: unknown): ResultadoEliminacion {
  const m = reg(raw)
  const omitidas: Omitida[] = []
  if (Array.isArray(m.omitidas)) {
    for (const e of m.omitidas) {
      const o = reg(e)
      const id = aEntero(o.id)
      if (id != null) omitidas.push({ id, razon: o.razon == null ? '' : String(o.razon) })
    }
  }
  return { hechas: aEntero(m.solicitadas) ?? aEntero(m.resueltas) ?? 0, omitidas }
}

/** Ids de póliza que sí quedaron marcadas (los enviados menos los omitidos). */
export function idsMarcadas(enviados: readonly number[], r: ResultadoEliminacion): number[] {
  const fuera = new Set(r.omitidas.map((o) => o.id))
  return enviados.filter((id) => !fuera.has(id))
}

export interface SolicitudEliminacion {
  id: number
  polizaId: number
  lote: string
  motivo: string
  solicitadoEn: string | null
  solicitadoPor: string
  nroPoliza: string | null
  cliente: string | null
  aseguradora: string | null
  ramo: string | null
  prima: number | null
  fini: string | null
  ffin: string | null
  nPagos: number
}

export interface HistorialEliminacion {
  id: number
  polizaId: number
  estado: string
  motivo: string
  nota: string | null
  solicitadoEn: string | null
  solicitadoPor: string
  resueltoEn: string | null
  resueltoPor: string
  nroPoliza: string | null
  prima: number | null
}

export function parsearSolicitud(raw: unknown): SolicitudEliminacion {
  const m = reg(raw)
  return {
    id: aEntero(m.id) ?? 0,
    polizaId: aEntero(m.poliza_id) ?? 0,
    lote: txt(m.lote) ?? '',
    motivo: txt(m.motivo) ?? '',
    solicitadoEn: txt(m.solicitado_en),
    solicitadoPor: txt(m.solicitado_por) ?? '—',
    nroPoliza: txt(m.nro_poliza),
    cliente: txt(m.cliente),
    aseguradora: txt(m.aseguradora),
    ramo: txt(m.ramo),
    prima: aNumero(m.prima),
    fini: txt(m.fini),
    ffin: txt(m.ffin),
    nPagos: aEntero(m.n_pagos) ?? 0,
  }
}

export function parsearHistorial(raw: unknown): HistorialEliminacion {
  const m = reg(raw)
  return {
    id: aEntero(m.id) ?? 0,
    polizaId: aEntero(m.poliza_id) ?? 0,
    estado: txt(m.estado) ?? '',
    motivo: txt(m.motivo) ?? '',
    nota: txt(m.nota),
    solicitadoEn: txt(m.solicitado_en),
    solicitadoPor: txt(m.solicitado_por) ?? '—',
    resueltoEn: txt(m.resuelto_en),
    resueltoPor: txt(m.resuelto_por) ?? '—',
    nroPoliza: txt(m.nro_poliza),
    prima: aNumero(m.prima),
  }
}

/** Agrupa por lote (las marcadas juntas) conservando el orden de llegada. */
export function agruparPorLote(items: readonly SolicitudEliminacion[]): SolicitudEliminacion[][] {
  const lotes = new Map<string, SolicitudEliminacion[]>()
  for (const s of items) {
    const l = lotes.get(s.lote)
    if (l) l.push(s)
    else lotes.set(s.lote, [s])
  }
  return [...lotes.values()]
}

// ── Textos ────────────────────────────────────────────────────────────────

/** Mensaje de éxito al marcar (sin omitidas). */
export function mensajeMarcadas(hechas: number, unica?: { id: number; nro_poliza: string | null }): string {
  if (hechas === 1 && unica) {
    return (
      `Quedó marcada la póliza ${unica.nro_poliza ?? 'sin número'} (cód. ${unica.id}). ` +
      'Desaparece de las listas hasta que un administrador la autorice o la rechace.'
    )
  }
  return `Quedaron marcadas ${hechas} pólizas. Desaparecen de las listas hasta que un administrador las autorice o las rechace.`
}

/** Título del resumen cuando solicitar dejó algunas fuera. */
export function tituloOmitidasSolicitar(hechas: number, omitidas: number): string {
  return hechas > 0
    ? `Se enviaron ${hechas}; ${omitidas} no se pudieron enviar`
    : `No se pudo enviar ${omitidas === 1 ? 'la póliza' : 'ninguna'}`
}

export function tituloOmitidasResolver(aprobar: boolean, hechas: number, omitidas: number): string {
  return aprobar
    ? `Se eliminaron ${hechas}. No se pudieron eliminar ${omitidas}`
    : `Se restauraron ${hechas}. No se pudieron restaurar ${omitidas}`
}

export function mensajeResueltas(aprobar: boolean, hechas: number): string {
  if (aprobar) return `Listo: ${plural(hechas, 'póliza eliminada', 'pólizas eliminadas')} para siempre.`
  return `Listo: ${plural(hechas, 'póliza', 'pólizas')} ${palabraPlural(hechas, 'volvió a las listas', 'volvieron a las listas')}.`
}
