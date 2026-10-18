/// Texto para el usuario a partir de cualquier error: nunca muestra
/// "PostgrestError" ni trazas. El detalle técnico queda en la consola.
/// Equivale a mensajeAmigable de la app de Flutter (lib/utils/mensajes_error.dart).
///
/// `accion` es lo que se intentaba ("No se pudo guardar la póliza"); el resultado
/// es "<accion>. <causa y qué hacer>".

interface ErrorConCodigo {
  code?: string
  message?: string
  details?: string | null
  status?: number
}

export function mensajeAmigable(error: unknown, accion?: string): string {
  console.error(accion ? `Error (${accion}):` : 'Error:', error)
  const causa = causaDe(error)
  if (!accion || !accion.trim()) return causa
  const a = accion.trim().replace(/[.:]+$/, '')
  return `${a}. ${causa}`
}

/** Igual que mensajeAmigable pero sin escribir en la consola: para usar al pintar (render). */
export function causaAmigable(error: unknown, accion?: string): string {
  const causa = causaDe(error)
  if (!accion || !accion.trim()) return causa
  return `${accion.trim().replace(/[.:]+$/, '')}. ${causa}`
}

function causaDe(error: unknown): string {
  const e = (typeof error === 'object' && error !== null ? error : {}) as ErrorConCodigo
  const texto = typeof error === 'string' ? error : (e.message ?? '')
  const bajo = `${texto} ${e.details ?? ''}`.toLowerCase()
  const code = e.code ?? ''

  // Mensajes propios de las funciones de la base (raise exception ... P0001):
  // ya vienen en español y dicen qué pasó.
  if (code === 'P0001' && texto.trim()) return texto.trim()

  if (code === '23503' || bajo.includes('foreign key')) {
    return 'Está en uso por otros registros (por ejemplo pólizas), así que no se puede eliminar o cambiar. Si acaba de marcar pólizas para eliminar, espere a que un administrador las resuelva.'
  }
  if (code === '23505' || bajo.includes('duplicate key')) return 'Ya existe un registro con esos datos.'
  if (code === '23502') return 'Falta un dato obligatorio.'
  if (code === '42501' || bajo.includes('row-level security') || bajo.includes('permission denied')) {
    return 'No tiene permiso para realizar esta acción.'
  }
  if (code === 'PGRST301' || bajo.includes('jwt')) return 'Su sesión venció. Cierre sesión e ingrese de nuevo.'
  if (code === '57014' || bajo.includes('statement timeout') || bajo.includes('canceling statement')) {
    return 'La consulta tardó demasiado. Intente de nuevo en un momento.'
  }
  if (
    bajo.includes('failed to fetch') ||
    bajo.includes('networkerror') ||
    bajo.includes('network request failed') ||
    bajo.includes('load failed') ||
    bajo.includes('failed host')
  ) {
    return 'Sin conexión a internet. Verifique su red e intente de nuevo.'
  }
  if (bajo.includes('timeout') || bajo.includes('tardó demasiado') || (error instanceof DOMException && error.name === 'TimeoutError')) {
    return 'La operación tardó demasiado. Intente de nuevo.'
  }
  // Errores propios de la app (new Error('texto en español')): se muestran tal cual.
  if (error instanceof Error && texto.trim()) return texto.trim()
  if (typeof error === 'string' && texto.trim()) return texto.trim()
  return 'Ocurrió un error inesperado. Intente de nuevo.'
}
