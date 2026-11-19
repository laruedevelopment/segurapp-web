import { Link } from 'react-router'
import { AlarmClock, ChevronRight } from 'lucide-react'
import type { ResumenVencimientos } from '@/datos/vencimientosLogica'
import { cn } from '@/lib/utils'

const PASTILLAS = [
  { sem: 'vencida', etiqueta: 'vencidas', clase: 'bg-danger text-white', barra: 'bg-danger' },
  { sem: 'rojo', etiqueta: 'urgentes', clase: 'bg-danger-soft text-danger', barra: 'bg-[#d9715c]' },
  { sem: 'ambar', etiqueta: 'próximas', clase: 'bg-warning-soft text-warning-ink', barra: 'bg-warning' },
  { sem: 'verde', etiqueta: 'con tiempo', clase: 'bg-green-soft text-green-ink', barra: 'bg-green' },
] as const

/** Tarjeta de Inicio: semáforo de vencimientos; cada color lleva a la lista ya filtrada. */
export default function TarjetaVencimientos({ resumen, urgentes }: { resumen: ResumenVencimientos | undefined; urgentes?: number }) {
  const cifras = resumen ? PASTILLAS.map((p) => ({ ...p, n: resumen[p.sem === 'vencida' ? 'vencidas' : p.sem] })) : []
  const total = cifras.reduce((s, c) => s + c.n, 0)
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 transition-shadow hover:shadow-md">
      <Link to="/polizas/vencimientos" className="group flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger [&_svg]:size-6">
          <AlarmClock />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Vencimientos</div>
          <div className="text-[13px] text-ink-soft">
            {!resumen ? 'Cargando…' : total === 0 ? 'Nada por atender' : `${resumen.porAtender} por atender${resumen.renovara ? ` · ${resumen.renovara} renovarán` : ''}`}
          </div>
        </div>
        {(urgentes ?? 0) > 0 && (
          <span className="rounded-full bg-danger px-2.5 py-0.5 text-xs font-semibold text-white" title="Sin atender y vencen en 15 días o menos">
            {urgentes}
          </span>
        )}
        <ChevronRight className="size-5 text-ink-soft transition-transform group-hover:translate-x-0.5" />
      </Link>
      {total > 0 && (
        <>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            {cifras.filter((c) => c.n > 0).map((c) => (
              <Link key={c.sem} to={`/polizas/vencimientos?sem=${c.sem}`} tabIndex={-1} className={cn('h-full transition-opacity hover:opacity-80', c.barra)} style={{ width: `${(c.n / total) * 100}%` }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {cifras.filter((c) => c.n > 0).map((c) => (
              <Link
                key={c.sem}
                to={`/polizas/vencimientos?sem=${c.sem}`}
                className={cn('rounded-full px-3 py-1 text-[12.5px] font-semibold transition-transform hover:scale-105', c.clase)}
              >
                {c.n} {c.etiqueta}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
