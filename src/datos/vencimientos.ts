import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/supabase'
import { aISO, diasEntre, aFecha, hoy } from '@/lib/fechas'
import { DIAS_VENCIDA, DIAS_VENTANA, estaCerrado, type EstadoSeguimiento } from './vencimientosLogica'

export interface Vencimiento {
  polizaId: number
  nroPoliza: string | null
  clienteId: number | null
  nombreCliente: string | null
  telCliente: string | null
  correoCliente: string | null
  nombreAseg: string | null
  nombreAsesor: string | null
  nombreRamo: string | null
  nombreProd: string | null
  bien: string | null
  prima: number
  vence: string
  dias: number
  estado: EstadoSeguimiento
  nota: string | null
  proximoContacto: string | null
  actualizado: string | null
}

export const CLAVE_VENCIMIENTOS = ['vencimientos'] as const

interface FilaVista {
  id: number
  nro_poliza: string | null
  cliente_id: number | null
  ffin_poliza: string
  prima_poliza: number | null
  bien_asegurado: string | null
  nombre_cliente: string | null
  tel_cliente: string | null
  nombre_aseg: string | null
  nombre_asesor: string | null
  nombre_ramo: string | null
  nombre_prod: string | null
}
interface FilaSeg {
  poliza_id: number
  estado: EstadoSeguimiento
  nota: string | null
  proximo_contacto: string | null
  factualizado: string | null
}

async function porLotes<T>(ids: number[], f: (lote: number[]) => Promise<T[]>): Promise<T[]> {
  const r: T[] = []
  for (let i = 0; i < ids.length; i += 200) r.push(...(await f(ids.slice(i, i + 200))))
  return r
}

/** Pólizas vigentes que vencen pronto (o vencieron hace poco), con su seguimiento y datos de contacto. */
export async function listarVencimientos(): Promise<Vencimiento[]> {
  const h = hoy()
  const desde = new Date(h.getFullYear(), h.getMonth(), h.getDate() - DIAS_VENCIDA)
  const hasta = new Date(h.getFullYear(), h.getMonth(), h.getDate() + DIAS_VENTANA)
  const { data, error } = await db
    .from('vw_polizas_busqueda')
    .select('id, nro_poliza, cliente_id, ffin_poliza, prima_poliza, bien_asegurado, nombre_cliente, tel_cliente, nombre_aseg, nombre_asesor, nombre_ramo, nombre_prod')
    .neq('estado_poliza_id', 'A')
    .gte('ffin_poliza', aISO(desde))
    .lte('ffin_poliza', aISO(hasta))
    .order('ffin_poliza', { ascending: true })
    .limit(2000)
  if (error) throw error
  const polizas = (data ?? []) as unknown as FilaVista[]
  if (polizas.length === 0) return []

  const segs = await porLotes(polizas.map((p) => p.id), async (lote) => {
    const { data: d, error: e } = await db
      .from('seguimientos_renovacion')
      .select('poliza_id, estado, nota, proximo_contacto, factualizado')
      .in('poliza_id', lote)
    if (e) throw e
    return (d ?? []) as unknown as FilaSeg[]
  })
  const segPor = new Map(segs.map((s) => [s.poliza_id, s]))

  const clienteIds = [...new Set(polizas.map((p) => p.cliente_id).filter((x): x is number => x != null))]
  const correos = await porLotes(clienteIds, async (lote) => {
    const { data: d, error: e } = await db.from('clientes').select('id, correo_cliente').in('id', lote)
    if (e) throw e
    return (d ?? []) as unknown as { id: number; correo_cliente: string | null }[]
  })
  const correoPor = new Map(correos.map((c) => [c.id, c.correo_cliente]))

  return polizas.map((p) => {
    const s = segPor.get(p.id)
    const fin = aFecha(p.ffin_poliza)
    return {
      polizaId: p.id,
      nroPoliza: p.nro_poliza,
      clienteId: p.cliente_id,
      nombreCliente: p.nombre_cliente,
      telCliente: p.tel_cliente,
      correoCliente: p.cliente_id != null ? (correoPor.get(p.cliente_id) ?? null) : null,
      nombreAseg: p.nombre_aseg,
      nombreAsesor: p.nombre_asesor,
      nombreRamo: p.nombre_ramo,
      nombreProd: p.nombre_prod,
      bien: p.bien_asegurado,
      prima: Number(p.prima_poliza ?? 0),
      vence: p.ffin_poliza,
      dias: fin ? diasEntre(h, fin) : 0,
      estado: s?.estado ?? 'P',
      nota: s?.nota ?? null,
      proximoContacto: s?.proximo_contacto ?? null,
      actualizado: s?.factualizado ?? null,
    }
  })
}

export async function guardarSeguimiento(polizaId: number, estado: EstadoSeguimiento, nota: string | null, proximo: string | null) {
  const { error } = await db.rpc('seguimiento_renovacion_guardar', {
    p_poliza_id: polizaId,
    p_estado: estado,
    p_nota: nota,
    p_proximo: proximo,
  })
  if (error) throw error
}

/** Cuántas pólizas siguen sin atender (por recordar o con contacto pendiente) y vencen en 15 días o menos. */
export function contarUrgentes(v: Vencimiento[]): number {
  return v.filter((x) => !estaCerrado(x.estado) && x.estado === 'P' && x.dias <= 15).length
}

export function useConteoVencimientos(activo = true) {
  return useQuery({
    queryKey: [...CLAVE_VENCIMIENTOS, 'lista'],
    queryFn: listarVencimientos,
    staleTime: 60_000,
    enabled: activo,
    select: contarUrgentes,
  })
}
