import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/supabase'
import { esAdmin, useSesion, veComisiones } from '@/lib/sesion'

import { PORC_COMISION_MAXIMO } from './comisionesRevisionLogica'

export interface PolizaComisionRevisar {
  id: number
  nro_poliza: string | null
  fexp_poliza: string | null
  prima_poliza: number | null
  porccom_poliza: number | null
  vlrcom_poliza: number | null
  cliente: { nombre_cliente: string | null } | null
  producto: { nombre_prod: string | null } | null
}

const FILTRO_PORC = `porccom_poliza.gt.${PORC_COMISION_MAXIMO},porccom_poliza.lt.0`
export const CLAVE_COMISIONES_REVISAR = ['polizas', 'comisiones-revisar'] as const

export async function listarComisionesSospechosas(): Promise<PolizaComisionRevisar[]> {
  const { data, error } = await db
    .from('polizas')
    .select('id, nro_poliza, fexp_poliza, prima_poliza, porccom_poliza, vlrcom_poliza, cliente:cliente_id(nombre_cliente), producto:producto_id(nombre_prod)')
    .or(FILTRO_PORC)
    .order('fexp_poliza', { ascending: false })
    .limit(500)
  if (error) throw error
  return (data ?? []) as unknown as PolizaComisionRevisar[]
}

export async function contarComisionesSospechosas(): Promise<number> {
  const { count, error } = await db.from('polizas').select('id', { count: 'exact', head: true }).or(FILTRO_PORC)
  if (error) throw error
  return count ?? 0
}

/** Contador de la tarjeta de inicio (solo quien ve comisiones). */
export function useConteoComisionesSospechosas() {
  const u = useSesion()?.usuario
  return useQuery({
    queryKey: [...CLAVE_COMISIONES_REVISAR, 'conteo'],
    queryFn: contarComisionesSospechosas,
    enabled: veComisiones(u) || esAdmin(u),
    staleTime: 60_000,
  })
}
