import type { QueryClient } from '@tanstack/react-query'
import { CLAVE_ABONOS } from '@/datos/dashboard'
import { COLS_LISTA } from '@/datos/polizas'
import { refrescarPolizas } from '@/datos/usePolizas'
import { ilikeContiene } from '@/lib/filtros'
import { formatearNumCO, parseNumCO } from '@/lib/numeros'
import { db } from '@/lib/supabase'
import type { PolizaLista } from '@/lib/tipos'

// Utilidades compartidas por las pantallas de reportes de comisiones.

/** Prefijo de todas las consultas de reportes (lista, reporte, abonos). */
export const CLAVE_REPORTES = ['reportes'] as const

/**
 * Después de crear, editar o borrar abonos: la base recalculó lo pagado de
 * esas pólizas y los totales del reporte.
 */
export async function trasCambiarAbonos(qc: QueryClient, idsPolizas: number[]) {
  await Promise.all([
    refrescarPolizas(qc, [...new Set(idsPolizas)]),
    qc.invalidateQueries({ queryKey: CLAVE_REPORTES }),
    qc.invalidateQueries({ queryKey: ['estado-cuenta'] }),
    // Recaudo y comisión del dashboard salen de los abonos (caché de 15 min).
    qc.invalidateQueries({ queryKey: CLAVE_ABONOS }),
    // Las listas cortas (recientes, búsquedas, pólizas del cliente) muestran
    // la prima pagada y el estado que la base acaba de recalcular.
    qc.invalidateQueries({ queryKey: ['polizas'], predicate: (q) => q.queryKey[1] !== 'todas' }),
  ])
}

/** Valor con los 2 decimales que muestra el campo (igual que formatear y volver a leer el texto en Flutter). */
export const a2Decimales = (n: number) => parseNumCO(formatearNumCO(n)) ?? 0

/** Redondeo a centavos como `(x * 100).round() / 100` de Dart (la mitad se aleja del cero). */
export const redondearCentavos = (x: number) => (Math.sign(x) * Math.round(Math.abs(x) * 100)) / 100

/** Número que devolvió la IA (solo si realmente es un número). */
export const numIA = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Texto que devolvió la IA, sin espacios a los lados. */
export const textoIA = (v: unknown): string =>
  typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : ''

/** "2026-09-25" (o con hora) → Date local de ese día. */
export function fechaIA(v: unknown): Date | null {
  if (typeof v !== 'string' || !v.trim()) return null
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v.trim())
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.getMonth() === Number(m[2]) - 1 ? d : null
}

/**
 * Normalización del texto de cabecera, idéntica a la de Flutter: el
 * aprendizaje del intermediario ya guardado en la base usa esta forma como
 * llave, así que no se puede cambiar.
 */
export function normalizarTextoCabecera(s: string): string {
  let r = s.trim().toUpperCase()
  const acentos: Record<string, string> = { Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', Ñ: 'N' }
  for (const [k, v] of Object.entries(acentos)) r = r.split(k).join(v)
  return r
}

/** Primero nombre igual; si no, uno que contenga al otro. */
export function coincidirPorNombre<T>(lista: T[], nombre: (t: T) => string, candidato: string | null | undefined): T | null {
  if (!candidato || !candidato.trim()) return null
  const norm = normalizarTextoCabecera(candidato)
  for (const item of lista) if (normalizarTextoCabecera(nombre(item)) === norm) return item
  for (const item of lista) {
    const n = normalizarTextoCabecera(nombre(item))
    if (n && (n.includes(norm) || norm.includes(n))) return item
  }
  return null
}

/**
 * Búsqueda de pólizas para escoger una a mano (máximo [limite]). Mismo
 * filtro que la búsqueda de la lista de pólizas.
 */
export async function buscarPolizasParaAbono(texto: string, limite = 60): Promise<PolizaLista[]> {
  const b = texto.trim()
  let q = db.from('vw_polizas_busqueda').select(COLS_LISTA)
  if (b) {
    const id = /^\d+$/.test(b) ? Number(b) : null
    const bDoc = b.replace(/\./g, '')
    q = q.or(
      [
        id != null ? `id.eq.${id}` : null,
        ilikeContiene('nro_poliza', b),
        ilikeContiene('nombre_cliente', b),
        bDoc ? ilikeContiene('doc_cliente', bDoc) : null,
        ilikeContiene('nombre_asesor', b),
        ilikeContiene('nombre_ramo', b),
        ilikeContiene('nombre_prod', b),
        ilikeContiene('nombre_aseg', b),
        ilikeContiene('nombre_interm', b),
        ilikeContiene('nombre_forma_pago', b),
        ilikeContiene('nombre_formaexp', b),
        ilikeContiene('nombre_usuario', b),
        ilikeContiene('apodo_usuario', b),
        ilikeContiene('bien_asegurado', b),
        ilikeContiene('obs_poliza', b),
      ]
        .filter(Boolean)
        .join(','),
    )
  }
  const { data, error } = await q.order('id', { ascending: false }).limit(limite)
  if (error) throw error
  return (data ?? []) as unknown as PolizaLista[]
}

export const etiquetaPoliza = (p: { id: number; nro_poliza: string | null; nombre_cliente: string | null }) =>
  `${p.nro_poliza ?? p.id}  –  ${p.nombre_cliente ?? ''}`
