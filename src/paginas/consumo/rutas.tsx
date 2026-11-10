import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Diferida, SoloRol } from '@/components/layout/guardas'

const Consumo = lazy(() => import('./Consumo'))

// Solo el Administrador; la base también lo exige en cada función.
export const rutasConsumo: RouteObject[] = [
  {
    path: 'consumo',
    element: (
      <SoloRol rol="admin">
        <Diferida>
          <Consumo />
        </Diferida>
      </SoloRol>
    ),
  },
]
