import { forwardRef, useEffect, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { formatearMientrasEscribe, formatearNumCO, parseNumCO } from '@/lib/numeros'
import { cn } from '@/lib/utils'

export const claseCampo =
  'h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-ink placeholder:text-ink-soft/70 ' +
  'focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15 disabled:bg-muted disabled:text-ink-soft'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(claseCampo, className)} {...rest} />
})

export const AreaTexto = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function AreaTexto({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(claseCampo, 'h-auto min-h-20 py-2', className)} {...rest} />
  },
)

/** Etiqueta + control + ayuda o error. */
export function Campo({
  etiqueta,
  error,
  ayuda,
  obligatorio,
  className,
  children,
}: {
  etiqueta?: ReactNode
  error?: string | null
  ayuda?: ReactNode
  obligatorio?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1', className)}>
      {etiqueta && (
        <span className="text-[12px] font-semibold text-ink-soft">
          {etiqueta}
          {obligatorio && <span className="text-danger"> *</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="text-[12px] text-danger">{error}</span>
      ) : ayuda ? (
        <span className="text-[12px] text-ink-soft">{ayuda}</span>
      ) : null}
    </label>
  )
}

/**
 * Campo numérico en formato colombiano (1.234.567,89) que se formatea
 * mientras se escribe. Entrega el número ya interpretado (o null si está vacío).
 */
export function InputNumero({
  valor,
  onCambio,
  maxDecimales = 2,
  permitirNegativos = true,
  prefijo,
  sufijo,
  className,
  ...rest
}: {
  valor: number | null | undefined
  onCambio: (n: number | null) => void
  maxDecimales?: number
  permitirNegativos?: boolean
  prefijo?: string
  sufijo?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'prefix'>) {
  const [texto, setTexto] = useState(() => formatearNumCO(valor ?? null, maxDecimales))

  // Si el valor cambia desde afuera (cálculo automático, IA), se refleja.
  useEffect(() => {
    if (parseNumCO(texto) !== (valor ?? null)) setTexto(formatearNumCO(valor ?? null, maxDecimales))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, maxDecimales])

  return (
    <div className={cn('relative', className)}>
      {prefijo && (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft">{prefijo}</span>
      )}
      <input
        inputMode="decimal"
        autoComplete="off"
        className={cn(claseCampo, 'num text-right', prefijo && 'pl-7', sufijo && 'pr-8')}
        value={texto}
        onChange={(e) => {
          const nuevo = formatearMientrasEscribe(texto, e.target.value, { maxDecimales, permitirNegativos })
          setTexto(nuevo)
          onCambio(parseNumCO(nuevo))
        }}
        {...rest}
      />
      {sufijo && (
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-soft">{sufijo}</span>
      )}
    </div>
  )
}

export function Casilla({
  marcada,
  onCambio,
  etiqueta,
  disabled,
}: {
  marcada: boolean
  onCambio: (v: boolean) => void
  etiqueta: ReactNode
  disabled?: boolean
}) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 select-none', disabled && 'opacity-50')}>
      <input
        type="checkbox"
        className="size-4 accent-navy"
        checked={marcada}
        disabled={disabled}
        onChange={(e) => onCambio(e.target.checked)}
      />
      <span>{etiqueta}</span>
    </label>
  )
}

/** Selector simple de opciones fijas (tipo de documento, rol, etc.). */
export function SelectorSimple<T extends string>({
  valor,
  onCambio,
  opciones,
  vacio,
  className,
  disabled,
}: {
  valor: T | null | undefined
  onCambio: (v: T | null) => void
  opciones: { valor: T; etiqueta: string }[]
  vacio?: string
  className?: string
  disabled?: boolean
}) {
  return (
    <select
      className={cn(claseCampo, 'pr-8', className)}
      value={valor ?? ''}
      disabled={disabled}
      onChange={(e) => onCambio((e.target.value || null) as T | null)}
    >
      {vacio !== undefined && <option value="">{vacio}</option>}
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.etiqueta}
        </option>
      ))}
    </select>
  )
}
