import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Une clases de Tailwind resolviendo conflictos (la última gana). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Mensaje legible de cualquier error (Supabase, fetch, Error, texto). */
export function mensajeError(e: unknown): string {
  if (!e) return 'Error desconocido.'
  if (typeof e === 'string') return e
  if (typeof e === 'object') {
    const o = e as { message?: unknown; code?: unknown; details?: unknown }
    if (o.code === '23505') return 'Ya existe un registro con ese valor (duplicado).'
    if (o.code === '23503') return 'No se puede: el registro está relacionado con otros datos.'
    if (o.code === '42501') return 'No tiene permiso para hacer esto.'
    if (typeof o.message === 'string' && o.message) return o.message
  }
  return String(e)
}
