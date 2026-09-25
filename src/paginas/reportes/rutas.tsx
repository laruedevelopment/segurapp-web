import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Diferida } from '@/components/layout/guardas'
import EnConstruccion from '@/paginas/EnConstruccion'

void lazy

export const rutasReportes: RouteObject[] = [
  { path: 'reportes', element: <Diferida><EnConstruccion titulo="Reportes" /></Diferida> },
]
