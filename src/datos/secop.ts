import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/supabase'
import { usuarioId } from '@/lib/sesion'
import {
  contratoDesdeFila,
  indiceClientes,
  parametrosConsulta,
  type ContratoSecop,
  type EstadoOportunidad,
  type FiltroContratos,
} from './secopLogica'

// "Oportunidades SECOP": contratos públicos recién firmados, consultados en vivo
// a datos.gov.co (SECOP II – Contratos Electrónicos). El seguimiento de cada uno
// (contactado, cotizado…) se guarda en la tabla oportunidades_secop.

const URL_CONTRATOS = 'https://www.datos.gov.co/resource/jbjy-vk9h.json'

export const CLAVE_SECOP = ['secop'] as const

export async function buscarContratos(filtro: FiltroContratos, senal?: AbortSignal): Promise<ContratoSecop[]> {
  const params = new URLSearchParams(parametrosConsulta(filtro))
  let resp: Response
  try {
    resp = await fetch(`${URL_CONTRATOS}?${params}`, { signal: senal })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new Error('No se pudo conectar con datos.gov.co. Revise su conexión e intente de nuevo.')
  }
  if (!resp.ok) throw new Error(`datos.gov.co respondió con un error (${resp.status}). Intente de nuevo en unos minutos.`)
  const filas = (await resp.json()) as Record<string, unknown>[]
  return filas.map(contratoDesdeFila).filter((c): c is ContratoSecop => c !== null)
}

/** Todos los clientes (id, nombre, documento) para saber cuáles contratistas ya lo son. */
export async function listarDocumentosClientes() {
  const salida: { id: number; nombre: string; doc: string | null }[] = []
  const TAM = 1000
  for (let desde = 0; ; desde += TAM) {
    const { data, error } = await db
      .from('clientes')
      .select('id, nombre_cliente, doc_cliente')
      .order('id')
      .range(desde, desde + TAM - 1)
    if (error) throw error
    const filas = (data ?? []) as { id: number; nombre_cliente: string | null; doc_cliente: string | null }[]
    for (const f of filas) salida.push({ id: f.id, nombre: f.nombre_cliente ?? '', doc: f.doc_cliente })
    if (filas.length < TAM) break
  }
  return salida
}

export function useIndiceClientes() {
  return useQuery({
    queryKey: [...CLAVE_SECOP, 'clientes'],
    queryFn: async () => indiceClientes(await listarDocumentosClientes()),
    staleTime: 10 * 60 * 1000,
  })
}

export interface Seguimiento {
  idContrato: string
  estado: EstadoOportunidad
  nota: string | null
}

export async function listarSeguimientos(): Promise<Map<string, Seguimiento>> {
  const mapa = new Map<string, Seguimiento>()
  const TAM = 1000
  for (let desde = 0; ; desde += TAM) {
    const { data, error } = await db
      .from('oportunidades_secop')
      .select('id_contrato, estado, nota')
      .order('id_contrato')
      .range(desde, desde + TAM - 1)
    if (error) throw error
    const filas = (data ?? []) as { id_contrato: string; estado: EstadoOportunidad; nota: string | null }[]
    for (const f of filas) mapa.set(f.id_contrato, { idContrato: f.id_contrato, estado: f.estado, nota: f.nota })
    if (filas.length < TAM) break
  }
  return mapa
}

export function useSeguimientos() {
  return useQuery({ queryKey: [...CLAVE_SECOP, 'seguimiento'], queryFn: listarSeguimientos, retry: false })
}

/** Guarda (o actualiza) el estado y la nota de un contrato. */
export async function guardarSeguimiento(c: ContratoSecop, estado: EstadoOportunidad, nota: string) {
  const { error } = await db.from('oportunidades_secop').upsert(
    {
      id_contrato: c.idContrato,
      estado,
      nota: nota.trim() ? nota.trim().slice(0, 500) : null,
      proveedor: c.proveedor || null,
      documento: c.documento || null,
      entidad: c.entidad || null,
      valor: c.valor,
      usuario_id: usuarioId(),
    },
    { onConflict: 'id_contrato' },
  )
  if (error) throw error
}
