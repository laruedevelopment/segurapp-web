import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Diferida, SoloRol } from '@/components/layout/guardas'

const Catalogos = lazy(() => import('./Catalogos'))
const Clientes = lazy(() => import('./Clientes'))
const ClientesDuplicados = lazy(() => import('./ClientesDuplicados'))
const PolizasCliente = lazy(() => import('./PolizasCliente'))
const Aseguradoras = lazy(() => import('./Aseguradoras'))
const Ramos = lazy(() => import('./Ramos'))
const Productos = lazy(() => import('./Productos'))
const Asesores = lazy(() => import('./Asesores'))
const FormasPago = lazy(() => import('./FormasPago'))
const FormasExpedicion = lazy(() => import('./FormasExpedicion'))
const Usuarios = lazy(() => import('./Usuarios'))

// Clientes, Aseguradoras, Ramos y Productos: todos los usuarios.
// Asesores, Formas de pago, Formas de expedición y Usuarios: solo administrador.
export const rutasCatalogos: RouteObject[] = [
  { path: 'catalogos', element: <Diferida><Catalogos /></Diferida> },
  { path: 'catalogos/clientes', element: <Diferida><Clientes /></Diferida> },
  { path: 'catalogos/clientes/duplicados', element: <Diferida><ClientesDuplicados /></Diferida> },
  { path: 'catalogos/clientes/:id/polizas', element: <Diferida><PolizasCliente /></Diferida> },
  { path: 'catalogos/aseguradoras', element: <Diferida><Aseguradoras /></Diferida> },
  { path: 'catalogos/ramos', element: <Diferida><Ramos /></Diferida> },
  { path: 'catalogos/productos', element: <Diferida><Productos /></Diferida> },
  { path: 'catalogos/asesores', element: <SoloRol rol="admin"><Diferida><Asesores /></Diferida></SoloRol> },
  { path: 'catalogos/formas-pago', element: <SoloRol rol="admin"><Diferida><FormasPago /></Diferida></SoloRol> },
  { path: 'catalogos/formas-expedicion', element: <SoloRol rol="admin"><Diferida><FormasExpedicion /></Diferida></SoloRol> },
  { path: 'catalogos/usuarios', element: <SoloRol rol="admin"><Diferida><Usuarios /></Diferida></SoloRol> },
]
