import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Diferida } from '@/components/layout/guardas'

const Casos = lazy(() => import('./Casos'))

// Todos los usuarios con sesión ven la bandeja; la base oculta los casos de
// comisiones al Digitador (RLS) y la pantalla esconde los botones de pagos.
export const rutasCasos: RouteObject[] = [{ path: 'casos', element: <Diferida><Casos /></Diferida> }]
