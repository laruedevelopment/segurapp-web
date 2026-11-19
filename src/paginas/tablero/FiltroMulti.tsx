import { useMemo, useState } from 'react'
import { Popover } from 'radix-ui'
import { ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const sinTildes = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const MAX_VISIBLES = 300

/**
 * Filtro de selección múltiple con buscador (como los filtros de Power BI): "Ramo: Todas",
 * "Ramo: 2 seleccionados". Muestra cuántas pólizas hay en cada opción con los demás filtros aplicados.
 */
export function FiltroMulti({
  etiqueta,
  opciones,
  seleccion,
  onCambio,
}: {
  etiqueta: string
  opciones: { nombre: string; n: number }[]
  seleccion: string[]
  onCambio: (v: string[]) => void
}) {
  const [q, setQ] = useState('')
  const marcadas = useMemo(() => new Set(seleccion), [seleccion])
  const filtradas = useMemo(() => {
    const t = sinTildes(q.trim())
    return t ? opciones.filter((o) => sinTildes(o.nombre).includes(t)) : opciones
  }, [opciones, q])
  const visibles = filtradas.slice(0, MAX_VISIBLES)
  const alternar = (n: string) => onCambio(marcadas.has(n) ? seleccion.filter((x) => x !== n) : [...seleccion, n])
  const activo = seleccion.length > 0
  const resumen = !activo ? 'Todas' : seleccion.length === 1 ? seleccion[0] : `${seleccion.length} seleccionadas`

  return (
    <Popover.Root onOpenChange={(a) => !a && setQ('')}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-9 min-w-0 max-w-[15rem] items-center gap-1.5 rounded-[10px] border px-2.5 text-left text-[13px] transition-colors hover:bg-muted',
            activo ? 'border-navy bg-navy-soft text-navy-dark' : 'border-line-strong bg-surface text-ink',
          )}
        >
          <span className="shrink-0 font-semibold">{etiqueta}:</span>
          <span className="min-w-0 flex-1 truncate">{resumen}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-50 w-72 rounded-xl border border-line bg-surface p-2 shadow-xl">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-soft" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Buscar ${etiqueta.toLowerCase()}…`}
              className="h-9 w-full rounded-[10px] border border-line-strong bg-surface pr-7 pl-8 text-[13px] focus:border-navy focus:outline-none"
            />
            {q && (
              <button type="button" aria-label="Borrar búsqueda" onClick={() => setQ('')} className="absolute top-1/2 right-2 -translate-y-1/2 text-ink-soft">
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="mb-1 flex items-center justify-between px-1 text-[12px]">
            <button
              type="button"
              className="font-semibold text-navy hover:underline"
              onClick={() => onCambio([...new Set([...seleccion, ...filtradas.map((o) => o.nombre)])])}
            >
              {q ? `Marcar las ${filtradas.length} encontradas` : 'Marcar todas'}
            </button>
            <button type="button" className="text-ink-soft hover:underline disabled:opacity-40" disabled={!activo} onClick={() => onCambio([])}>
              Quitar selección
            </button>
          </div>
          <ul className="max-h-64 overflow-y-auto">
            {visibles.map((o) => (
              <li key={o.nombre}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-[13px] hover:bg-muted">
                  <input type="checkbox" className="size-4 shrink-0 accent-navy" checked={marcadas.has(o.nombre)} onChange={() => alternar(o.nombre)} />
                  <span className="min-w-0 flex-1 truncate" title={o.nombre}>{o.nombre}</span>
                  <span className="num shrink-0 text-[11.5px] text-ink-soft">{o.n}</span>
                </label>
              </li>
            ))}
            {filtradas.length === 0 && <li className="px-2 py-3 text-center text-[13px] text-ink-soft">Sin resultados</li>}
            {filtradas.length > MAX_VISIBLES && (
              <li className="px-2 py-2 text-center text-[12px] text-ink-soft">Mostrando {MAX_VISIBLES} de {filtradas.length}: escriba para acotar.</li>
            )}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
