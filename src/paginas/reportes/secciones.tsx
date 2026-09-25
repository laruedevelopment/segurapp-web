import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import {
  AlertTriangle,
  ArrowUpDown,
  CalendarClock,
  CalendarX2,
  ChevronRight,
  CircleCheck,
  CircleDollarSign,
  CircleX,
  Clock,
  Copy,
  ExternalLink,
  Filter,
  ReceiptText,
} from 'lucide-react'
import { toast } from 'sonner'
import { Tarjeta, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { Dialogo } from '@/components/ui/dialogo'
import { fmtFecha } from '@/lib/fechas'
import { fmtDinero, fmtNum } from '@/lib/numeros'
import { cn } from '@/lib/utils'
import { diasParaVencer, type Dimension, type FilaReporte, type Grupo } from './calculos'

// ── Piezas comunes ──────────────────────────────────────────────────────────

type Tono = 'navy' | 'verde' | 'peligro' | 'alerta' | 'ambar' | 'neutro'

const colorTono: Record<Tono, string> = {
  navy: 'text-navy',
  verde: 'text-green',
  peligro: 'text-danger',
  alerta: 'text-warning',
  ambar: 'text-amber-600',
  neutro: 'text-ink-soft',
}
const bordeTono: Record<Tono, string> = {
  navy: 'border-navy/25',
  verde: 'border-green/25',
  peligro: 'border-danger/25',
  alerta: 'border-warning/30',
  ambar: 'border-amber-600/30',
  neutro: 'border-line',
}

/** Tarjeta de cifra; si tiene onClick se puede tocar para filtrar o ir a la pestaña. */
function Indicador({
  titulo,
  valor,
  icono,
  tono,
  onClick,
  ayuda,
}: {
  titulo: string
  valor: string
  icono: ReactNode
  tono: Tono
  onClick?: () => void
  ayuda?: string
}) {
  const contenido = (
    <>
      <div className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
        <span className={cn('[&_svg]:size-4', colorTono[tono])}>{icono}</span>
        <span className="flex-1">{titulo}</span>
        {onClick && <ChevronRight className="size-3.5 text-line-strong" />}
      </div>
      <div className="num mt-1 text-xl font-semibold text-ink">{valor}</div>
    </>
  )
  const clase = 'min-w-[170px] flex-1 rounded-xl border border-line bg-surface p-4 text-left sm:flex-none'
  return onClick ? (
    <button type="button" onClick={onClick} title={ayuda} className={cn(clase, 'transition-colors hover:border-navy/40 hover:bg-navy-soft/30')}>
      {contenido}
    </button>
  ) : (
    <div className={clase} title={ayuda}>
      {contenido}
    </div>
  )
}

/** Barra horizontal simple (valor sobre máximo), color de la marca. */
function Barra({ fraccion, color, fuerte }: { fraccion: number; color: 'navy' | 'verde'; fuerte?: boolean }) {
  const f = Math.max(0, Math.min(1, fraccion))
  return (
    <div className={cn('h-[18px] w-full overflow-hidden rounded', color === 'navy' ? 'bg-navy/8' : 'bg-green/8')}>
      <div
        className={cn(
          'h-full rounded',
          color === 'navy' ? (fuerte ? 'bg-navy' : 'bg-navy/60') : fuerte ? 'bg-green' : 'bg-green/60',
        )}
        style={{ width: `${f * 100}%` }}
      />
    </div>
  )
}

const pct1 = (n: number) => `${n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

// ── Resumen ─────────────────────────────────────────────────────────────────

export interface DatosResumen {
  total: number
  vigentes: number
  vencidas: number
  sinFfin: number
  primaTotal: number
  pv30: number
  pv60: number
  pv90: number
  topAseg: Grupo[]
  topRamo: Grupo[]
}

export function Resumen({
  d,
  encabezado,
  onVigentes,
  onVencidas,
  onSinFecha,
  onPorVencer,
  onGrupo,
}: {
  d: DatosResumen
  encabezado: ReactNode
  onVigentes: () => void
  onVencidas: () => void
  onSinFecha: () => void
  onPorVencer: (desde: number, hasta: number) => void
  onGrupo: (dim: Dimension, nombre: string) => void
}) {
  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Resumen general</h2>
        <p className="text-[12.5px] text-ink-soft">{encabezado}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Indicador titulo="Total pólizas" valor={fmtNum(d.total)} icono={<ReceiptText />} tono="navy" />
        <Indicador titulo="Vigentes" valor={fmtNum(d.vigentes)} icono={<CircleCheck />} tono="verde" onClick={onVigentes} ayuda="Filtrar solo las vigentes" />
        <Indicador titulo="Vencidas" valor={fmtNum(d.vencidas)} icono={<CircleX />} tono="peligro" onClick={onVencidas} ayuda="Ver las vencidas" />
        <Indicador titulo="Prima total" valor={fmtDinero(d.primaTotal)} icono={<CircleDollarSign />} tono="verde" />
        {d.sinFfin > 0 && (
          <Indicador titulo="Sin fecha venc." valor={fmtNum(d.sinFfin)} icono={<CalendarX2 />} tono="neutro" onClick={onSinFecha} ayuda="Ver las pólizas sin fecha de vencimiento" />
        )}
      </div>

      <div>
        <h3 className="mb-2.5 text-[14px] font-semibold">Vencimientos próximos</h3>
        <div className="flex flex-wrap gap-3">
          <Indicador titulo="0 – 30 días" valor={fmtNum(d.pv30)} icono={<AlertTriangle />} tono="peligro" onClick={() => onPorVencer(0, 30)} />
          <Indicador titulo="31 – 60 días" valor={fmtNum(d.pv60)} icono={<Clock />} tono="alerta" onClick={() => onPorVencer(31, 60)} />
          <Indicador titulo="61 – 90 días" valor={fmtNum(d.pv90)} icono={<CalendarClock />} tono="ambar" onClick={() => onPorVencer(61, 90)} />
        </div>
      </div>

      <TopCinco titulo="Top 5 aseguradoras" grupos={d.topAseg} total={d.total} color="navy" onClick={(n) => onGrupo('aseg', n)} />
      <TopCinco titulo="Top 5 ramos" grupos={d.topRamo} total={d.total} color="verde" onClick={(n) => onGrupo('ramo', n)} />
    </div>
  )
}

function TopCinco({
  titulo,
  grupos,
  total,
  color,
  onClick,
}: {
  titulo: string
  grupos: Grupo[]
  total: number
  color: 'navy' | 'verde'
  onClick: (nombre: string) => void
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-baseline gap-2">
        <h3 className="text-[14px] font-semibold">{titulo}</h3>
        <span className="text-[11.5px] text-ink-soft">(por cantidad; haga clic para filtrar)</span>
      </div>
      {grupos.length === 0 ? (
        <p className="text-[13px] text-ink-soft">Sin datos.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {grupos.map((g) => (
            <button
              key={g.nombre}
              type="button"
              onClick={() => onClick(g.nombre)}
              title={`${g.nombre}: ${fmtNum(g.cantidad)} pólizas`}
              className="group flex items-center gap-3 rounded-md px-1 py-1 text-left hover:bg-muted"
            >
              <span className="w-44 shrink-0 truncate text-[12.5px] sm:w-52">{g.nombre}</span>
              <Barra fraccion={total ? g.cantidad / total : 0} color={color} />
              <span className="num w-14 shrink-0 text-right text-[12.5px] font-semibold">{fmtNum(g.cantidad)}</span>
              <ChevronRight className="size-3.5 shrink-0 text-line-strong group-hover:text-ink-soft" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Pestañas agrupadas (Aseguradoras, Ramos, Asesores) ──────────────────────

export function Agrupado({
  grupos,
  titulo,
  total,
  primaTotal,
  porPrima,
  onCambiarOrden,
  activo,
  onClickGrupo,
}: {
  grupos: Grupo[]
  titulo: string
  total: number
  primaTotal: number
  porPrima: boolean
  onCambiarOrden: () => void
  activo: string | null
  onClickGrupo: (nombre: string) => void
}) {
  if (!grupos.length) return <Vacio titulo="Sin datos" detalle="Ninguna póliza coincide con los filtros." />
  const maxRef = porPrima ? grupos[0].prima : grupos[0].cantidad
  return (
    <Tarjeta className="mx-auto max-w-[1100px] overflow-x-auto p-2 sm:p-3">
      <div className="min-w-[640px]">
        <div className="flex items-center gap-3 border-b border-line px-2 pb-2 text-[12px] font-semibold text-ink-soft">
          <span className="w-52 shrink-0">{titulo}</span>
          <span className="flex flex-1 items-center gap-2">
            {porPrima ? '% de la prima' : 'Cantidad'}
            <button
              type="button"
              onClick={onCambiarOrden}
              className="inline-flex items-center gap-1 rounded-full bg-navy-soft px-2 py-0.5 text-[11px] font-bold text-navy hover:bg-navy/15"
              title="Cambiar el orden"
            >
              <ArrowUpDown className="size-3" />
              {porPrima ? 'Por prima' : 'Por cantidad'}
            </button>
          </span>
          <span className="w-40 shrink-0 text-right">Prima total</span>
          <span className="w-16 shrink-0 text-right" title="Porcentaje del total de pólizas">% pólizas</span>
        </div>
        {grupos.map((g) => {
          const ref = porPrima ? g.prima : g.cantidad
          const esActivo = activo === g.nombre
          const pctPrima = primaTotal ? (g.prima / primaTotal) * 100 : 0
          const pctTotal = total ? (g.cantidad / total) * 100 : 0
          return (
            <button
              key={g.nombre}
              type="button"
              onClick={() => onClickGrupo(g.nombre)}
              title={esActivo ? 'Quitar este filtro' : `Filtrar por ${g.nombre}`}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-muted',
                esActivo && 'bg-navy-soft/60 hover:bg-navy-soft',
              )}
            >
              <span className={cn('flex w-52 shrink-0 items-center gap-1 truncate', esActivo && 'font-bold')}>
                {esActivo && <Filter className="size-3.5 shrink-0 text-navy" />}
                <span className="truncate">{g.nombre}</span>
              </span>
              <span className="flex flex-1 items-center gap-2">
                <span className="w-[65%]">
                  <Barra fraccion={maxRef ? ref / maxRef : 0} color="navy" fuerte={esActivo} />
                </span>
                <span className="num font-semibold">{porPrima ? pct1(pctPrima) : fmtNum(g.cantidad)}</span>
              </span>
              <span className="num w-40 shrink-0 text-right">{fmtDinero(g.prima)}</span>
              <span className="num w-16 shrink-0 text-right text-ink-soft">{pct1(pctTotal)}</span>
            </button>
          )
        })}
      </div>
    </Tarjeta>
  )
}

// ── Vencimientos ────────────────────────────────────────────────────────────

export interface SeccionVenc {
  clave: string
  titulo: string
  filas: FilaReporte[]
  /** Cantidad real (en vencidas se muestran solo las 100 más recientes). */
  cantidad: number
  prima: number
  tono: Tono
  icono: ReactNode
}

const PASO = 200

export function Vencimientos({ secciones, hoy }: { secciones: SeccionVenc[]; hoy: Date }) {
  const [detalle, setDetalle] = useState<{ fila: FilaReporte; tono: Tono } | null>(null)
  const visibles = secciones.filter((s) => s.filas.length > 0)
  if (!visibles.length) return <Vacio icono={<CalendarClock />} titulo="Sin vencimientos para mostrar" detalle="Ninguna póliza coincide con los filtros." />
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5">
      {visibles.map((s) => (
        <SeccionVencimiento key={s.clave} s={s} hoy={hoy} onAbrir={(fila) => setDetalle({ fila, tono: s.tono })} />
      ))}
      <DetallePoliza detalle={detalle} hoy={hoy} onCerrar={() => setDetalle(null)} />
    </div>
  )
}

function SeccionVencimiento({ s, hoy, onAbrir }: { s: SeccionVenc; hoy: Date; onAbrir: (f: FilaReporte) => void }) {
  const [limite, setLimite] = useState(PASO)
  const mostradas = s.filas.slice(0, limite)
  return (
    <section>
      <div className={cn('mb-2 flex flex-wrap items-center gap-2 [&_svg]:size-4', colorTono[s.tono])}>
        {s.icono}
        <h3 className="flex-1 text-[13.5px] font-semibold">
          {s.titulo} <span className="num">({fmtNum(s.filas.length)})</span>
        </h3>
        <span className="text-[12px] text-ink-soft">
          {s.cantidad !== s.filas.length ? `Prima de las ${fmtNum(s.cantidad)}: ` : 'Prima: '}
          <b className="num text-ink">{fmtDinero(s.prima)}</b>
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {mostradas.map((r) => {
          const dias = diasParaVencer(r, hoy)
          const p = r.p
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onAbrir(r)}
              className={cn('flex items-start gap-3 rounded-lg border bg-surface px-3 py-2 text-left hover:bg-muted/60', bordeTono[s.tono])}
            >
              <div className="min-w-0 flex-1 leading-snug">
                <div className="num truncate text-[13px] font-semibold">{p.nro_poliza || 'Sin número'}</div>
                <div className="truncate text-[12.5px]">{p.nombre_cliente || '—'}</div>
                <div className="truncate text-[11.5px] text-ink-soft">
                  {p.nombre_aseg || '—'} · {p.nombre_ramo || '—'}
                </div>
                {p.nombre_prod && <div className="truncate text-[11.5px] text-navy italic">{p.nombre_prod}</div>}
              </div>
              <div className="shrink-0 text-right leading-snug">
                <div className={cn('num text-[12.5px] font-semibold', colorTono[s.tono])}>{r.ffin ? fmtFecha(r.ffin) : 'Sin fecha'}</div>
                {dias != null && <div className={cn('text-[11.5px]', colorTono[s.tono])}>{textoDias(dias)}</div>}
                {p.nombre_asesor && <div className="max-w-48 truncate text-[11.5px] text-ink-soft">{p.nombre_asesor}</div>}
                <div className="num text-[11.5px] text-ink-soft">{fmtDinero(r.prima)}</div>
              </div>
            </button>
          )
        })}
      </div>
      {s.filas.length > limite && (
        <div className="mt-2 flex justify-center">
          <Boton variante="secundario" tamano="sm" onClick={() => setLimite((l) => l + PASO * 5)}>
            Mostrar más ({fmtNum(s.filas.length - limite)} restantes)
          </Boton>
        </div>
      )}
    </section>
  )
}

const textoDias = (dias: number) =>
  dias < 0 ? `${fmtNum(-dias)} ${dias === -1 ? 'día' : 'días'} vencida` : `${fmtNum(dias)} ${dias === 1 ? 'día' : 'días'}`

function DetallePoliza({
  detalle,
  hoy,
  onCerrar,
}: {
  detalle: { fila: FilaReporte; tono: Tono } | null
  hoy: Date
  onCerrar: () => void
}) {
  const navigate = useNavigate()
  const r = detalle?.fila
  const p = r?.p
  const dias = r ? diasParaVencer(r, hoy) : null
  const tono = detalle?.tono ?? 'neutro'
  return (
    <Dialogo
      abierto={!!detalle}
      onCerrar={onCerrar}
      titulo={
        <span className="flex items-center gap-2">
          <span className="num flex-1">{p?.nro_poliza || 'Sin número'}</span>
          {dias != null && (
            <span className={cn('rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-bold', colorTono[tono])}>{textoDias(dias)}</span>
          )}
        </span>
      }
      pie={
        p && (
          <>
            <Boton variante="secundario" onClick={onCerrar}>
              Cerrar
            </Boton>
            <Boton onClick={() => navigate(`/polizas/${p.id}`)}>
              <ExternalLink />
              Abrir póliza
            </Boton>
          </>
        )
      }
    >
      {p && r && (
        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
          <Dato etiqueta="Código" valor={String(p.id)} />
          <Dato etiqueta="Cliente" valor={p.nombre_cliente} />
          {p.tel_cliente && (
            <>
              <dt className="text-ink-soft">Teléfono</dt>
              <dd className="flex items-center gap-1 font-medium">
                <span className="num">{p.tel_cliente}</span>
                <button
                  type="button"
                  title="Copiar"
                  className="rounded p-1 text-ink-soft hover:bg-muted hover:text-navy"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(p.tel_cliente ?? '')
                      toast.success('Teléfono copiado')
                    } catch {
                      toast.error('No se pudo copiar el teléfono.')
                    }
                  }}
                >
                  <Copy className="size-3.5" />
                </button>
              </dd>
            </>
          )}
          <Dato etiqueta="Aseguradora" valor={p.nombre_aseg} />
          <Dato etiqueta="Ramo" valor={p.nombre_ramo} />
          <Dato etiqueta="Producto" valor={p.nombre_prod} />
          <Dato etiqueta="Bien aseg." valor={p.bien_asegurado} />
          <Dato etiqueta="F. inicio" valor={fmtFecha(r.fini)} />
          <Dato etiqueta="F. venc." valor={fmtFecha(r.ffin)} clase={colorTono[tono]} />
          <Dato etiqueta="Prima" valor={fmtDinero(r.prima)} />
          <Dato etiqueta="Asesor" valor={p.nombre_asesor} />
        </dl>
      )}
    </Dialogo>
  )
}

function Dato({ etiqueta, valor, clase }: { etiqueta: string; valor: string | null | undefined; clase?: string }) {
  if (!valor) return null
  return (
    <>
      <dt className="text-ink-soft">{etiqueta}</dt>
      <dd className={cn('font-medium break-words', clase)}>{valor}</dd>
    </>
  )
}
