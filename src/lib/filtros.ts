// Helpers para armar filtros `.or(...)` de PostgREST con texto que escribe el
// usuario. Sin comillas, una coma o un paréntesis en la búsqueda
// ("PEREZ, JUAN", "ACME (EN LIQUIDACION)") rompe la sintaxis del filtro.

/** Valor entre comillas dobles, con `"` y `\` escapados. */
export const valorFiltro = (v: string) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

/** `columna ILIKE '%texto%'` listo para usar dentro de `.or(...)`. */
export const ilikeContiene = (columna: string, texto: string) =>
  `${columna}.ilike.${valorFiltro(`%${texto}%`)}`

/** Solo letras y dígitos en mayúscula — igual que doc_cliente_norm / nro_poliza_norm. */
export const normalizarAlfanumerico = (s: string) => s.replace(/[^0-9A-Za-z]/g, '').toUpperCase()

/** Para comparar texto literal con ilike: % y _ dejan de ser comodines. */
export const escaparLike = (s: string) => s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')

/** Texto sin tildes, en mayúscula y con espacios simples (para comparar nombres). */
export const normalizarTexto = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
