import { useState } from 'react'
import { Popover } from 'radix-ui'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { MESES } from '@/lib/fechas'
import { cn } from '@/lib/utils'

type Arbol = { anio: number; n: number; meses: { clave: string; mes: number; n: number }[] }[]

/** "Año y mes de inicio": jerarquía con años que se abren en meses, selección múltiple. */
export function FiltroAnioMes({
  etiqueta,
  arbol,
  anios,
  meses,
  onCambio,
}: {
  etiqueta: string
  arbol: Arbol
  anios: number[]
  meses: string[]
  onCambio: (anios: number[], meses: string[]) => void
}) {
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set())
  const activo = anios.length + meses.length > 0
  const resumen = !activo ? 'Todos' : `${anios.length ? `${anios.length} ${anios.length === 1 ? 'año' : 'años'}` : ''}${anios.length && meses.length ? ' + ' : ''}${meses.length ? `${meses.length} ${meses.length === 1 ? 'mes' : 'meses'}` : ''}`
  const alternarAbierto = (a: number) =>
    setAbiertos((s) => {
      const n = new Set(s)
      if (!n.delete(a)) n.add(a)
      return n
    })
  const alternarAnio = (a: number) => {
    const claves = arbol.find((x) => x.anio === a)?.meses.map((m) => m.clave) ?? []
    onCambio(anios.includes(a) ? anios.filter((x) => x !== a) : [...anios, a], meses.filter((m) => !claves.includes(m)))
  }
  const alternarMes = (clave: string, a: number) => {
    // Si el año completo estaba marcado, pasa a "todos sus meses menos este".
    if (anios.includes(a)) {
      const resto = (arbol.find((x) => x.anio === a)?.meses ?? []).map((m) => m.clave).filter((c) => c !== clave)
      onCambio(anios.filter((x) => x !== a), [...meses, ...resto])
      return
    }
    onCambio(anios, meses.includes(clave) ? meses.filter((m) => m !== clave) : [...meses, clave])
  }

  return (
    <Popover.Root>
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
        <Popover.Content align="start" sideOffset={6} className="z-50 w-64 rounded-xl border border-line bg-surface p-2 shadow-xl">
          <div className="mb-1 flex justify-end px-1 text-[12px]">
            <button type="button" className="text-ink-soft hover:underline disabled:opacity-40" disabled={!activo} onClick={() => onCambio([], [])}>
              Quitar selección
            </button>
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {arbol.map((a) => {
              const abierto = abiertos.has(a.anio)
              const completo = anios.includes(a.anio)
              const parcial = !completo && a.meses.some((m) => meses.includes(m.clave))
              return (
                <li key={a.anio}>
                  <div className="flex items-center gap-1 rounded-md px-1 py-1 text-[13px] hover:bg-muted">
                    <button type="button" aria-label={abierto ? `Cerrar ${a.anio}` : `Abrir ${a.anio}`} onClick={() => alternarAbierto(a.anio)} className="text-ink-soft">
                      {abierto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </button>
                    <label className="flex flex-1 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-navy"
                        checked={completo}
                        ref={(el) => {
                          if (el) el.indeterminate = parcial
                        }}
                        onChange={() => alternarAnio(a.anio)}
                      />
                      <span className="flex-1 font-semibold">{a.anio}</span>
                      <span className="num text-[11.5px] text-ink-soft">{a.n}</span>
                    </label>
                  </div>
                  {abierto && (
                    <ul className="ml-6">
                      {a.meses.map((m) => (
                        <li key={m.clave}>
                          <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-muted">
                            <input type="checkbox" className="size-4 accent-navy" checked={completo || meses.includes(m.clave)} onChange={() => alternarMes(m.clave, a.anio)} />
                            <span className="flex-1">{MESES[m.mes]}</span>
                            <span className="num text-[11.5px] text-ink-soft">{m.n}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
            {arbol.length === 0 && <li className="px-2 py-3 text-center text-[13px] text-ink-soft">Sin fechas</li>}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
