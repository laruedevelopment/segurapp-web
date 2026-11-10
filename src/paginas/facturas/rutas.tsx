import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Diferida, SoloRol } from '@/components/layout/guardas'

const ListaFacturas = lazy(() => import('./ListaFacturas'))
const FormularioFactura = lazy(() => import('./FormularioFactura'))
const AjustesFacturas = lazy(() => import('./Ajustes'))

const conComisiones = (el: React.ReactNode) => (
  <SoloRol rol="comisiones">
    <Diferida>{el}</Diferida>
  </SoloRol>
)

// Las facturas las ven y crean A, S y Digitador; los ajustes también (la base lo exige igual).
export const rutasFacturas: RouteObject[] = [
  { path: 'facturas', element: conComisiones(<ListaFacturas />) },
  {
    path: 'facturas/ajustes',
    element: (
      <SoloRol rol="comisiones">
        <Diferida>
          <AjustesFacturas />
        </Diferida>
      </SoloRol>
    ),
  },
  { path: 'facturas/:id', element: conComisiones(<FormularioFactura />) },
]
