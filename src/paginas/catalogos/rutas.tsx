import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Diferida } from '@/components/layout/guardas'

const Catalogos = lazy(() => import('./Catalogos'))

// El módulo de catálogos completa estas rutas (clientes, aseguradoras, …).
export const rutasCatalogos: RouteObject[] = [
  { path: 'catalogos', element: <Diferida><Catalogos /></Diferida> },
]
