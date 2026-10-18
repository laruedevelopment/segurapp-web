// Lógica pura de la bandeja de Pólizas pendientes (sin Supabase, para probarla
// con vitest). Réplica de lib/datos/poliza_pendiente.dart y de
// lib/ui/pagina_polizas_pendientes.dart.

import { normalizarAlfanumerico } from '@/lib/filtros'

/** Días que una póliza descartada se puede restaurar antes de borrarse sola. */
export const DIAS_RETENCION = 7

const MS_DIA = 24 * 60 * 60 * 1000

export interface PendienteBasico {
  id: number
  datos: Record<string, unknown>
  nombre_archivo: string | null
  usuario_id: number | null
  fcreado: string
  fdescartado: string | null
}

export type CriterioOrden = 'fecha' | 'cod' | 'nro'

/** Texto corto de la tarjeta: cliente o número de póliza, lo que haya. */
export function resumenDe(datos: Record<string, unknown>): string {
  const v = datos.nombre_cliente ?? datos.nro_poliza
  const t = v == null ? '' : String(v).trim()
  return t || 'Sin datos'
}

/** Número de póliza extraído o digitado ('' si no hay). */
export function nroPolizaDe(datos: Record<string, unknown>): string {
  const v = datos.nro_poliza
  return v == null ? '' : String(v).trim()
}

/**
 * Días que le quedan a una descartada antes de borrarse (0 a 7); null si no
 * está descartada. Igual que Dart: la diferencia se trunca a días completos.
 */
export function diasParaBorrarse(fdescartado: string | null, ahora: Date = new Date()): number | null {
  if (!fdescartado) return null
  const desc = new Date(fdescartado).getTime()
  if (Number.isNaN(desc)) return null
  const dias = Math.trunc((desc + DIAS_RETENCION * MS_DIA - ahora.getTime()) / MS_DIA)
  return Math.min(DIAS_RETENCION, Math.max(0, dias))
}

/** Fecha límite (ISO) para purgar: las descartadas antes de ella ya vencieron. */
export function limitePurga(ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - DIAS_RETENCION * MS_DIA).toISOString()
}

/** "1 día" / "3 días". */
export const plural = (n: number, singular: string, pluralTxt: string) => `${n} ${n === 1 ? singular : pluralTxt}`

/** Quién subió o creó la póliza, o null si no se sabe. */
export function quienSubio(p: Pick<PendienteBasico, 'usuario_id'>, usuarios: Map<number, string>): string | null {
  if (p.usuario_id == null) return null
  return usuarios.get(p.usuario_id) || `usuario ${p.usuario_id}`
}

/** Etiqueta del origen: las creadas a mano dicen "Creada", el resto "Subida". */
export const verboOrigen = (origen: string) => (origen === 'manual' ? 'Creada' : 'Subida')

/**
 * Filtra por texto (código, número de póliza, archivo, cliente o quien la
 * subió) y ordena. Las que no tienen número quedan siempre al final al
 * ordenar por número. `descartadas` hace que la fecha de orden sea la de
 * descarte en vez de la de guardado.
 */
export function filtrarYOrdenar<T extends PendienteBasico>(
  lista: T[],
  opciones: {
    texto: string
    orden: CriterioOrden
    ascendente: boolean
    descartadas: boolean
    usuarios: Map<number, string>
  },
): T[] {
  const { texto, orden, ascendente, descartadas, usuarios } = opciones
  const q = texto.trim()
  const qNorm = normalizarAlfanumerico(q)
  const qTexto = q.toUpperCase()
  const qCod = q.replace('#', '')
  const res = q
    ? lista.filter(
        (p) =>
          String(p.id).includes(qCod) ||
          (qNorm !== '' && normalizarAlfanumerico(nroPolizaDe(p.datos)).includes(qNorm)) ||
          (p.nombre_archivo ?? '').toUpperCase().includes(qTexto) ||
          (quienSubio(p, usuarios) ?? '').toUpperCase().includes(qTexto) ||
          resumenDe(p.datos).toUpperCase().includes(qTexto),
      )
    : [...lista]

  const fecha = (p: T) => {
    const v = descartadas ? p.fdescartado : p.fcreado
    const t = v ? new Date(v).getTime() : 0
    return Number.isNaN(t) ? 0 : t
  }
  const cmp = (a: T, b: T): number => {
    switch (orden) {
      case 'cod':
        return a.id - b.id
      case 'nro': {
        const ua = nroPolizaDe(a.datos).toUpperCase()
        const ub = nroPolizaDe(b.datos).toUpperCase()
        if ((ua === '') !== (ub === '')) return ua === '' ? 1 : -1
        return ua < ub ? -1 : ua > ub ? 1 : 0
      }
      default:
        return fecha(a) - fecha(b)
    }
  }
  return res.sort((a, b) => {
    // Las que no tienen número van al final en cualquier sentido.
    if (orden === 'nro' && (nroPolizaDe(a.datos) === '') !== (nroPolizaDe(b.datos) === '')) return cmp(a, b)
    const c = cmp(a, b)
    return ascendente ? c : -c
  })
}
