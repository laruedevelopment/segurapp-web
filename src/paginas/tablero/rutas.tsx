import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Diferida, SoloRol } from '@/components/layout/guardas'

const Tablero = lazy(() => import('./Tablero'))

// Solo el Administrador (la pantalla solo lee las pólizas, igual que Reportes).
export const rutasTablero: RouteObject[] = [
  {
    path: 'tablero',
    element: (
      <SoloRol rol="admin">
        <Diferida>
          <Tablero />
        </Diferida>
      </SoloRol>
    ),
  },
]
