import { useEffect, useState } from 'react'
import { Popover } from 'radix-ui'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { MESES, fmtFecha, hoy, parseFecha } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import { Boton } from './button'
import { claseCampo } from './campos'

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const mismoDia = (a: Date | null | undefined, b: Date | null | undefined) =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export interface Rango {
  desde: Date | null
  hasta: Date | null
}

/**
 * Calendario compacto con los 12 meses del año a la vista y flechas para
 * cambiar de año (igual al de la app Flutter). En modo rango, el primer clic
 * marca "desde" y el segundo "hasta".
 */
function CalendarioAnual({
  anio,
  setAnio,
  seleccion,
  onDia,
}: {
  anio: number
  setAnio: (a: number) => void
  seleccion: Rango
  onDia: (d: Date) => void
}) {
  const hoyD = hoy()
  const { desde, hasta } = seleccion
  return (
    <div className="w-[min(860px,94vw)] p-3">
      <div className="mb-2 flex items-center justify-center gap-3">
        <Boton variante="fantasma" tamano="icono" onClick={() => setAnio(anio - 1)} aria-label="Año anterior">
          <ChevronLeft />
        </Boton>
        <span className="num w-16 text-center text-lg font-semibold">{anio}</span>
        <Boton variante="fantasma" tamano="icono" onClick={() => setAnio(anio + 1)} aria-label="Año siguiente">
          <ChevronRight />
        </Boton>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {MESES.map((nombre, mes) => {
          const primero = new Date(anio, mes, 1)
          const vacios = (primero.getDay() + 6) % 7
          const diasMes = new Date(anio, mes + 1, 0).getDate()
          return (
            <div key={mes}>
              <div className="mb-1 text-center text-[12.5px] font-semibold text-navy">{nombre}</div>
              <div className="grid grid-cols-7 text-center text-[10.5px] text-ink-soft">
                {DIAS.map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: vacios }).map((_, i) => (
                  <span key={'v' + i} />
                ))}
                {Array.from({ length: diasMes }).map((_, i) => {
                  const d = new Date(anio, mes, i + 1)
                  const extremo = mismoDia(d, desde) || mismoDia(d, hasta)
                  const dentro = desde && hasta && d > desde && d < hasta
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onDia(d)}
                      className={cn(
                        'num h-6 rounded text-[12px] hover:bg-muted',
                        dentro && 'bg-navy-soft',
                        extremo && 'bg-navy font-semibold text-white hover:bg-navy-dark',
                        !extremo && mismoDia(d, hoyD) && 'font-bold text-green',
                      )}
                    >
                      {i + 1}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Campo de fecha: se puede escribir (25/09/2026) o escoger en el calendario.
 * Entrega un Date a medianoche local, o null si está vacío.
 */
export function InputFecha({
  valor,
  onCambio,
  disabled,
  placeholder = 'dd/mm/aaaa',
  className,
  error,
}: {
  valor: Date | null | undefined
  onCambio: (d: Date | null) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  error?: boolean
}) {
  const [texto, setTexto] = useState(fmtFecha(valor))
  const [abierto, setAbierto] = useState(false)
  const [anio, setAnio] = useState((valor ?? hoy()).getFullYear())
  const [invalido, setInvalido] = useState(false)

  useEffect(() => {
    setTexto(fmtFecha(valor))
    setInvalido(false)
  }, [valor])

  const confirmarTexto = () => {
    if (!texto.trim()) {
      setInvalido(false)
      if (valor) onCambio(null)
      return
    }
    const d = parseFecha(texto)
    if (d) {
      setInvalido(false)
      if (!mismoDia(d, valor)) onCambio(d)
      else setTexto(fmtFecha(d))
    } else {
      setInvalido(true)
    }
  }

  return (
    <Popover.Root
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v)
        if (v) setAnio((valor ?? hoy()).getFullYear())
      }}
    >
      <div className={cn('relative', className)}>
        <input
          className={cn(claseCampo, 'num pr-16', (invalido || error) && 'border-danger')}
          value={texto}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={confirmarTexto}
          onKeyDown={(e) => e.key === 'Enter' && confirmarTexto()}
          title={invalido ? 'Fecha no válida. Use dd/mm/aaaa.' : undefined}
        />
        <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center">
          {valor && !disabled && (
            <button
              type="button"
              aria-label="Borrar fecha"
              className="rounded p-1 text-ink-soft hover:bg-muted"
              onClick={() => onCambio(null)}
            >
              <X className="size-3.5" />
            </button>
          )}
          <Popover.Trigger asChild disabled={disabled}>
            <button type="button" aria-label="Abrir calendario" className="rounded p-1 text-navy hover:bg-muted">
              <CalendarDays className="size-4" />
            </button>
          </Popover.Trigger>
        </div>
      </div>
      <Popover.Portal>
        <Popover.Content sideOffset={4} collisionPadding={12} className="z-50 rounded-xl border border-line bg-surface shadow-xl">
          <CalendarioAnual
            anio={anio}
            setAnio={setAnio}
            seleccion={{ desde: valor ?? null, hasta: null }}
            onDia={(d) => {
              onCambio(d)
              setAbierto(false)
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** Botón que muestra un rango "desde – hasta" y lo edita con el calendario anual. */
export function SelectorRango({
  valor,
  onCambio,
  etiqueta = 'Fechas',
  className,
}: {
  valor: Rango
  onCambio: (r: Rango) => void
  etiqueta?: string
  className?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [borrador, setBorrador] = useState<Rango>(valor)
  const [anio, setAnio] = useState((valor.desde ?? hoy()).getFullYear())
  const tiene = valor.desde || valor.hasta

  return (
    <Popover.Root
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v)
        if (v) {
          setBorrador(valor)
          setAnio((valor.desde ?? hoy()).getFullYear())
        }
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold',
            tiene ? 'border-navy/30 bg-navy-soft text-navy-dark' : 'border-line bg-surface text-ink hover:bg-muted',
            className,
          )}
        >
          <CalendarDays className="size-3.5" />
          {tiene ? (
            <span className="num">
              {fmtFecha(valor.desde) || '…'} – {fmtFecha(valor.hasta) || '…'}
            </span>
          ) : (
            etiqueta
          )}
          {tiene && (
            <span
              role="button"
              aria-label="Quitar fechas"
              className="-mr-1 rounded-full p-0.5 hover:bg-white/60"
              onClick={(e) => {
                e.stopPropagation()
                onCambio({ desde: null, hasta: null })
              }}
            >
              <X className="size-3.5" />
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={4} collisionPadding={12} className="z-50 rounded-xl border border-line bg-surface shadow-xl">
          <CalendarioAnual
            anio={anio}
            setAnio={setAnio}
            seleccion={borrador}
            onDia={(d) =>
              setBorrador((b) =>
                !b.desde || b.hasta || d < b.desde ? { desde: d, hasta: null } : { desde: b.desde, hasta: d },
              )
            }
          />
          <div className="flex items-center gap-2 border-t border-line px-3 py-2 text-[13px]">
            <span className="flex-1 text-ink-soft">
              Desde <b className="num text-ink">{fmtFecha(borrador.desde) || '—'}</b> hasta{' '}
              <b className="num text-ink">{fmtFecha(borrador.hasta) || '—'}</b>
            </span>
            <Boton variante="fantasma" tamano="sm" onClick={() => setBorrador({ desde: null, hasta: null })}>
              Limpiar
            </Boton>
            <Boton
              tamano="sm"
              onClick={() => {
                onCambio(borrador)
                setAbierto(false)
              }}
            >
              Aplicar
            </Boton>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
