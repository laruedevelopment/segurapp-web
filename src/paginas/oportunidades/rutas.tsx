import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Diferida } from '@/components/layout/guardas'

const Oportunidades = lazy(() => import('./Oportunidades'))

export const rutasOportunidades: RouteObject[] = [{ path: 'oportunidades', element: <Diferida><Oportunidades /></Diferida> }]
