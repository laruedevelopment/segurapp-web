import { db } from '@/lib/supabase'
import type { Cliente } from '@/lib/tipos'

// Consultas de clientes que solo usa el catálogo (el resto está en
// src/datos/catalogos.ts).

/** Mismas columnas que COLS_CLIENTE de src/datos/catalogos.ts. */
const COLUMNAS =
  'id, nombre_cliente, tipopers_cliente, tipodoc_cliente, doc_cliente, tel_cliente, correo_cliente, ' +
  'dir_cliente, munic_id, notas_cliente, contacto_cliente, cargocont_cliente, asesor_id, estado_cliente, recordar_cliente'

const PAGINA = 1000

/**
 * Todos los clientes, en páginas de 1000. El id desempata el orden por
 * nombre: sin él, entre páginas se podrían saltar o repetir filas.
 */
export async function listarTodosClientes(): Promise<Cliente[]> {
  const todos: Cliente[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await db
      .from('clientes')
      .select(COLUMNAS)
      .order('nombre_cliente', { ascending: true })
      .order('id', { ascending: true })
      .range(desde, desde + PAGINA - 1)
    if (error) throw error
    const filas = (data ?? []) as unknown as Cliente[]
    todos.push(...filas)
    if (filas.length < PAGINA) break
  }
  return todos
}

/** Claves de React Query de los clientes (todas bajo ['catalogo', 'clientes']). */
export const CLAVE_CLIENTES = ['catalogo', 'clientes'] as const
export const claveCliente = (id: number) => [...CLAVE_CLIENTES, 'detalle', id] as const
