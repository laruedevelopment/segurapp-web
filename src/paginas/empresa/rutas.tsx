import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Diferida, SoloRol } from '@/components/layout/guardas'
import { ES_PRUEBAS } from '@/lib/supabase'

const Empresa = lazy(() => import('./Empresa'))

// Solo el Administrador y, por ahora, solo en la copia de pruebas (la migración config_empresa solo está allá).
export const rutasEmpresa: RouteObject[] = ES_PRUEBAS
  ? [{ path: 'empresa', element: <SoloRol rol="admin"><Diferida><Empresa /></Diferida></SoloRol> }]
  : []
