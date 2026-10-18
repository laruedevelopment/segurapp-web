// Municipio a partir de un texto escrito (réplica de lib/utils/municipios.dart).

/**
 * Minúsculas, sin tildes, sin signos de puntuación y con un solo espacio
 * entre palabras: "Bogotá, D.C." y "bogota d c" dan lo mismo.
 */
export function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Mensaje cuando el texto no identifica un único municipio. */
export const MENSAJE_ELEGIR_MUNICIPIO = 'Elija el municipio de la lista (puede haber varios con ese nombre).'

/**
 * Municipio que corresponde al texto escrito, o null.
 *
 * Solo asigna cuando no hay duda: coincidencia exacta única (sin tildes ni
 * mayúsculas) o, si no hay exacta, un único municipio que empiece por el
 * texto. Si hay varios con el mismo nombre (por ejemplo "Santa Rosa" en
 * distintos departamentos) devuelve null para obligar a elegir de la lista.
 */
export function resolverMunicipio<T extends { nombre_munic: string }>(municipios: T[], texto: string): T | null {
  const q = normalizarTexto(texto)
  if (!q) return null
  const exactos = municipios.filter((m) => normalizarTexto(m.nombre_munic) === q)
  if (exactos.length === 1) return exactos[0]
  if (exactos.length > 1) return null
  const empieza = municipios.filter((m) => normalizarTexto(m.nombre_munic).startsWith(q))
  return empieza.length === 1 ? empieza[0] : null
}
