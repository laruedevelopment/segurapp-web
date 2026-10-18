import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Título de cada pestaña con el período (y la comparación) que se está viendo. */
export function EncabezadoTab({ titulo, sub, periodo }: { titulo: string; sub?: string; periodo: string }) {
  return (
    <div>
      <h2 className="text-lg font-extrabold">{titulo}</h2>
      <p className="text-[12px] text-ink-soft">{sub ?? periodo}</p>
    </div>
  )
}

/** Tabla con desplazamiento horizontal y el estilo del dashboard. */
export function TablaDash({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-[12px]', className)}>{children}</table>
    </div>
  )
}
