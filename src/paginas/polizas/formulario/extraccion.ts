// Aplicar al formulario lo que la IA leyó de una póliza (PDF/imagen), con el
// mismo matching y aprendizaje de lib/ui/pagina_formulario_polizas.dart
// (_aplicarDatosExtraidos, _buscarClienteExtraido, _matchPorNombre,
// _registrarAprendizajeIA). Las consultas a la base se reciben como
// dependencias para poder probarlo sin Supabase.

import type { Aseguradora, Producto, Ramo } from '@/lib/tipos'
import {
  aplicarDefaultsProducto,
  conPrima,
  productosDisponibles,
  ramosDisponibles,
  sugerirFin,
  type ClienteSel,
  type EstadoForm,
} from './logica'

export type RolCliente = 'tomador' | 'asegurado' | 'beneficiario'

/**
 * Normalización de Flutter (trim + mayúsculas + sin tildes en vocales y Ñ).
 * OJO: debe ser idéntica a la de la app Flutter, porque el texto
 * normalizado es la llave de la tabla ia_aprendizaje_producto que
 * comparten las dos apps.
 */
export function normalizarTextoIA(s: string): string {
  let r = s.trim().toUpperCase()
  const acentos: Record<string, string> = { Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', Ñ: 'N' }
  for (const [k, v] of Object.entries(acentos)) r = r.split(k).join(v)
  return r
}

/** Palabras de más de una letra (las comas cuentan como espacio). */
export function palabras(s: string): Set<string> {
  return new Set(
    s
      .replace(/,/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1),
  )
}

const diferenciaVacia = (a: Set<string>, b: Set<string>) => [...a].every((x) => b.has(x))

/**
 * Busca [candidato] en [lista] por nombre: primero igual, luego uno
 * contenido en el otro, y por último el mismo conjunto de palabras en otro
 * orden ("PEREZ GOMEZ, JUAN" = "Juan Perez Gomez").
 */
export function matchPorNombre<T>(lista: T[], nombre: (x: T) => string, candidato: string | null | undefined): T | null {
  if (candidato == null || !candidato.trim()) return null
  const norm = normalizarTextoIA(candidato)
  for (const item of lista) if (normalizarTextoIA(nombre(item)) === norm) return item
  for (const item of lista) {
    const n = normalizarTextoIA(nombre(item))
    if (n && (n.includes(norm) || norm.includes(n))) return item
  }
  const pc = palabras(norm)
  if (pc.size >= 2) {
    for (const item of lista) {
      const pi = palabras(normalizarTextoIA(nombre(item)))
      if (!pi.size) continue
      if (diferenciaVacia(pc, pi) || diferenciaVacia(pi, pc)) return item
    }
  }
  return null
}

export interface DepsExtraccion {
  buscarClientePorDoc: (doc: string) => Promise<ClienteSel | null>
  buscarClientes: (texto: string, limite: number) => Promise<ClienteSel[]>
  buscarProductoAprendido: (asegId: number, textoNorm: string) => Promise<number | null>
}

/**
 * Prueba el documento de cada candidato (tomador, asegurado, beneficiario)
 * contra la base: gana el primero que ya exista como cliente, sin importar
 * el rol. Si ningún documento coincide, busca por el nombre del primero
 * (el tomador), por palabras y sin importar el orden.
 */
export async function buscarClienteExtraido(
  candidatos: { rol: RolCliente; nombre: string | null; doc: string | null }[],
  deps: DepsExtraccion,
): Promise<{ cliente: ClienteSel | null; rol: RolCliente | null }> {
  try {
    for (const c of candidatos) {
      const limpio = (c.doc ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase()
      if (!limpio) continue
      const m = await deps.buscarClientePorDoc(limpio)
      if (m) return { cliente: m, rol: c.rol }
    }
    const primero = candidatos[0]
    const nombre = primero?.nombre
    if (nombre) {
      const pals = [...palabras(normalizarTextoIA(nombre))].sort((a, b) => b.length - a.length)
      if (!pals.length) return { cliente: null, rol: null }
      const res = await deps.buscarClientes(pals[0], 20)
      const m = matchPorNombre(res, (c) => c.nombre_cliente, nombre)
      return { cliente: m, rol: m ? primero.rol : null }
    }
  } catch {
    // Si falla la búsqueda, el usuario elige el cliente a mano.
  }
  return { cliente: null, rol: null }
}

/** Lo que sugirió la IA, para aprender de la corrección al guardar. */
export interface SugerenciaIA {
  productoSugeridoId: number | null
  textoProducto: string | null
  asegIdProducto: number | null
  clienteSugeridoId: number | null
  rolCliente: RolCliente | null
  asegIdCliente: number | null
}

export const sugerenciaVacia = (): SugerenciaIA => ({
  productoSugeridoId: null,
  textoProducto: null,
  asegIdProducto: null,
  clienteSugeridoId: null,
  rolCliente: null,
  asegIdCliente: null,
})

export interface CatalogosExtraccion {
  /** Solo activas. */
  aseguradoras: Aseguradora[]
  /** Solo activos. */
  ramos: Ramo[]
  /** Todos (activos e inactivos); el matching usa solo los activos. */
  productos: Producto[]
}

export interface ResultadoExtraccion {
  form: EstadoForm
  completados: number
  sugerencia: SugerenciaIA
}

const texto = (datos: Record<string, unknown>, k: string): string | null => {
  const v = datos[k]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** Número de la IA (viene como número; si llega como texto se interpreta). */
const numero = (datos: Record<string, unknown>, k: string): number | null => {
  const v = datos[k]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.trim())
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** "2026-03-05" (o con hora) → Date local de ese día. */
export function fechaISO(v: unknown): Date | null {
  if (typeof v !== 'string' || !v.trim()) return null
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v.trim())
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.getMonth() === Number(m[2]) - 1 ? d : null
}

/**
 * Aplica lo extraído al formulario. Cuenta los campos completados igual
 * que Flutter. Devuelve la sugerencia para el aprendizaje (se registra
 * solo después de guardar la póliza).
 */
export async function aplicarExtraccion(
  inicial: EstadoForm,
  datos: Record<string, unknown>,
  cat: CatalogosExtraccion,
  deps: DepsExtraccion,
): Promise<ResultadoExtraccion> {
  let f = { ...inicial }
  let completados = 0
  const sug = sugerenciaVacia()
  const productosActivos = cat.productos.filter((p) => p.estado_prod)

  const matchAseg = matchPorNombre(cat.aseguradoras, (a) => a.nombre_aseg, texto(datos, 'nombre_aseguradora'))

  const { cliente, rol } = await buscarClienteExtraido(
    [
      { rol: 'tomador', nombre: texto(datos, 'nombre_cliente'), doc: texto(datos, 'doc_cliente') },
      { rol: 'asegurado', nombre: texto(datos, 'nombre_asegurado'), doc: texto(datos, 'doc_asegurado') },
      { rol: 'beneficiario', nombre: texto(datos, 'nombre_beneficiario'), doc: texto(datos, 'doc_beneficiario') },
    ],
    deps,
  )
  if (cliente && rol && matchAseg) {
    sug.clienteSugeridoId = cliente.id
    sug.rolCliente = rol
    sug.asegIdCliente = matchAseg.id
  }

  const nro = texto(datos, 'nro_poliza')
  if (nro) {
    f.nro = nro
    completados++
  }

  if (matchAseg) {
    if (matchAseg.id !== f.asegId) {
      // Otra aseguradora: el ramo/producto de la anterior no le pertenecen.
      const lista = ramosDisponibles(cat.ramos, productosActivos, matchAseg.id)
      if (f.ramoId != null && !lista.some((r) => r.id === f.ramoId)) f.ramoId = null
      f.productoId = null
    }
    f.asegId = matchAseg.id
    completados++
  }

  if (cliente) {
    f.cliente = cliente
    completados++
  }

  const dIni = fechaISO(datos.fecha_inicio)
  if (dIni) {
    f.fIni = dIni
    completados++
  }
  const dFin = fechaISO(datos.fecha_fin)
  if (dFin) {
    f.fFin = dFin
    f.finAutomatica = false
    completados++
  } else if (dIni) {
    f = sugerirFin(f, dIni)
  }
  const dExp = fechaISO(datos.fecha_expedicion)
  if (dExp) {
    f.fExp = dExp
    completados++
  }

  const prima = numero(datos, 'prima')
  if (prima != null) {
    f = conPrima(f, prima)
    completados++
  }
  const vlrAseg = numero(datos, 'valor_asegurado')
  if (vlrAseg != null) {
    f.vlrAseg = vlrAseg
    completados++
  }
  const valorPoliza = numero(datos, 'valor_poliza')
  if (valorPoliza != null) {
    f.valorPoliza = valorPoliza
    completados++
  }
  const bien = texto(datos, 'bien_asegurado')
  if (bien) {
    f.bien = bien
    completados++
  }

  // Ramo y producto: primero el producto (suele venir más literal en el
  // documento) entre los de la aseguradora, y el ramo se deriva de él. Si
  // no hay producto, se intenta el ramo por nombre.
  if (f.asegId != null) {
    const asegId = f.asegId
    const candidatos = productosActivos.filter((p) => p.aseguradora_id === asegId)
    const textoProd = texto(datos, 'nombre_producto') ?? texto(datos, 'nombre_ramo') ?? ''
    const textoProdNorm = normalizarTextoIA(textoProd)

    // Aprendizaje: una corrección repetida (2 veces o más) se aplica directo.
    let aprendido: Producto | null = null
    if (textoProdNorm) {
      try {
        const id = await deps.buscarProductoAprendido(asegId, textoProdNorm)
        if (id != null) aprendido = candidatos.find((p) => p.id === id) ?? null
      } catch {
        /* sin aprendizaje esta vez */
      }
    }

    const matchProd =
      aprendido ??
      matchPorNombre(candidatos, (p) => p.nombre_prod, texto(datos, 'nombre_producto')) ??
      matchPorNombre(candidatos, (p) => p.nombre_prod, texto(datos, 'nombre_ramo'))

    // El texto se guarda aunque no haya coincidencia: si el usuario elige
    // el producto a mano, esa elección también se aprende.
    if (textoProdNorm) {
      sug.productoSugeridoId = matchProd?.id ?? null
      sug.textoProducto = textoProdNorm
      sug.asegIdProducto = asegId
    }

    if (matchProd) {
      const ramoDerivado = cat.ramos.find((r) => r.id === matchProd.ramo_id)
      if (ramoDerivado) {
        f.ramoId = ramoDerivado.id
        completados++
      }
      const disponibles = productosDisponibles(cat.productos, f.ramoId, asegId, matchProd.id)
      if (disponibles.some((p) => p.id === matchProd.id)) {
        f.productoId = matchProd.id
        f = aplicarDefaultsProducto(f, matchProd)
        completados++
      } else {
        f.productoId = null
      }
    } else {
      const matchRamo = matchPorNombre(cat.ramos, (r) => r.nombre_ramo, texto(datos, 'nombre_ramo'))
      if (matchRamo) {
        if (f.ramoId !== matchRamo.id) f.productoId = null
        f.ramoId = matchRamo.id
        completados++
        const disponibles = productosDisponibles(cat.productos, matchRamo.id, asegId, null)
        const matchProd2 = matchPorNombre(disponibles, (p) => p.nombre_prod, texto(datos, 'nombre_producto'))
        if (matchProd2) {
          f.productoId = matchProd2.id
          f = aplicarDefaultsProducto(f, matchProd2)
          completados++
        }
      }
    }
  }

  return { form: f, completados, sugerencia: sug }
}

/** Nombre y documento extraídos para el rol dado (sugerencia de cliente nuevo). */
export function clienteExtraidoPorRol(
  datos: Record<string, unknown>,
  rol: string | null,
): { nombre: string | null; doc: string | null } {
  switch (rol) {
    case 'asegurado':
      return { nombre: texto(datos, 'nombre_asegurado'), doc: texto(datos, 'doc_asegurado') }
    case 'beneficiario':
      return { nombre: texto(datos, 'nombre_beneficiario'), doc: texto(datos, 'doc_beneficiario') }
    default:
      return { nombre: texto(datos, 'nombre_cliente'), doc: texto(datos, 'doc_cliente') }
  }
}

/**
 * Qué aprender después de guardar con éxito:
 * - producto: el usuario dejó uno distinto al sugerido (o eligió uno cuando
 *   la IA no encontró ninguno) para ese texto de esa aseguradora;
 * - rol de cliente: el cliente confirmado es el que coincidió por un rol
 *   puntual y la aseguradora no cambió.
 */
export function aprendizajeAlGuardar(
  sug: SugerenciaIA,
  actual: { productoId: number | null; clienteId: number | null; asegId: number | null },
): {
  producto: { asegId: number; texto: string; productoId: number } | null
  rol: { asegId: number; rol: RolCliente } | null
} {
  const producto =
    sug.textoProducto != null &&
    sug.asegIdProducto != null &&
    actual.productoId != null &&
    actual.productoId !== sug.productoSugeridoId &&
    actual.asegId === sug.asegIdProducto
      ? { asegId: sug.asegIdProducto, texto: sug.textoProducto, productoId: actual.productoId }
      : null
  const rol =
    sug.clienteSugeridoId != null &&
    sug.rolCliente != null &&
    sug.asegIdCliente != null &&
    actual.clienteId === sug.clienteSugeridoId &&
    actual.asegId === sug.asegIdCliente
      ? { asegId: sug.asegIdCliente, rol: sug.rolCliente }
      : null
  return { producto, rol }
}
