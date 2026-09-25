import { Navigate, createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { RequiereSesion } from '@/components/layout/guardas'
import { configurarAlVencer } from '@/lib/sesion'
import Inicio from '@/paginas/Inicio'
import Login from '@/paginas/Login'
import { rutasCatalogos } from '@/paginas/catalogos/rutas'
import { rutasComisiones } from '@/paginas/comisiones/rutas'
import { rutasPolizas } from '@/paginas/polizas/rutas'
import { rutasReportes } from '@/paginas/reportes/rutas'

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
            { path: '*', element: <Navigate to="/" replace /> },
          ],
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
)

// Al vencer la sesión (12 horas), de vuelta al login con un aviso.
configurarAlVencer(() => {
  router.navigate('/login', { replace: true, state: { mensaje: 'Su sesión venció. Inicie sesión de nuevo.' } })
})
