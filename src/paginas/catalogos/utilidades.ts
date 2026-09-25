// Funciones puras de los formularios de catálogos (con pruebas en
// utilidades.test.ts).

/** Espacios repetidos a uno solo y sin espacios a los lados. */
export const limpiar = (v: string | null | undefined) => (v ?? '').replace(/\s+/g, ' ').trim()

/** Texto limpio, o null si queda vacío (para columnas opcionales). */
export const oNull = (v: string | null | undefined) => limpiar(v) || null

/** Correo con forma válida (algo@algo.algo). Vacío cuenta como válido. */
export const correoValido = (v: string) => {
  const s = v.trim()
  return !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

/** Tipos de documento de la app (los mismos de Flutter). */
export const TIPOS_DOC = ['CC', 'CE', 'NIT', 'PAS', 'OTRO'] as const

/**
 * CC y NIT (o sin tipo) son solo números; pasaporte, cédula de extranjería
 * y otros aceptan letras.
 */
export const docEsNumerico = (tipo: string | null | undefined) => {
  const t = (tipo ?? '').trim().toUpperCase()
  return !t || t === 'CC' || t === 'NIT'
}

/**
 * Documento mientras se escribe. Numérico: solo dígitos (y el guion del
 * dígito de verificación del NIT) con puntos de miles. Con letras: letras,
 * dígitos y guion, en mayúscula.
 */
export function formatearDoc(texto: string, numerico: boolean): string {
  if (!numerico) return texto.toUpperCase().replace(/[^0-9A-Z-]/g, '')
  const limpio = texto.replace(/[^0-9-]/g, '')
  if (!limpio) return ''
  const guion = limpio.indexOf('-')
  const numero = guion === -1 ? limpio : limpio.slice(0, guion)
  const sufijo = guion === -1 ? '' : limpio.slice(guion)
  let out = ''
  for (let i = 0; i < numero.length; i++) {
    if (i > 0 && (numero.length - i) % 3 === 0) out += '.'
    out += numero[i]
  }
  return out + sufijo
}

/** El documento se guarda sin puntos (los puntos son solo para leerlo). */
export const docParaGuardar = (texto: string) => oNull(texto.replace(/\./g, '').replace(/\s/g, ''))

/** NIT de aseguradora: sin espacios, puntos ni guiones. Null si queda vacío. */
export const nitLimpio = (v: string) => {
  const t = v.replace(/[\s.-]/g, '')
  return t || null
}

/** Porcentaje entre 0 y 100 (null = vacío, se acepta). */
export const porcentajeValido = (n: number | null | undefined) => n == null || (n >= 0 && n <= 100)

/** Etiqueta del rol de un usuario. */
export const etiquetaRol = (rol: string | null | undefined) => {
  switch ((rol ?? '').toUpperCase()) {
    case 'A':
      return 'Administrador'
    case 'D':
      return 'Digitador'
    case 'S':
      return 'Comisiones'
    default:
      return rol ?? ''
  }
}
