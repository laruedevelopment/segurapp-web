import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Diferida, SoloRol } from '@/components/layout/guardas'
import EnConstruccion from '@/paginas/EnConstruccion'

void lazy

export const rutasComisiones: RouteObject[] = [
  {
    path: 'comisiones/*',
    element: (
      <SoloRol rol="comisiones">
        <Diferida><EnConstruccion titulo="Reportes de Comisiones" /></Diferida>
      </SoloRol>
    ),
  },
]
