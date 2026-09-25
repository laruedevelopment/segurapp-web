import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Diferida, SoloRol } from '@/components/layout/guardas'

const ListaReportes = lazy(() => import('./ListaReportes'))
const FormularioReporte = lazy(() => import('./FormularioReporte'))
const EstadoCuenta = lazy(() => import('./EstadoCuenta'))

const soloComisiones = (el: React.ReactNode) => (
  <SoloRol rol="comisiones">
    <Diferida>{el}</Diferida>
  </SoloRol>
)

export const rutasComisiones: RouteObject[] = [
  { path: 'comisiones', element: soloComisiones(<ListaReportes />) },
  { path: 'comisiones/nuevo', element: soloComisiones(<FormularioReporte />) },
  { path: 'comisiones/:id', element: soloComisiones(<FormularioReporte />) },
  { path: 'comisiones/:id/estado-cuenta', element: soloComisiones(<EstadoCuenta />) },
]
