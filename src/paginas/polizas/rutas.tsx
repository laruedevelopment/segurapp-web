import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Diferida } from '@/components/layout/guardas'
import EnConstruccion from '@/paginas/EnConstruccion'

const Lista = lazy(() => import('./Lista'))

export const rutasPolizas: RouteObject[] = [
  { path: 'polizas', element: <Diferida><Lista /></Diferida> },
  { path: 'polizas/nueva', element: <EnConstruccion titulo="Nueva póliza" /> },
  { path: 'polizas/pendientes', element: <EnConstruccion titulo="Pólizas pendientes" /> },
  { path: 'polizas/carga-masiva', element: <EnConstruccion titulo="Carga masiva de pólizas" /> },
  { path: 'polizas/duplicadas', element: <EnConstruccion titulo="Pólizas con número repetido" /> },
  { path: 'polizas/:id', element: <EnConstruccion titulo="Editar póliza" /> },
  { path: 'polizas/:id/pagos', element: <EnConstruccion titulo="Pagos de la póliza" /> },
]
