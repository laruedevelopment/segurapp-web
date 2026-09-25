import { Buscador } from './buscador'

/**
 * Filtro por un valor de texto de una lista (Aseguradora, Ramo, Asesor…),
 * con búsqueda dentro de las opciones.
 */
export function FiltroOpciones({
  etiqueta,
  valor,
  opciones,
  onCambio,
  className = 'w-52',
}: {
  etiqueta: string
  valor: string | null
  opciones: string[]
  onCambio: (v: string | null) => void
  className?: string
}) {
  return (
    <Buscador<string>
      className={className}
      valor={valor}
      onCambio={onCambio}
      opciones={opciones}
      etiqueta={(s) => s}
      clave={(s) => s}
      placeholder={etiqueta}
    />
  )
}
