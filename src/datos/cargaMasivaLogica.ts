// Lógica pura de la carga masiva de pólizas y de la bandeja de pendientes
// (sin Supabase, para poder probarla con vitest). Replica
// lib/datos/servicio_carga_masiva.dart y pagina_polizas_duplicadas.dart.

import { normalizarAlfanumerico } from '@/lib/filtros'

/** Extensiones que acepta la carga masiva (igual que el selector de Flutter). */
export const EXTENSIONES_CARGA = ['pdf', 'jpg', 'jpeg', 'png', 'webp'] as const

/** Tipo MIME según la extensión del nombre; null si no es un formato aceptado. */
export function mimeDeNombre(nombre: string): string | null {
  const ext = nombre.includes('.') ? nombre.split('.').pop()!.toLowerCase() : ''
  switch (ext) {
    case 'pdf':
      return 'application/pdf'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    default:
      return null
  }
}

/** Bytes que se usan del inicio y del final del archivo para la firma. */
export const BYTES_FIRMA = 4096

function fnv1a(bytes: Uint8Array): string {
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16)
}

/**
 * Firma para reconocer el mismo archivo elegido dos veces en el lote:
 * tamaño + huella de los primeros y de los últimos 4 KB (como en Flutter).
 */
export function firmaArchivo(tamano: number, inicio: Uint8Array, fin: Uint8Array): string {
  return `${tamano}:${fnv1a(inicio)}:${fnv1a(fin)}`
}

/**
 * ¿Es un error temporal del servicio de IA (límite de uso, servicio no
 * disponible, 429/502/503/504)? Esos se reintentan solos.
 */
export function esErrorTemporal(mensaje: string): boolean {
  const s = mensaje.toLowerCase()
  return (
    s.includes('límite de uso') ||
    s.includes('no está disponible') ||
    s.includes('(429)') ||
    s.includes('(502)') ||
    s.includes('(503)') ||
    s.includes('(504)')
  )
}

/** Esperas antes de cada reintento: hasta 2 reintentos, a los 5 y 15 segundos. */
export const ESPERAS_REINTENTO_MS = [5_000, 15_000]

/** Ejecuta [accion] reintentando los errores temporales de la IA. */
export async function conReintentos<T>(
  accion: () => Promise<T>,
  esperar: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  esperas: number[] = ESPERAS_REINTENTO_MS,
): Promise<T> {
  for (let intento = 0; ; intento++) {
    try {
      return await accion()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!esErrorTemporal(msg) || intento >= esperas.length) throw e
      await esperar(esperas[intento])
    }
  }
}

// ── Pólizas con número repetido ─────────────────────────────────────────────

export interface PolizaNumerada {
  id: number
  nro_poliza: string | null
  aseg_id: number | null
}

export interface GrupoDuplicadas<T> {
  /** aseg_id|número normalizado. */
  clave: string
  norm: string
  polizas: T[]
}

/**
 * Agrupa por aseguradora + número normalizado (sin espacios, guiones ni
 * separadores). El mismo número en aseguradoras distintas no es duplicado.
 * Solo quedan los grupos de 2 o más, del más grande al más chico.
 */
export function agruparDuplicadas<T extends PolizaNumerada>(polizas: T[]): GrupoDuplicadas<T>[] {
  const porClave = new Map<string, GrupoDuplicadas<T>>()
  for (const p of polizas) {
    const nro = (p.nro_poliza ?? '').trim()
    if (!nro) continue
    const norm = normalizarAlfanumerico(nro)
    if (!norm) continue
    const clave = `${p.aseg_id ?? 0}|${norm}`
    let g = porClave.get(clave)
    if (!g) {
      g = { clave, norm, polizas: [] }
      porClave.set(clave, g)
    }
    g.polizas.push(p)
  }
  return [...porClave.values()].filter((g) => g.polizas.length > 1).sort((a, b) => b.polizas.length - a.polizas.length)
}
