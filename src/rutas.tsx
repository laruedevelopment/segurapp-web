import { Link, createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { RequiereSesion } from '@/components/layout/guardas'
import { configurarAlVencer } from '@/lib/sesion'
import Inicio from '@/paginas/Inicio'
import Login from '@/paginas/Login'
import { rutasCasos } from '@/paginas/casos/rutas'
import { rutasCatalogos } from '@/paginas/catalogos/rutas'
import { rutasComisiones } from '@/paginas/comisiones/rutas'
import { rutasDashboard } from '@/paginas/dashboard/rutas'
import { rutasPolizas } from '@/paginas/polizas/rutas'
import { rutasReportes } from '@/paginas/reportes/rutas'

function NoEncontrada() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-ink">Esta página no existe</h1>
      <p className="mt-2 text-ink-soft">La dirección puede estar mal escrita o ya no estar disponible.</p>
      <Link to="/" className="mt-6 inline-block font-medium text-navy underline">
        Volver al inicio
      </Link>
    </div>
  )
}

export const router = createBrowserRouter(
  [
    { path: '/login', element: <Login /> },
    {
      element: <RequiereSesion />,
      children: [
        {
          element: <AppShell />,
          children: [
            { index: true, element: <Inicio /> },
            ...rutasPolizas,
            ...rutasCatalogos,
            ...rutasReportes,
            ...rutasComisiones,
            ...rutasCasos,
            ...rutasDashboard,
            { path: '*', element: <NoEncontrada /> },
          ],
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
)

// Al vencer la sesión (12 horas), de vuelta al login con un aviso.
configurarAlVencer((mensaje) => {
  router.navigate('/login', { replace: true, state: { mensaje: mensaje ?? 'Su sesión venció. Inicie sesión de nuevo.' } })
})
