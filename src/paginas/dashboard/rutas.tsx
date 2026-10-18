import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Diferida, SoloRol } from '@/components/layout/guardas'

const Dashboard = lazy(() => import('./Dashboard'))

// Solo el Administrador (rol A). La base de datos también lo exige para las metas.
export const rutasDashboard: RouteObject[] = [
  {
    path: 'dashboard',
    element: (
      <SoloRol rol="admin">
        <Diferida>
          <Dashboard />
        </Diferida>
      </SoloRol>
    ),
  },
]
