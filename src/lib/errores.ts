/**
 * Texto para el usuario a partir de cualquier error: nunca muestra códigos ni
 * trazas. El detalle técnico queda en la consola para quien depure.
 *
 * [accion] es lo que se intentaba ("No se pudo guardar la póliza"); el
 * resultado es "<accion>. <causa y qué hacer>". Igual que `mensajeAmigable`
 * de la app de Flutter.
 */
export function mensajeAmigable(e: unknown, accion?: string): string {
  console.error(accion ? `Error (${accion}):` : 'Error:', e)
  const causa = causaDe(e)
  const a = (accion ?? '').trim().replace(/[.:]+$/, '')
  return a ? `${a}. ${causa}` : causa
}

function causaDe(e: unknown): string {
  const o = (typeof e === 'object' && e !== null ? e : {}) as { code?: unknown; message?: unknown; details?: unknown }
  const mensaje = typeof o.message === 'string' ? o.message.trim() : typeof e === 'string' ? e.trim() : ''
  const code = typeof o.code === 'string' ? o.code : ''

  if (code) {
    // Mensajes propios de las funciones de la base (raise exception ... P0001): ya vienen en español.
    if (code === 'P0001' && mensaje) return mensaje
    const msg = `${mensaje} ${typeof o.details === 'string' ? o.details : ''}`.toLowerCase()
    if (code === '23503' || msg.includes('foreign key')) {
      return (
        'Está en uso por otros registros (por ejemplo pólizas, incluso pólizas marcadas para eliminar ' +
        'que aún esperan autorización), así que no se puede eliminar o cambiar.'
      )
    }
    if (code === '23505' || msg.includes('duplicate key')) return 'Ya existe un registro con esos datos.'
    if (code === '23502') return 'Falta un dato obligatorio.'
    if (code === '42501' || msg.includes('row-level security')) return 'No tiene permiso para realizar esta acción.'
    if (code === 'PGRST301' || msg.includes('jwt')) return 'Su sesión venció. Cierre sesión e ingrese de nuevo.'
    if (code === '57014' || msg.includes('statement timeout')) return 'La consulta tardó demasiado. Intente de nuevo en un momento.'
    return 'No se pudo completar. Intente de nuevo; si sigue fallando, avise al administrador.'
  }

  const l = mensaje.toLowerCase()
  if (l.includes('failed to fetch') || l.includes('networkerror') || l.includes('network request failed') || l.includes('load failed')) {
    return 'Sin conexión a internet. Verifique su red e intente de nuevo.'
  }
  if (l.includes('timeout') || l.includes('tardó demasiado')) return 'La operación tardó demasiado. Intente de nuevo.'
  // Errores propios de la app (new Error('texto en español')): se muestran tal cual.
  if (mensaje) return mensaje
  return 'Ocurrió un error inesperado. Intente de nuevo.'
}
