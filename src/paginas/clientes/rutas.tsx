import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Diferida } from '@/components/layout/guardas'
import { ES_PRUEBAS } from '@/lib/supabase'

const Cliente360 = lazy(() => import('./Cliente360'))

// Ficha 360° del cliente (CRM): solo en la copia de pruebas hasta su aprobación.
export const rutasClientes: RouteObject[] = ES_PRUEBAS
  ? [{ path: 'clientes/:id', element: <Diferida><Cliente360 /></Diferida> }]
  : []
