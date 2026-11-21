import { db } from '@/lib/supabase'
import { hoy } from '@/lib/fechas'
import { cruzarSoat, type FilaSoat, type SoatRegistro, type VehiculoPoliza } from './soatLogica'

export const CLAVE_SOAT = ['soat-todo-riesgo'] as const
const RAMOS_VEHICULO = ['LIVIANOS', 'PESADOS']

interface FilaVista {
  id: number
  cliente_id: number | null
  nombre_cliente: string | null
  tel_cliente: string | null
  bien_asegurado: string | null
  obs_poliza: string | null
  nombre_ramo: string | null
  nombre_prod: string | null
  nombre_aseg: string | null
  nombre_asesor: string | null
  ffin_poliza: string
}

async function paginar<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const todo: T[] = []
  for (let i = 0; ; i += 1000) {
    const { data, error } = await consulta(i, i + 999)
    if (error) throw error
    const filas = (data ?? []) as T[]
    todo.push(...filas)
    if (filas.length < 1000) return todo
  }
}

/** Pólizas vigentes de vehículos cruzadas con los SOAT de sus clientes. */
export async function listarSoatVehiculos(): Promise<FilaSoat[]> {
  const h = hoy()
  const hoyIso = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`
  const polizas = await paginar<FilaVista>((d, a) =>
    db
      .from('vw_polizas_busqueda')
      .select('id, cliente_id, nombre_cliente, tel_cliente, bien_asegurado, obs_poliza, nombre_ramo, nombre_prod, nombre_aseg, nombre_asesor, ffin_poliza')
      .in('nombre_ramo', RAMOS_VEHICULO)
      .neq('estado_poliza_id', 'A')
      .gte('ffin_poliza', hoyIso)
      .order('id')
      .range(d, a),
  )
  const vehiculos: VehiculoPoliza[] = polizas.map((p) => ({
    id: p.id,
    clienteId: p.cliente_id,
    nombreCliente: p.nombre_cliente,
    tel: p.tel_cliente,
    bien: p.bien_asegurado,
    obs: p.obs_poliza,
    ramo: p.nombre_ramo,
    producto: p.nombre_prod,
    nombreAseg: p.nombre_aseg,
    asesor: p.nombre_asesor,
    vence: p.ffin_poliza,
  }))

  const clientes = [...new Set(vehiculos.map((v) => v.clienteId).filter((x): x is number => x != null))]
  const soats: SoatRegistro[] = []
  for (let i = 0; i < clientes.length; i += 40) {
    const lote = clientes.slice(i, i + 40)
    const filas = await paginar<{ cliente_id: number | null; bien_asegurado: string | null; ffin_poliza: string | null }>((d, a) =>
      db
        .from('vw_polizas_busqueda')
        .select('cliente_id, bien_asegurado, ffin_poliza')
        .eq('nombre_ramo', 'SOAT')
        .neq('estado_poliza_id', 'A')
        .not('ffin_poliza', 'is', null)
        .in('cliente_id', lote)
        .order('id')
        .range(d, a),
    )
    for (const f of filas) if (f.ffin_poliza) soats.push({ clienteId: f.cliente_id, bien: f.bien_asegurado, vence: f.ffin_poliza })
  }
  return cruzarSoat(vehiculos, soats, h)
}
