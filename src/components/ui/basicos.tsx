import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Tarjeta({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-xl border border-line bg-surface', className)}>{children}</div>
}

export function SeccionTarjeta({
  titulo,
  icono,
  acciones,
  className,
  children,
}: {
  titulo: ReactNode
  icono?: ReactNode
  acciones?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Tarjeta className={cn('p-4 sm:p-5', className)}>
      <div className="mb-4 flex items-center gap-2">
        {icono && <span className="text-navy [&_svg]:size-5">{icono}</span>}
        <h2 className="flex-1 text-[15px] font-semibold">{titulo}</h2>
        {acciones}
      </div>
      {children}
    </Tarjeta>
  )
}

type Tono = 'neutro' | 'navy' | 'verde' | 'alerta' | 'peligro'
const tonos: Record<Tono, string> = {
  neutro: 'bg-muted text-ink',
  navy: 'bg-navy-soft text-navy-dark',
  verde: 'bg-green-soft text-green-ink',
  alerta: 'bg-warning-soft text-warning-ink',
  peligro: 'bg-danger-soft text-danger',
}

export function Etiqueta({ tono = 'neutro', className, children }: { tono?: Tono; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap [&_svg]:size-3.5',
        tonos[tono],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Botón tipo "chip" para filtros (Todos / Vigentes / ...). */
export function Chip({
  activo,
  onClick,
  children,
  fuerte = false,
}: {
  activo: boolean
  onClick: () => void
  children: ReactNode
  /** Seleccionado con verde sólido y texto blanco (más notorio), para opciones únicas como el estado. */
  fuerte?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        'inline-flex h-10 items-center md:h-8 gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors [&_svg]:size-3.5',
        activo
          ? fuerte
            ? 'border-[#167a3c] bg-[#167a3c] text-white shadow-sm'
            : 'border-green/30 bg-green-soft text-green-ink'
          : 'border-transparent bg-muted text-ink hover:bg-line',
      )}
    >
      {children}
    </button>
  )
}

export function Cargando({ texto = 'Cargando…', className }: { texto?: ReactNode; className?: string }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-2 py-16 text-ink-soft', className)}>
      <Loader2 className="size-5 animate-spin text-navy" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  )
}

export function Vacio({ icono, titulo, detalle }: { icono?: ReactNode; titulo: ReactNode; detalle?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-ink-soft">
      {icono && <span className="text-line-strong [&_svg]:size-10">{icono}</span>}
      <p className="font-semibold">{titulo}</p>
      {detalle && <p className="max-w-md text-[13px]">{detalle}</p>}
    </div>
  )
}

export function MensajeError({ error, className }: { error: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn('rounded-[10px] border border-danger/30 bg-danger-soft px-4 py-3 text-danger', className)}>
      {error}
    </div>
  )
}

export function Aviso({ tono = 'alerta', icono, children, className }: { tono?: 'alerta' | 'navy' | 'verde'; icono?: ReactNode; children: ReactNode; className?: string }) {
  const t = {
    alerta: 'border-warning/30 bg-warning-soft text-warning-ink',
    navy: 'border-navy/20 bg-navy-soft text-navy-dark',
    verde: 'border-green/30 bg-green-soft text-green-ink',
  }[tono]
  return (
    <div className={cn('flex items-start gap-2 rounded-[10px] border px-4 py-3 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0', t, className)}>
      {icono}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** Tarjeta de cifra (total de pólizas, prima total, ...). */
export function Cifra({ titulo, valor, detalle, icono }: { titulo: ReactNode; valor: ReactNode; detalle?: ReactNode; icono?: ReactNode }) {
  return (
    <Tarjeta className="p-4">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft [&_svg]:size-4">
        {icono}
        {titulo}
      </div>
      <div className="num mt-1 text-xl font-semibold text-ink">{valor}</div>
      {detalle && <div className="mt-0.5 text-[12px] text-ink-soft">{detalle}</div>}
    </Tarjeta>
  )
}
