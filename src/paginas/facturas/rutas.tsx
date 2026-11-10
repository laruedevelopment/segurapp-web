import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Navigate } from 'react-router'
import { Diferida, SoloRol } from '@/components/layout/guardas'
import { ES_PRUEBAS } from '@/lib/supabase'

const ListaFacturas = lazy(() => import('./ListaFacturas'))
const FormularioFactura = lazy(() => import('./FormularioFactura'))
const AjustesFacturas = lazy(() => import('./Ajustes'))

const conComisiones = (el: React.ReactNode) =>
  !ES_PRUEBAS ? <Navigate to="/" replace /> : (
  <SoloRol rol="comisiones">
    <Diferida>{el}</Diferida>
  </SoloRol>
  )

// Por ahora solo en el entorno de pruebas. Las facturas las ven y crean A, S y Digitador; los ajustes solo el Administrador
// (la base también lo exige).
export const rutasFacturas: RouteObject[] = [
  { path: 'facturas', element: conComisiones(<ListaFacturas />) },
  {
    path: 'facturas/ajustes',
    element: !ES_PRUEBAS ? (
      <Navigate to="/" replace />
    ) : (
      <SoloRol rol="admin">
        <Diferida>
          <AjustesFacturas />
        </Diferida>
      </SoloRol>
    ),
  },
  { path: 'facturas/:id', element: conComisiones(<FormularioFactura />) },
]
