import { useSyncExternalStore } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { mensajeAmigable } from '@/lib/errores'
import { listarCatalogo } from './catalogos'
import { conReintentos, BYTES_FIRMA, firmaArchivo, mimeDeNombre } from './cargaMasivaLogica'
import { extraerPoliza, MAX_BYTES_ARCHIVO } from './ia'
import { crearPendiente } from './pendientes'

// Carga masiva de pólizas con IA (réplica de lib/datos/servicio_carga_masiva.dart).
// El estado vive a nivel de módulo, fuera de cualquier pantalla: el usuario
// puede ir a otras partes de la app y el lote sigue corriendo. Un solo lote
// a la vez. Cada resultado queda como "Pendiente de revisión"; nada se
// guarda como póliza real hasta que alguien lo revise desde Pendientes.

export type EstadoArchivoCarga = 'pendiente' | 'procesando' | 'ok' | 'error'

export interface ItemCargaMasiva {
  id: number
  nombre: string
  archivo: File
  mimeType: string
  estado: EstadoArchivoCarga
  error: string | null
  /** Ya quedó registrado en Pendientes con su error (se registra una sola vez). */
  errorRegistrado: boolean
  /** Firma para detectar el mismo archivo repetido en el lote (se calcula al procesar). */
  firma: string | null
}

export interface EstadoCargaMasiva {
  items: ItemCargaMasiva[]
  procesando: boolean
  procesados: number
}

const ORIGEN = 'ia_carga_masiva'

let estado: EstadoCargaMasiva = { items: [], procesando: false, procesados: 0 }
let siguienteId = 1
const oyentes = new Set<() => void>()

function fijar(cambios: Partial<EstadoCargaMasiva>) {
  estado = { ...estado, ...cambios }
  for (const o of oyentes) o()
}

function cambiarItem(id: number, cambios: Partial<ItemCargaMasiva>) {
  fijar({ items: estado.items.map((i) => (i.id === id ? { ...i, ...cambios } : i)) })
}

function suscribir(cb: () => void) {
  oyentes.add(cb)
  return () => {
    oyentes.delete(cb)
  }
}

export function obtenerEstadoCargaMasiva() {
  return estado
}

/** Estado completo (lista de archivos incluida) para la pantalla de carga masiva. */
export function useEstadoCargaMasiva(): EstadoCargaMasiva {
  return useSyncExternalStore(suscribir, obtenerEstadoCargaMasiva)
}

/** Progreso resumido, para mostrarlo desde cualquier pantalla. */
export function useCargaMasiva(): { procesando: boolean; procesados: number; total: number } {
  const e = useEstadoCargaMasiva()
  return { procesando: e.procesando, procesados: e.procesados, total: e.items.length }
}

export const hayFallidos = (e: EstadoCargaMasiva) => e.items.some((i) => i.estado === 'error')

/**
 * Agrega los archivos elegidos. Solo se aceptan PDF, JPG, PNG y WEBP; los
 * demás se devuelven como rechazados. Si la lista actual todavía no se
 * empezó a procesar, los nuevos se suman; si ya se procesó, la reemplazan.
 */
export function agregarArchivos(archivos: File[]): { agregados: number; rechazados: string[] } {
  if (estado.procesando) return { agregados: 0, rechazados: [] }
  const rechazados: string[] = []
  const nuevos: ItemCargaMasiva[] = []
  for (const f of archivos) {
    const mime = mimeDeNombre(f.name)
    if (!mime) {
      rechazados.push(f.name)
      continue
    }
    nuevos.push({
      id: siguienteId++,
      nombre: f.name,
      archivo: f,
      mimeType: mime,
      estado: 'pendiente',
      error: null,
      errorRegistrado: false,
      firma: null,
    })
  }
  if (nuevos.length) {
    const sinEmpezar = estado.items.every((i) => i.estado === 'pendiente')
    fijar({ items: sinEmpezar ? [...estado.items, ...nuevos] : nuevos, procesados: 0 })
  }
  return { agregados: nuevos.length, rechazados }
}

/** Quita un archivo de la lista (solo mientras no se esté procesando). */
export function quitarArchivo(id: number) {
  if (estado.procesando) return
  const items = estado.items.filter((i) => i.id !== id)
  fijar({ items, procesados: items.filter((i) => i.estado === 'ok' || i.estado === 'error').length })
}

export function limpiarCargaMasiva() {
  if (estado.procesando) return
  fijar({ items: [], procesados: 0 })
}

/** Cambia en cada cierre de sesión: un lote de la sesión anterior deja de procesar. */
let generacion = 0

/**
 * Al cerrar sesión: corta el lote en curso (los archivos que falten no se
 * procesan con el usuario siguiente) y olvida la lista.
 */
export function cancelarCargaMasiva() {
  generacion++
  window.removeEventListener('beforeunload', avisoAlCerrar)
  fijar({ items: [], procesados: 0, procesando: false })
}

/** Aseguradora + ramo + producto activos, para que la IA escoja combinaciones reales. */
export async function catalogoProductosParaIA(): Promise<{ aseguradora: string; ramo: string; producto: string }[]> {
  const [productos, aseguradoras, ramos] = await Promise.all([
    listarCatalogo('productos'),
    listarCatalogo('aseguradoras'),
    listarCatalogo('ramos'),
  ])
  const asegPorId = new Map(aseguradoras.filter((a) => a.estado_aseg).map((a) => [a.id, a.nombre_aseg]))
  const ramoPorId = new Map(ramos.filter((r) => r.estado_ramo).map((r) => [r.id, r.nombre_ramo]))
  return productos
    .filter((p) => p.estado_prod)
    .map((p) => ({
      aseguradora: asegPorId.get(p.aseguradora_id) ?? '',
      ramo: ramoPorId.get(p.ramo_id) ?? '',
      producto: p.nombre_prod,
    }))
    .filter((m) => m.aseguradora !== '' && m.ramo !== '')
}

async function calcularFirma(archivo: File): Promise<string> {
  const inicio = new Uint8Array(await archivo.slice(0, BYTES_FIRMA).arrayBuffer())
  const fin = new Uint8Array(await archivo.slice(Math.max(0, archivo.size - BYTES_FIRMA)).arrayBuffer())
  return firmaArchivo(archivo.size, inicio, fin)
}

/** Aviso del navegador si se intenta cerrar la pestaña con un lote en curso. */
function avisoAlCerrar(e: BeforeUnloadEvent) {
  e.preventDefault()
  e.returnValue = ''
}

/**
 * Procesa los archivos pendientes o que fallaron. Los que ya salieron bien
 * no se vuelven a enviar: volver a llamar esto sirve de "Reintentar
 * fallidos" sin gastar de nuevo en los exitosos. [qc] se usa para refrescar
 * la bandeja de Pendientes a medida que entran resultados.
 */
export async function procesarTodos(qc?: QueryClient): Promise<void> {
  if (estado.procesando || estado.items.length === 0) return
  const miGeneracion = generacion
  const cancelado = () => generacion !== miGeneracion
  fijar({ procesando: true, procesados: estado.items.filter((i) => i.estado === 'ok').length })
  window.addEventListener('beforeunload', avisoAlCerrar)
  const refrescarPendientes = () => void qc?.invalidateQueries({ queryKey: ['pendientes'] })

  try {
    const catalogo = await catalogoProductosParaIA()
    const vistos = new Set<string>()
    // Los que ya salieron bien cuentan como vistos: así un repetido que se
    // omitió no se vuelve a procesar al reintentar los fallidos.
    for (const i of estado.items) if (i.estado === 'ok' && i.firma) vistos.add(i.firma)

    for (const { id } of [...estado.items]) {
      if (cancelado()) return
      const item = estado.items.find((i) => i.id === id)
      if (!item || item.estado === 'ok') continue

      // El mismo archivo elegido dos veces en el lote se procesa una vez.
      const firma = item.firma ?? (await calcularFirma(item.archivo))
      if (vistos.has(firma)) {
        cambiarItem(id, { firma, estado: 'error', error: 'Archivo repetido en este lote: se omitió.' })
        fijar({ procesados: estado.procesados + 1 })
        continue
      }
      vistos.add(firma)

      cambiarItem(id, { firma, estado: 'procesando', error: null })
      try {
        if (item.archivo.size > MAX_BYTES_ARCHIVO) {
          throw new Error('El archivo pesa más de 15 MB. Use una versión más liviana.')
        }
        const datos = await conReintentos(() => extraerPoliza(item.archivo, catalogo))
        if (cancelado()) return
        await crearPendiente({
          estado: 'pendiente_revision',
          datos,
          nombre_archivo: item.nombre,
          origen: ORIGEN,
        })
        cambiarItem(id, { estado: 'ok' })
      } catch (e) {
        if (cancelado()) return
        const msg = mensajeAmigable(e)
        // Se deja registrado una vez en Pendientes, con el error a la vista,
        // en vez de perderse en silencio.
        let registrado = item.errorRegistrado
        if (!registrado) {
          try {
            await crearPendiente({
              estado: 'pendiente_revision',
              datos: {},
              nombre_archivo: item.nombre,
              origen: ORIGEN,
              error_msg: msg,
            })
            registrado = true
          } catch {
            /* sin conexión: queda solo el error en la lista */
          }
        }
        cambiarItem(id, { estado: 'error', error: msg, errorRegistrado: registrado })
      }
      fijar({ procesados: estado.procesados + 1 })
      refrescarPendientes()
    }
  } catch (e) {
    if (cancelado()) return
    // Falla antes de empezar (por ejemplo, sin conexión al traer el catálogo).
    const msg = `No se pudo iniciar la carga: ${mensajeAmigable(e)}`
    fijar({
      items: estado.items.map((i) =>
        i.estado === 'pendiente' || i.estado === 'procesando' ? { ...i, estado: 'error', error: msg } : i,
      ),
    })
  } finally {
    // Nunca queda trabada en "procesando" (si se canceló, ya se limpió).
    if (!cancelado()) {
      window.removeEventListener('beforeunload', avisoAlCerrar)
      fijar({ procesando: false })
      refrescarPendientes()
    }
  }
}
