import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Diferida } from '@/components/layout/guardas'

const Lista = lazy(() => import('./Lista'))
const Formulario = lazy(() => import('./Formulario'))
const Pendientes = lazy(() => import('./Pendientes'))
const CargaMasiva = lazy(() => import('./CargaMasiva'))
const Duplicadas = lazy(() => import('./Duplicadas'))
// El estado de cuenta de una póliza lo hace el módulo de comisiones.
const EstadoCuenta = lazy(() => import('@/paginas/comisiones/EstadoCuenta'))

export const rutasPolizas: RouteObject[] = [
  { path: 'polizas', element: <Diferida><Lista /></Diferida> },
  // ?pendiente=ID abre un borrador o una póliza de la carga masiva para terminarla.
  { path: 'polizas/nueva', element: <Diferida><Formulario /></Diferida> },
  { path: 'polizas/pendientes', element: <Diferida><Pendientes /></Diferida> },
  { path: 'polizas/carga-masiva', element: <Diferida><CargaMasiva /></Diferida> },
  { path: 'polizas/duplicadas', element: <Diferida><Duplicadas /></Diferida> },
  { path: 'polizas/:id', element: <Diferida><Formulario /></Diferida> },
  { path: 'polizas/:id/pagos', element: <Diferida><EstadoCuenta /></Diferida> },
]
