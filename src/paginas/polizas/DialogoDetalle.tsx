import type { ReactNode } from 'react'
import { Boton } from '@/components/ui/button'
import { Dialogo } from '@/components/ui/dialogo'
import { entradasDetalle } from './detalleLogica'

/** Detalle de solo lectura: todos los datos de una póliza, uno por línea con su etiqueta. */
export function DialogoDetalle({
  titulo,
  datos,
  encabezado,
  onCerrar,
}: {
  titulo: ReactNode
  datos: Record<string, unknown>
  /** Contenido opcional encima de los datos (estado, motivo, etc.). */
  encabezado?: ReactNode
  onCerrar: () => void
}) {
  const entradas = entradasDetalle(datos)
  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={titulo}
      ancho="lg"
      pie={
        <Boton autoFocus onClick={onCerrar}>
          Cerrar
        </Boton>
      }
    >
      {encabezado}
      {entradas.length === 0 ? (
        <p className="text-ink-soft">Esta póliza todavía no tiene datos.</p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {entradas.map((e) => (
            <div key={e.clave} className="min-w-0">
              <dt className="text-[11px] text-ink-soft">{e.etiqueta}</dt>
              <dd className="text-[13px] font-semibold break-words whitespace-pre-line">{e.valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </Dialogo>
  )
}
