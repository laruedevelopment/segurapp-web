import { mensajeError } from '@/lib/utils'

/**
 * Mensaje para el usuario: qué se intentaba hacer y por qué falló.
 * Misma firma que `mensajeAmigable(error, 'accion')` de la app (@/lib/errores);
 * cuando ese módulo esté en la rama principal basta con cambiar este import.
 */
export function mensajeAmigable(error: unknown, accion: string): string {
  const detalle = mensajeError(error).trim()
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(detalle)) {
    return `${accion}. Revise su conexión a internet e intente de nuevo.`
  }
  return detalle ? `${accion}. ${detalle}` : `${accion}.`
}
