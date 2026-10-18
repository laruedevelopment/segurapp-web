import { useRef, type PointerEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CalendarCheck, CalendarClock, CalendarPlus, Shield, Trash2, User } from 'lucide-react'
import { CasillaTactil } from '@/components/ui/campos'
import { aFecha, fmtFecha } from '@/lib/fechas'
import { fmtDinero, fmtDoc } from '@/lib/numeros'
import type { PolizaLista } from '@/lib/tipos'
import { cn } from '@/lib/utils'

const MS_TOQUE_LARGO = 500

const Etiqueta = ({ icono, children }: { icono?: ReactNode; children: ReactNode }) => (
  <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-semibold text-ink [&_svg]:size-3.5">
    {icono}
    <span className="truncate">{children}</span>
  </span>
)

const InfoFecha = ({ icono, etiqueta, valor }: { icono: ReactNode; etiqueta: string; valor: string | null }) => (
  <span className="inline-flex items-center gap-1 text-[12px] text-ink-soft [&_svg]:size-3.5">
    {icono}
    <span className="num">
      {etiqueta}: {fmtFecha(aFecha(valor)) || '—'}
    </span>
  </span>
)

/**
 * Tarjeta de una póliza para pantallas angostas (igual que `_vistaMovil` de la
 * app de Flutter). Un toque largo entra al modo selección.
 */
export function TarjetaPoliza({
  p,
  modoSeleccion,
  marcada,
  onAbrir,
  onAlternar,
  onEntrarSeleccion,
  onEliminar,
}: {
  p: PolizaLista
  modoSeleccion: boolean
  marcada: boolean
  onAbrir: () => void
  onAlternar: () => void
  onEntrarSeleccion: () => void
  onEliminar: () => void
}) {
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const largo = useRef(false)

  const cancelar = () => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = null
  }
  const inicio = useRef({ x: 0, y: 0 })
  const mover = (e: PointerEvent) => {
    // Un temblor del dedo no cancela; arrastrar (hacer scroll) sí.
    if (Math.hypot(e.clientX - inicio.current.x, e.clientY - inicio.current.y) > 10) cancelar()
  }
  const empezar = (e: PointerEvent) => {
    largo.current = false
    inicio.current = { x: e.clientX, y: e.clientY }
    if (modoSeleccion || (e.target as HTMLElement).closest('button,a,input,label')) return
    cancelar()
    temporizador.current = setTimeout(() => {
      largo.current = true
      onEntrarSeleccion()
    }, MS_TOQUE_LARGO)
  }

  const doc = p.doc_cliente ? `${p.tipodoc_cliente ? p.tipodoc_cliente + ' ' : ''}${fmtDoc(p.doc_cliente)}` : ''

  return (
    <article
      onPointerDown={empezar}
      onPointerUp={cancelar}
      onPointerLeave={cancelar}
      onPointerCancel={cancelar}
      onPointerMove={mover}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button,a,input,label')) return
        if (largo.current) {
          largo.current = false
          return
        }
        if (modoSeleccion) onAlternar()
        else onAbrir()
      }}
      className={cn(
        'cursor-pointer rounded-xl border bg-surface px-4 py-3 select-none',
        marcada ? 'border-navy bg-navy-soft' : 'border-line',
      )}
    >
      <div className="flex items-center gap-1">
        {modoSeleccion && (
          <CasillaTactil
            className="-my-2 -ml-3"
            checked={marcada}
            onChange={onAlternar}
            label={`Seleccionar la póliza ${p.nro_poliza ?? p.id}`}
          />
        )}
        <Link to={`/polizas/${p.id}`} className="num min-w-0 flex-1 truncate text-[15px] font-bold">
          {p.nro_poliza ?? 'Sin número'}
        </Link>
        <span className="num shrink-0 text-[12px] text-ink-soft">Cód. {p.id}</span>
        {!modoSeleccion && (
          <button
            type="button"
            title="Eliminar (la autoriza un administrador)"
            aria-label={`Eliminar la póliza ${p.nro_poliza ?? p.id}`}
            onClick={onEliminar}
            className="-my-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger-soft"
          >
            <Trash2 className="size-5" />
          </button>
        )}
      </div>

      <div className="mt-1 flex items-baseline gap-2 text-[13px]">
        <span className="min-w-0 flex-1 truncate">{p.nombre_cliente ?? '—'}</span>
        {p.cliente_id != null && <span className="shrink-0 text-[10.5px] text-ink-soft">#{p.cliente_id}</span>}
      </div>
      {doc && <div className="num text-[11.5px] text-ink-soft">{doc}</div>}

      {p.bien_asegurado && (
        <div className="mt-1 flex items-center gap-1 text-[12px] text-ink-soft">
          <Shield className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{p.bien_asegurado}</span>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
        {p.nombre_aseg && <Etiqueta>{p.nombre_aseg}</Etiqueta>}
        {p.nombre_ramo && <Etiqueta>{p.nombre_ramo}</Etiqueta>}
        {p.nombre_asesor && <Etiqueta icono={<User aria-hidden="true" />}>{p.nombre_asesor}</Etiqueta>}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <InfoFecha icono={<CalendarPlus aria-hidden="true" />} etiqueta="Exp." valor={p.fexp_poliza} />
        <InfoFecha icono={<CalendarCheck aria-hidden="true" />} etiqueta="Ini." valor={p.fini_poliza} />
        <InfoFecha icono={<CalendarClock aria-hidden="true" />} etiqueta="Vence" valor={p.ffin_poliza} />
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <span className="num flex-1 text-[13px] font-semibold">Prima: {p.prima_poliza ? fmtDinero(p.prima_poliza) : '—'}</span>
        {p.apodo_usuario && <Etiqueta icono={<User aria-hidden="true" />}>{p.apodo_usuario}</Etiqueta>}
      </div>
    </article>
  )
}
