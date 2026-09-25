import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Popover } from 'radix-ui'
import { Check, ChevronDown, Loader2, Search, X } from 'lucide-react'
import { normalizarTexto } from '@/lib/filtros'
import { cn } from '@/lib/utils'
import { claseCampo } from './campos'

interface BaseProps<T> {
  /** Opción elegida (el objeto completo, para poder mostrarla aunque no esté en la lista). */
  valor: T | null | undefined
  onCambio: (v: T | null) => void
  etiqueta: (o: T) => string
  /** Texto secundario bajo la etiqueta (documento, aseguradora…). */
  detalle?: (o: T) => ReactNode
  clave: (o: T) => string | number
  placeholder?: string
  disabled?: boolean
  /** Muestra la X para dejar el campo vacío. */
  permitirVacio?: boolean
  className?: string
  /** Marca visual de opción inactiva. */
  inactivo?: (o: T) => boolean
  error?: boolean
}

type Props<T> = BaseProps<T> &
  (
    | { opciones: T[]; buscar?: undefined }
    | { opciones?: undefined; buscar: (texto: string) => Promise<T[]> }
  )

const MAX_VISIBLES = 200

/**
 * Selector con búsqueda. Con `opciones` filtra en el navegador (catálogos
 * chicos); con `buscar` consulta al servidor mientras se escribe (clientes).
 */
export function Buscador<T>(props: Props<T>) {
  const { valor, onCambio, etiqueta, detalle, clave, placeholder = 'Seleccione…', disabled, permitirVacio = true, className, inactivo, error } = props
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [remotas, setRemotas] = useState<T[]>([])
  const [buscando, setBuscando] = useState(false)
  /** Texto con el que se obtuvieron los resultados que están en pantalla. */
  const [textoResultados, setTextoResultados] = useState<string | null>(null)
  const [errorBusqueda, setErrorBusqueda] = useState(false)
  const [activo, setActivo] = useState(0)
  const listaRef = useRef<HTMLDivElement>(null)

  // Búsqueda en el servidor con espera de 250 ms entre teclas.
  useEffect(() => {
    if (!props.buscar || !abierto) return
    let vigente = true
    setBuscando(true)
    setErrorBusqueda(false)
    const t = setTimeout(async () => {
      try {
        const r = await props.buscar!(texto)
        if (vigente) {
          setRemotas(r)
          setTextoResultados(texto)
        }
      } catch {
        if (vigente) {
          setRemotas([])
          setTextoResultados(texto)
          setErrorBusqueda(true)
        }
      } finally {
        if (vigente) setBuscando(false)
      }
    }, 250)
    return () => {
      vigente = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, abierto])

  const filtradas = useMemo(() => {
    if (props.buscar) return remotas
    const q = normalizarTexto(texto)
    const todas = props.opciones ?? []
    if (!q) return todas.slice(0, MAX_VISIBLES)
    const palabras = q.split(' ')
    return todas
      .filter((o) => {
        const t = normalizarTexto(etiqueta(o))
        return palabras.every((p) => t.includes(p))
      })
      .slice(0, MAX_VISIBLES)
  }, [props.opciones, props.buscar, remotas, texto, etiqueta])

  useEffect(() => setActivo(0), [texto, abierto])

  const elegir = (o: T | null) => {
    onCambio(o)
    setAbierto(false)
    setTexto('')
  }

  const onTecla = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActivo((a) => Math.min(a + 1, filtradas.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActivo((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // Mientras llega la búsqueda de lo recién digitado, la lista en pantalla
      // es la de la búsqueda anterior: Enter no debe elegir de ahí.
      if (props.buscar && (buscando || textoResultados !== texto)) return
      if (filtradas[activo]) elegir(filtradas[activo])
    }
  }

  useEffect(() => {
    listaRef.current?.querySelector(`[data-idx="${activo}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activo])

  const claveValor = valor != null ? clave(valor) : null

  return (
    <Popover.Root open={abierto} onOpenChange={setAbierto}>
      <div className={cn('relative', className)}>
        <Popover.Trigger asChild disabled={disabled}>
          <button
            type="button"
            className={cn(
              claseCampo,
              'flex items-center gap-2 pr-16 text-left',
              !valor && 'text-ink-soft/80',
              error && 'border-danger',
            )}
          >
            <span className="min-w-0 flex-1 truncate">{valor != null ? etiqueta(valor) : placeholder}</span>
          </button>
        </Popover.Trigger>
        <div className="pointer-events-none absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-0.5">
          {permitirVacio && valor != null && !disabled && (
            <button
              type="button"
              aria-label="Quitar"
              className="pointer-events-auto rounded p-1 text-ink-soft hover:bg-muted hover:text-ink"
              onClick={() => onCambio(null)}
            >
              <X className="size-3.5" />
            </button>
          )}
          <ChevronDown className="size-4 text-ink-soft" />
        </div>
      </div>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-72 rounded-xl border border-line bg-surface shadow-lg"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            ;(e.currentTarget as HTMLElement).querySelector('input')?.focus()
          }}
        >
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search className="size-4 text-ink-soft" />
            <input
              className="h-10 flex-1 bg-transparent outline-none"
              placeholder="Buscar…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={onTecla}
            />
            {buscando && <Loader2 className="size-4 animate-spin text-ink-soft" />}
          </div>
          <div ref={listaRef} className="max-h-72 overflow-y-auto p-1" role="listbox">
            {filtradas.length === 0 && !buscando && (
              <div className="px-3 py-6 text-center text-[13px] text-ink-soft">
                {errorBusqueda ? 'No se pudo buscar. Revise su conexión e intente de nuevo.' : 'Sin resultados'}
              </div>
            )}
            {filtradas.map((o, i) => {
              const k = clave(o)
              const elegida = k === claveValor
              return (
                <button
                  key={k}
                  type="button"
                  data-idx={i}
                  role="option"
                  aria-selected={elegida}
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => elegir(o)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left',
                    i === activo && 'bg-muted',
                    inactivo?.(o) && 'opacity-60',
                  )}
                >
                  <Check className={cn('mt-0.5 size-4 shrink-0 text-green', !elegida && 'invisible')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {etiqueta(o)}
                      {inactivo?.(o) && <span className="ml-1 text-[11px] text-ink-soft">(inactivo)</span>}
                    </span>
                    {detalle && <span className="block truncate text-[12px] text-ink-soft">{detalle(o)}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
