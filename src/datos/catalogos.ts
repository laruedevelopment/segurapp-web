import { useQuery, useQueryClient } from '@tanstack/react-query'
import { escaparLike, ilikeContiene, normalizarAlfanumerico } from '@/lib/filtros'
import { usuarioId } from '@/lib/sesion'
import { db } from '@/lib/supabase'
import type {
  Aseguradora,
  Asesor,
  Cliente,
  EstadoPoliza,
  FormaExpedicion,
  FormaPago,
  Intermediario,
  Municipio,
  Producto,
  Ramo,
  Usuario,
} from '@/lib/tipos'

// ── Catálogos chicos ────────────────────────────────────────────────────────
// Se traen completos una vez y se filtran en el navegador. React Query los
// guarda 10 minutos; al crear/editar/eliminar se invalidan con
// useRefrescarCatalogo().

export const MINUTOS_CATALOGO = 10

/** Tabla → orden y columnas de cada catálogo chico. */
export const CATALOGOS = {
  aseguradoras: { orden: 'nombre_aseg', columnas: '*' },
  ramos: { orden: 'nombre_ramo', columnas: '*' },
  productos: { orden: 'nombre_prod', columnas: '*' },
  asesores: { orden: 'nombre_asesor', columnas: '*' },
  intermediarios: { orden: 'nombre_interm', columnas: '*' },
  formas_pago: { orden: 'nombre_forma_pago', columnas: '*' },
  formaexp: { orden: 'nombre_formaexp', columnas: '*' },
  municipio: { orden: 'nombre_munic', columnas: '*' },
  estados_poliza: { orden: 'id', columnas: '*' },
  // clave_usuario (el hash) no se puede leer desde la app.
  usuarios: {
    orden: 'apodo_usuario',
    columnas: 'id, apodo_usuario, nombre_usuario, rol, asesor_id, correo_usuario, estado_usuario',
  },
} as const

export type TablaCatalogo = keyof typeof CATALOGOS

interface FilaPorTabla {
  aseguradoras: Aseguradora
  ramos: Ramo
  productos: Producto
  asesores: Asesor
  intermediarios: Intermediario
  formas_pago: FormaPago
  formaexp: FormaExpedicion
  municipio: Municipio
  estados_poliza: EstadoPoliza
  usuarios: Usuario
}

export async function listarCatalogo<T extends TablaCatalogo>(tabla: T): Promise<FilaPorTabla[T][]> {
  const { orden, columnas } = CATALOGOS[tabla]
  const { data, error } = await db
    .from(tabla)
    .select(columnas)
    .order(orden, { ascending: true })
    .order('id', { ascending: true })
    .limit(50000)
  if (error) throw error
  return (data ?? []) as unknown as FilaPorTabla[T][]
}

export function useCatalogo<T extends TablaCatalogo>(tabla: T) {
  return useQuery({
    queryKey: ['catalogo', tabla],
    queryFn: () => listarCatalogo(tabla),
    staleTime: MINUTOS_CATALOGO * 60_000,
  })
}

/** Invalida uno o todos los catálogos (botón Recargar, después de guardar). */
export function useRefrescarCatalogo() {
  const qc = useQueryClient()
  return (tabla?: TablaCatalogo) =>
    qc.invalidateQueries({ queryKey: tabla ? ['catalogo', tabla] : ['catalogo'] })
}

/** Inserta una fila en un catálogo, anotando quién la creó. */
export async function crearEnCatalogo(tabla: TablaCatalogo, fila: Record<string, unknown>, conUsuario = true) {
  const { data, error } = await db
    .from(tabla)
    .insert({ ...fila, ...(conUsuario ? { usuario_id: usuarioId() } : {}) })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: number }).id
}

export async function actualizarEnCatalogo(
  tabla: TablaCatalogo,
  id: number | string,
  fila: Record<string, unknown>,
  conUsuario = true,
) {
  const { error } = await db
    .from(tabla)
    .update({ ...fila, ...(conUsuario ? { usuario_id: usuarioId() } : {}) })
    .eq('id', id)
  if (error) throw error
}

/** Elimina; si la fila está en uso (llave foránea) lanza [mensajeEnUso]. */
export async function eliminarDeCatalogo(tabla: string, id: number | string, mensajeEnUso: string) {
  const { error } = await db.from(tabla).delete().eq('id', id)
  if (error) {
    if (error.code === '23503') throw new Error(mensajeEnUso)
    throw error
  }
}

// ── Clientes (tabla grande: búsqueda en el servidor) ────────────────────────

const COLS_CLIENTE =
  'id, nombre_cliente, tipopers_cliente, tipodoc_cliente, doc_cliente, tel_cliente, correo_cliente, ' +
  'dir_cliente, munic_id, notas_cliente, contacto_cliente, cargocont_cliente, asesor_id, estado_cliente, recordar_cliente'

/** Tope de resultados de una búsqueda: una letra no debe traer toda la tabla. */
export const MAX_RESULTADOS_CLIENTES = 500

export async function buscarClientes(texto: string, limite = MAX_RESULTADOS_CLIENTES): Promise<Cliente[]> {
  const q = texto.trim()
  const qDoc = normalizarAlfanumerico(q)
  let req = db.from('clientes').select(COLS_CLIENTE)
  if (q) {
    req = req.or(
      [
        ilikeContiene('nombre_cliente', q),
        qDoc ? ilikeContiene('doc_cliente_norm', qDoc) : null,
        ilikeContiene('tel_cliente', q),
        ilikeContiene('correo_cliente', q),
      ]
        .filter(Boolean)
        .join(','),
    )
  }
  const { data, error } = await req
    .order('nombre_cliente', { ascending: true })
    .order('id', { ascending: true })
    .limit(limite)
  if (error) throw error
  return (data ?? []) as unknown as Cliente[]
}

export async function obtenerCliente(id: number): Promise<Cliente | null> {
  const { data, error } = await db
    .from('clientes')
    .select(`${COLS_CLIENTE}, municipio:munic_id ( id, nombre_munic )`)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as unknown as Cliente | null
}

/** Match exacto por documento normalizado (sin puntos ni guión). */
export async function buscarClientePorDoc(doc: string): Promise<Cliente | null> {
  const norm = normalizarAlfanumerico(doc)
  if (!norm) return null
  const { data, error } = await db.from('clientes').select(COLS_CLIENTE).eq('doc_cliente_norm', norm).limit(1)
  if (error) throw error
  return ((data ?? [])[0] as unknown as Cliente) ?? null
}

/** El mismo número no puede repetirse dentro del mismo tipo de documento. */
export async function existeDocCliente(tipoDoc: string | null, doc: string, excluirId?: number) {
  const norm = normalizarAlfanumerico(doc)
  if (!norm) return false
  let q = db.from('clientes').select('id').eq('doc_cliente_norm', norm)
  const tipo = (tipoDoc ?? '').trim()
  q = tipo ? q.eq('tipodoc_cliente', tipo) : q.is('tipodoc_cliente', null)
  if (excluirId != null) q = q.neq('id', excluirId)
  const { data, error } = await q.limit(1)
  if (error) throw error
  return (data ?? []).length > 0
}

export async function crearCliente(c: Omit<Cliente, 'id' | 'municipio'>): Promise<number> {
  const { data, error } = await db
    .from('clientes')
    .insert({ ...c, usuario_id: usuarioId() })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: number }).id
}

export async function actualizarCliente(id: number, c: Omit<Cliente, 'id' | 'municipio'>) {
  const { error } = await db
    .from('clientes')
    .update({ ...c, usuario_id: usuarioId() })
    .eq('id', id)
  if (error) throw error
}

export async function listarClientesDuplicados(): Promise<Cliente[]> {
  const { data, error } = await db.from('vw_clientes_duplicados').select()
  if (error) throw error
  return (data ?? []) as Cliente[]
}

/** Mueve las pólizas de los clientes sobrantes al correcto y los borra (transacción en la base). */
export async function fusionarClientes(idBueno: number, idsMalos: number[]) {
  const { error } = await db.rpc('fusionar_clientes', { p_id_bueno: idBueno, p_ids_malos: idsMalos })
  if (error) throw error
}

// ── Usuarios ────────────────────────────────────────────────────────────────

export async function existeApodoUsuario(apodo: string, excluirId?: number) {
  let q = db.from('usuarios').select('id').ilike('apodo_usuario', escaparLike(apodo.trim()))
  if (excluirId != null) q = q.neq('id', excluirId)
  const { data, error } = await q.limit(1)
  if (error) throw error
  return (data ?? []).length > 0
}

/** [nuevaClave]: la base la convierte en hash sola. Sin ella, la clave no cambia. */
export async function guardarUsuario(
  id: number | null,
  u: Omit<Usuario, 'id'>,
  nuevaClave?: string,
) {
  const fila = { ...u, ...(nuevaClave ? { clave_usuario: nuevaClave } : {}) }
  const { error } = id == null
    ? await db.from('usuarios').insert(fila)
    : await db.from('usuarios').update(fila).eq('id', id)
  if (error) {
    if (error.code === '23505') throw new Error('Ya existe un usuario con ese apodo.')
    throw error
  }
}

// ── Aprendizaje de la IA ────────────────────────────────────────────────────
// Una corrección se aplica sola desde la segunda vez que se repite (veces ≥ 2).

export async function buscarProductoAprendido(asegId: number, textoNorm: string) {
  if (!textoNorm.trim()) return null
  const { data } = await db
    .from('ia_aprendizaje_producto')
    .select('producto_id')
    .eq('aseguradora_id', asegId)
    .eq('texto_extraido', textoNorm)
    .gte('veces', 2)
    .maybeSingle()
  return (data?.producto_id as number | undefined) ?? null
}

export async function registrarAprendizajeProducto(asegId: number, textoNorm: string, productoId: number) {
  if (!textoNorm.trim()) return
  await db.rpc('registrar_aprendizaje_producto', { p_aseg: asegId, p_texto: textoNorm, p_producto: productoId })
}

export async function buscarIntermediarioAprendido(asegId: number, textoNorm: string) {
  if (!textoNorm.trim()) return null
  const { data } = await db
    .from('ia_aprendizaje_intermediario_reporte')
    .select('intermediario_id')
    .eq('aseguradora_id', asegId)
    .eq('texto_extraido', textoNorm)
    .gte('veces', 2)
    .maybeSingle()
  return (data?.intermediario_id as number | undefined) ?? null
}

export async function registrarAprendizajeIntermediario(asegId: number, textoNorm: string, intermId: number) {
  if (!textoNorm.trim()) return
  await db.rpc('registrar_aprendizaje_intermediario', { p_aseg: asegId, p_texto: textoNorm, p_interm: intermId })
}

export async function rolClientePreferido(asegId: number) {
  const { data } = await db
    .from('ia_aprendizaje_rol_cliente')
    .select('rol')
    .eq('aseguradora_id', asegId)
    .gte('veces', 2)
    .order('veces', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.rol as string | undefined) ?? null
}

export async function reforzarAprendizajeRolCliente(asegId: number, rol: string) {
  await db.rpc('reforzar_aprendizaje_rol_cliente', { p_aseg: asegId, p_rol: rol })
}
