import { Hammer } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Vacio } from '@/components/ui/basicos'

/** Pantalla provisional mientras se migra el módulo desde la app Flutter. */
export default function EnConstruccion({ titulo }: { titulo: string }) {
  return (
    <>
      <EncabezadoPagina titulo={titulo} />
      <Contenido>
        <Vacio
          icono={<Hammer />}
          titulo="En construcción"
          detalle="Esta pantalla todavía se está pasando desde la versión actual de SegurApp. Mientras tanto, use la versión actual para esta tarea."
        />
      </Contenido>
    </>
  )
}
