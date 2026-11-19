import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Diferida, SoloRol } from '@/components/layout/guardas'
import { ES_PRUEBAS } from '@/lib/supabase'

const Tablero = lazy(() => import('./Tablero'))

// Solo el Administrador y, por ahora, solo en la copia de pruebas.
export const rutasTablero: RouteObject[] = ES_PRUEBAS
  ? [
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
  : []
