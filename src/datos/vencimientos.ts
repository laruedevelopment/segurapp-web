import { nombreBien } from '@/lib/placa'
import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/supabase'
import { diasEntre, aFecha, hoy } from '@/lib/fechas'
import { colapsarAnexos } from './grupoPolizaLogica'
import { rangoPorDefecto, renovadasAutomaticamente, resumir, type PolizaClave, type EstadoSeguimiento, type RangoFechas } from './vencimientosLogica'

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
  /** Anexos de la misma vigencia que se agrupan en esta fila (0 si no tiene). */
  anexos: number
  prima: number
  vence: string
  dias: number
  estado: EstadoSeguimiento
  /** Hay otra póliza posterior del mismo cliente, ramo y bien: se da por renovada. */
  renovadaAuto: boolean
  nota: string | null
  proximoContacto: string | null
  actualizado: string | null
}

export const CLAVE_VENCIMIENTOS = ['vencimientos'] as const

interface FilaVista {
  id: number
  nro_poliza: string | null
  cliente_id: number | null
  ramo_id: number | null
  aseg_id: number | null
  ffin_poliza: string
  prima_poliza: number | null
  bien_asegurado: string | null
  obs_poliza: string | null
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
export async function listarVencimientos(rango?: RangoFechas): Promise<Vencimiento[]> {
  const h = hoy()
  const { desde, hasta } = rango ?? rangoPorDefecto(h)
  const { data, error } = await db
    .from('vw_polizas_busqueda')
    .select('id, nro_poliza, cliente_id, ramo_id, aseg_id, ffin_poliza, prima_poliza, bien_asegurado, obs_poliza, nombre_cliente, tel_cliente, nombre_aseg, nombre_asesor, nombre_ramo, nombre_prod')
    .neq('estado_poliza_id', 'A')
    .gte('ffin_poliza', desde)
    .lte('ffin_poliza', hasta)
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

  // Posteriores del mismo cliente (para dar por renovadas las que ya tienen la siguiente).
  const posteriores: PolizaClave[] = []
  for (let i = 0; i < clienteIds.length; i += 40) {
    const lote = clienteIds.slice(i, i + 40)
    for (let desdeFila = 0; ; desdeFila += 1000) {
      const { data: d, error: e } = await db
        .from('vw_polizas_busqueda')
        .select('id, cliente_id, ramo_id, aseg_id, nro_poliza, bien_asegurado, obs_poliza, ffin_poliza')
        .in('cliente_id', lote)
        .neq('estado_poliza_id', 'A')
        .gte('ffin_poliza', desde)
        .order('id')
        .range(desdeFila, desdeFila + 999)
      if (e) throw e
      const filas = (d ?? []) as unknown as { id: number; cliente_id: number | null; ramo_id: number | null; aseg_id: number | null; nro_poliza: string | null; bien_asegurado: string | null; obs_poliza: string | null; ffin_poliza: string }[]
      posteriores.push(...filas.map((x) => ({ id: x.id, clienteId: x.cliente_id, ramoId: x.ramo_id, bien: x.bien_asegurado, obs: x.obs_poliza, asegId: x.aseg_id, nro: x.nro_poliza, vence: x.ffin_poliza })))
      if (filas.length < 1000) break
    }
  }
  const renovadas = renovadasAutomaticamente(
    polizas.map((p) => ({ id: p.id, clienteId: p.cliente_id, ramoId: p.ramo_id, bien: p.bien_asegurado, obs: p.obs_poliza, asegId: p.aseg_id, nro: p.nro_poliza, vence: p.ffin_poliza })),
    posteriores,
  )

  // Los anexos de una misma vigencia (mismo número base y mismo fin) se muestran como UNA póliza.
  const porId = new Map(polizas.map((p) => [p.id, p]))
  const colapsadas = colapsarAnexos(polizas.map((p) => ({ id: p.id, nro: p.nro_poliza, fin: p.ffin_poliza, bien: p.bien_asegurado, obs: p.obs_poliza, asegId: p.aseg_id })))

  return colapsadas.map((c) => {
    const p = porId.get(c.id)!
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
      // Con anexos, el nombre trae las placas de todos los vehículos de la vigencia.
      bien: nombreBien(c.placas.length ? `${p.bien_asegurado ?? ''} ${c.placas.join(' ')}` : p.bien_asegurado, p.nombre_ramo, p.nombre_prod, null),
      anexos: c.anexos,
      prima: Number(p.prima_poliza ?? 0),
      vence: p.ffin_poliza,
      dias: fin ? diasEntre(h, fin) : 0,
      renovadaAuto: renovadas.has(p.id),
      // Si ya hay una póliza posterior, se da por renovada (salvo que el personal ya la haya cerrado).
      estado: renovadas.has(p.id) && s?.estado !== 'N' ? 'F' : (s?.estado ?? 'P'),
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

/** Cambia el estado de varias pólizas a la vez, conservando la nota y la fecha de cada una. Devuelve cuántas fallaron. */
export async function guardarSeguimientos(filas: Vencimiento[], estado: EstadoSeguimiento): Promise<number> {
  const r = await Promise.allSettled(filas.map((f) => guardarSeguimiento(f.polizaId, estado, f.nota, f.proximoContacto)))
  return r.filter((x) => x.status === 'rejected').length
}

export function useConteoVencimientos(activo = true) {
  return useQuery({
    queryKey: [...CLAVE_VENCIMIENTOS, 'lista', 'defecto'],
    queryFn: () => listarVencimientos(),
    staleTime: 60_000,
    enabled: activo,
    select: resumir,
  })
}
