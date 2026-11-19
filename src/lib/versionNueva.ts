// Cuando se publica una versión nueva, los archivos de la anterior desaparecen del servidor.
// Quien tenía la app abierta falla al abrir una pantalla ("Failed to fetch dynamically imported
// module"). La solución es recargar la página para traer la versión nueva: aquí se hace sola, y
// una sola vez por minuto para no entrar en un ciclo si el problema fuera otro.

const CLAVE = 'segurapp.recarga-version'

/** ¿El error es de un archivo de la app que ya no existe (versión nueva publicada)? */
export function esErrorDeVersionNueva(e: unknown): boolean {
  const m = String((e as { message?: unknown } | null)?.message ?? e ?? '')
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(m)
}

/** Recarga la página si no se hizo hace menos de un minuto. Devuelve true si la recargó. */
export function recargarPorVersionNueva(ahora = Date.now()): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE) ?? 0)
    if (ahora - ultima < 60_000) return false
    sessionStorage.setItem(CLAVE, String(ahora))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

/** Engancha el aviso de Vite para archivos que no cargan. */
export function vigilarVersionNueva() {
  window.addEventListener('vite:preloadError', (ev) => {
    ev.preventDefault()
    recargarPorVersionNueva()
  })
}
