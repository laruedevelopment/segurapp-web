import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Columna<T> {
  id: string
  titulo: ReactNode
  /** Ancho en px (fijo) — la tabla hace scroll horizontal si no cabe. */
  ancho: number
  alinear?: 'izq' | 'der' | 'centro'
  celda: (fila: T) => ReactNode
  /** Valor para ordenar. Sin esto la columna no se puede ordenar. */
  ordenar?: (fila: T) => string | number | null | undefined
  /** Texto al pasar el mouse (por defecto ninguno). */
  titleDe?: (fila: T) => string | undefined
}

export interface Orden {
  columna: string
  asc: boolean
}

const MIN_ANCHO = 50
const PREFIJO_ANCHOS = 'segurapp.anchos.'

function leerAnchos(clave?: string): Record<string, number> {
  if (!clave) return {}
  try {
    const v = JSON.parse(localStorage.getItem(PREFIJO_ANCHOS + clave) ?? '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

function guardarAnchos(clave: string | undefined, anchos: Record<string, number>) {
  if (!clave) return
  try {
    localStorage.setItem(PREFIJO_ANCHOS + clave, JSON.stringify(anchos))
  } catch {
    /* sin almacenamiento: vale solo para esta sesión */
  }
}

const cmp = (a: unknown, b: unknown) => {
  if (a == null || a === '') return b == null || b === '' ? 0 : 1
  if (b == null || b === '') return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'es', { sensitivity: 'base', numeric: true })
}

/**
 * Tabla con scroll virtual: solo dibuja las filas visibles, así 33 mil
 * pólizas se mueven sin trabarse. El texto se puede seleccionar y copiar.
 */
export function Tabla<T>({
  filas,
  columnas,
  clave,
  alHacerClic,
  ordenInicial,
  altoFila = 48,
  className,
  vacio,
  claseFila,
  claveAnchos,
}: {
  filas: T[]
  columnas: Columna<T>[]
  clave: (f: T) => string | number
  alHacerClic?: (f: T) => void
  ordenInicial?: Orden
  altoFila?: number
  className?: string
  vacio?: ReactNode
  claseFila?: (f: T) => string | undefined
  /** Si se indica, el usuario puede arrastrar el borde de cada encabezado y los anchos se recuerdan con esta clave. */
  claveAnchos?: string
}) {
  const [orden, setOrden] = useState<Orden | null>(ordenInicial ?? null)
  const contenedor = useRef<HTMLDivElement>(null)
  const [anchos, setAnchos] = useState<Record<string, number>>(() => leerAnchos(claveAnchos))
  const ancho = (c: Columna<T>) => anchos[c.id] ?? c.ancho
  const estilo = (c: Columna<T>) => ({ width: ancho(c), flexGrow: anchos[c.id] ? 0 : c.ancho })
  const ajustar = (id: string, valor: number | null) =>
    setAnchos((a) => {
      const n = { ...a }
      if (valor == null) delete n[id]
      else n[id] = Math.max(MIN_ANCHO, Math.round(valor))
      return n
    })
  useEffect(() => guardarAnchos(claveAnchos, anchos), [claveAnchos, anchos])

  const ordenadas = useMemo(() => {
    if (!orden) return filas
    const col = columnas.find((c) => c.id === orden.columna)
    if (!col?.ordenar) return filas
    const f = col.ordenar
    const copia = [...filas]
    copia.sort((a, b) => {
      const r = cmp(f(a), f(b))
      return orden.asc ? r : -r
    })
    return copia
  }, [filas, orden, columnas])

  const virtual = useVirtualizer({
    count: ordenadas.length,
    getScrollElement: () => contenedor.current,
    estimateSize: () => altoFila,
    overscan: 12,
  })

  const anchoTotal = columnas.reduce((s, c) => s + ancho(c), 0)
  const alinear = (a?: string) => (a === 'der' ? 'justify-end text-right' : a === 'centro' ? 'justify-center text-center' : '')

  return (
    <div ref={contenedor} className={cn('relative overflow-auto rounded-xl border border-line bg-surface', className)}>
      <div style={{ width: '100%', minWidth: anchoTotal }}>
        <div className="sticky top-0 z-10 flex border-b border-line bg-muted text-[12px] font-semibold text-ink-soft">
          {columnas.map((c) => {
            const activa = orden?.columna === c.id
            // Sin orden: no es un botón (puede llevar una casilla u otro control adentro).
            const contenido = !c.ordenar ? (
              <div className={cn('flex h-full w-full items-center px-2 py-2.5 select-none', alinear(c.alinear))}>
                <span className="min-w-0 truncate">{c.titulo}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setOrden(activa ? { columna: c.id, asc: !orden!.asc } : { columna: c.id, asc: true })}
                className={cn(
                  'flex h-full w-full items-center gap-1 px-2 py-2.5 select-none',
                  alinear(c.alinear),
                  'hover:text-ink',
                  activa && 'text-navy',
                )}
              >
                <span className="truncate">{c.titulo}</span>
                {activa && (orden!.asc ? <ArrowUp className="size-3.5 shrink-0" /> : <ArrowDown className="size-3.5 shrink-0" />)}
              </button>
            )
            return (
              <div key={c.id} style={estilo(c)} className="relative flex shrink-0">
                {contenido}
                {claveAnchos && (
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Ajustar ancho de ${typeof c.titulo === 'string' ? c.titulo : c.id}`}
                    title="Arrastre para ajustar el ancho (doble clic: restablecer)"
                    className="absolute -right-1 top-0 z-20 flex h-full w-2.5 cursor-col-resize touch-none justify-center hover:[&>div]:bg-navy"
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={() => ajustar(c.id, null)}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const x0 = e.clientX
                      const w0 = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect().width
                      const mover = (ev: PointerEvent) => ajustar(c.id, w0 + ev.clientX - x0)
                      const soltar = () => {
                        window.removeEventListener('pointermove', mover)
                        window.removeEventListener('pointerup', soltar)
                      }
                      window.addEventListener('pointermove', mover)
                      window.addEventListener('pointerup', soltar)
                    }}
                  >
                    <div className="h-full w-px bg-line-strong/60" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {ordenadas.length === 0 ? (
          <div className="sticky left-0 w-full max-w-[calc(100vw-2rem)]">{vacio}</div>
        ) : (
          <div style={{ height: virtual.getTotalSize(), position: 'relative' }}>
            {virtual.getVirtualItems().map((v) => {
              const fila = ordenadas[v.index]
              return (
                <div
                  key={clave(fila)}
                  className={cn(
                    'absolute left-0 flex w-full items-center border-b border-line/70 text-[12.5px]',
                    alHacerClic && 'cursor-pointer hover:bg-navy-soft/40',
                    claseFila?.(fila),
                  )}
                  style={{ top: v.start, height: v.size }}
                  onClick={(e) => {
                    // Seleccionar texto para copiarlo no debe abrir la póliza.
                    if (window.getSelection()?.toString()) return
                    if ((e.target as HTMLElement).closest('button,a,input,label')) return
                    alHacerClic?.(fila)
                  }}
                >
                  {columnas.map((c) => (
                    <div
                      key={c.id}
                      style={estilo(c)}
                      title={c.titleDe?.(fila)}
                      className={cn('flex min-w-0 shrink-0 items-center px-2', alinear(c.alinear))}
                    >
                      <div className="min-w-0 truncate">{c.celda(fila)}</div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
