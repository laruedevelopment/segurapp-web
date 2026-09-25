import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Diferida } from '@/components/layout/guardas'
import EnConstruccion from '@/paginas/EnConstruccion'

void lazy

export const rutasCatalogos: RouteObject[] = [
  { path: 'catalogos/*', element: <Diferida><EnConstruccion titulo="Catálogos" /></Diferida> },
]
