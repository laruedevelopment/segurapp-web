import { Popover } from 'radix-ui'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { Boton } from '@/components/ui/button'
import { InputFecha } from '@/components/ui/fecha'
import { claseCampo } from '@/components/ui/campos'
import { fmtFecha } from '@/lib/fechas'
import type { RangoFechas } from '@/paginas/reportes/calculos'
import { cn } from '@/lib/utils'
import { UNIDADES, textoRelativa, type FechaRelativa, type Sentido, type Unidad } from './logica'

const textoRango = (r: RangoFechas) =>
  r.desde && r.hasta ? `${fmtFecha(r.desde)} – ${fmtFecha(r.hasta)}` : r.desde ? `Desde ${fmtFecha(r.desde)}` : r.hasta ? `Hasta ${fmtFecha(r.hasta)}` : 'Todas'

/** Filtro de fechas: un rango manual y, si se admite, una fecha relativa ("Siguientes 12 meses"). */
export function FiltroFechas({
  etiqueta,
  rango,
  onRango,
  relativa,
  onRelativa,
  atajos,
}: {
  etiqueta: string
  rango: RangoFechas
  onRango: (r: RangoFechas) => void
  /** Si se pasa, el filtro permite fecha relativa. */
  relativa?: FechaRelativa | null
  onRelativa?: (r: FechaRelativa | null) => void
  atajos?: { texto: string; relativa: FechaRelativa }[]
}) {
  const admiteRelativa = !!onRelativa
  const activo = !!relativa || !!rango.desde || !!rango.hasta
  const resumen = relativa ? textoRelativa(relativa) : textoRango(rango)
  const rel: FechaRelativa = relativa ?? { sentido: 'siguiente', n: 12, unidad: 'meses' }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-9 min-w-0 max-w-[18rem] items-center gap-1.5 rounded-[10px] border px-2.5 text-left text-[13px] transition-colors hover:bg-muted',
            activo ? 'border-navy bg-navy-soft text-navy-dark' : 'border-line-strong bg-surface text-ink',
          )}
        >
          <CalendarDays className="size-4 shrink-0 opacity-70" />
          <span className="shrink-0 font-semibold">{etiqueta}:</span>
          <span className="min-w-0 flex-1 truncate">{resumen}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-50 w-80 rounded-xl border border-line bg-surface p-3 shadow-xl">
          {admiteRelativa && (
            <div className="mb-3">
              <div className="mb-1.5 text-[12px] font-semibold text-ink-soft">Fecha relativa</div>
              <div className="flex gap-1.5">
                <select
                  className={cn(claseCampo, 'h-9 w-28 px-2 text-[13px]')}
                  value={rel.sentido}
                  onChange={(e) => onRelativa?.({ ...rel, sentido: e.target.value as Sentido })}
                >
                  <option value="siguiente">Siguientes</option>
                  <option value="anterior">Anteriores</option>
                  <option value="este">Este</option>
                </select>
                {rel.sentido !== 'este' && (
                  <input
                    type="number"
                    min={1}
                    max={999}
                    className={cn(claseCampo, 'h-9 w-16 px-2 text-[13px]')}
                    value={rel.n}
                    onChange={(e) => onRelativa?.({ ...rel, n: Math.max(1, Number(e.target.value) || 1) })}
                  />
                )}
                <select
                  className={cn(claseCampo, 'h-9 flex-1 px-2 text-[13px]')}
                  value={rel.unidad}
                  onChange={(e) => onRelativa?.({ ...rel, unidad: e.target.value as Unidad })}
                >
                  {UNIDADES.map((u) => (
                    <option key={u.id} value={u.id}>{u.texto}</option>
                  ))}
                </select>
              </div>
              {atajos && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {atajos.map((a) => (
                    <button key={a.texto} type="button" onClick={() => onRelativa?.(a.relativa)} className="rounded-full bg-muted px-2.5 py-1 text-[12px] font-semibold hover:bg-line">
                      {a.texto}
                    </button>
                  ))}
                </div>
              )}
              <div className="my-3 border-t border-line" />
            </div>
          )}
          <div className="mb-1.5 text-[12px] font-semibold text-ink-soft">{admiteRelativa ? 'O un rango de fechas' : 'Rango de fechas'}</div>
          <div className="flex items-center gap-1.5">
            <InputFecha valor={rango.desde} onCambio={(d) => { onRelativa?.(null); onRango({ ...rango, desde: d }) }} placeholder="Desde" className="h-9" />
            <InputFecha valor={rango.hasta} onCambio={(d) => { onRelativa?.(null); onRango({ ...rango, hasta: d }) }} placeholder="Hasta" className="h-9" />
          </div>
          <div className="mt-3 flex justify-end">
            <Boton variante="fantasma" tamano="sm" disabled={!activo} onClick={() => { onRelativa?.(null); onRango({ desde: null, hasta: null }) }}>
              Quitar filtro
            </Boton>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
