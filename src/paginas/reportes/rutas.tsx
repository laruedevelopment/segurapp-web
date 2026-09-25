import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Diferida } from '@/components/layout/guardas'

const Tablero = lazy(() => import('./Tablero'))

export const rutasReportes: RouteObject[] = [
  { path: 'reportes', element: <Diferida><Tablero /></Diferida> },
]
