import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro' | 'verde'
type Tamano = 'sm' | 'md' | 'icono'

const variantes: Record<Variante, string> = {
  primario: 'bg-navy text-white hover:bg-navy-dark shadow-sm',
  verde: 'bg-green text-white hover:bg-green-light shadow-sm',
  secundario: 'bg-surface text-navy border border-line-strong hover:bg-muted',
  fantasma: 'text-ink-soft hover:bg-muted hover:text-ink',
  peligro: 'bg-danger text-white hover:brightness-110 shadow-sm',
}

const tamanos: Record<Tamano, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 gap-2',
  icono: 'h-9 w-9 justify-center',
}

export interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamano?: Tamano
  cargando?: boolean
}

export const Boton = forwardRef<HTMLButtonElement, BotonProps>(function Boton(
  { variante = 'primario', tamano = 'md', cargando, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || cargando}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[10px] font-semibold whitespace-nowrap transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4',
        variantes[variante],
        tamanos[tamano],
        className,
      )}
      {...rest}
    >
      {cargando && <Loader2 className="animate-spin" />}
      {children}
    </button>
  )
})
