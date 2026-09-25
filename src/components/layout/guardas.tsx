import { Suspense, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { Cargando } from '@/components/ui/basicos'
import { esAdmin, useSesion, veComisiones } from '@/lib/sesion'

/** Sin sesión → al login, recordando a dónde quería ir. */
export function RequiereSesion() {
  const sesion = useSesion()
  const location = useLocation()
  if (!sesion) return <Navigate to="/login" replace state={{ desde: location.pathname }} />
  return <Outlet />
}

/** Pantallas solo para ciertos roles (la base de datos también lo impide). */
export function SoloRol({ rol, children }: { rol: 'admin' | 'comisiones'; children: ReactNode }) {
  const sesion = useSesion()
  const ok = rol === 'admin' ? esAdmin(sesion?.usuario) : veComisiones(sesion?.usuario)
  if (!ok) return <Navigate to="/" replace />
  return <>{children}</>
}

/** Envuelve las páginas cargadas bajo demanda (React.lazy). */
export function Diferida({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Cargando />}>{children}</Suspense>
}
