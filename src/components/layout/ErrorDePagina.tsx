import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import { esErrorDeVersionNueva, recargarPorVersionNueva } from '@/lib/versionNueva'

/** Pantalla de error de las rutas: si es una versión nueva, recarga sola; si no, ofrece reintentar. */
export default function ErrorDePagina() {
  const error = useRouteError()
  const versionNueva = esErrorDeVersionNueva(error)
  useEffect(() => {
    if (versionNueva) recargarPorVersionNueva()
  }, [versionNueva])

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-ink">
        {versionNueva ? 'Hay una versión nueva de la aplicación' : 'Algo salió mal en esta pantalla'}
      </h1>
      <p className="mt-2 text-ink-soft">
        {versionNueva
          ? 'Recargue la página para continuar. Sus datos guardados no se pierden.'
          : 'Puede volver a intentarlo. Si sigue pasando, avise al administrador.'}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 inline-flex h-10 items-center rounded-[10px] bg-navy px-4 font-semibold text-white hover:bg-navy-dark"
      >
        Recargar
      </button>
    </div>
  )
}
