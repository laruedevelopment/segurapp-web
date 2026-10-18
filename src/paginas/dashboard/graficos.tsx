import { useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Tarjeta } from '@/components/ui/basicos'
import { cn } from '@/lib/utils'
import { DashColors, techoEje } from './colores'
import { fmtCompacto, fmtMonto, fmtPct } from './formato'

// Piezas visuales del Dashboard gerencial (dashboard_widgets.dart en Flutter):
// tarjetas, KPI con variación y minigráfico, líneas, columnas, dona, ranking,
// mapa de calor y barra de meta. Los gráficos no se animan: el tablero se
// recalcula con cada filtro y la animación estorba.

// ── Contenedores ────────────────────────────────────────────────────────────

export function DashCard({
  titulo,
  subtitulo,
  accion,
  className,
  children,
}: {
  titulo: ReactNode
  subtitulo?: ReactNode
  accion?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Tarjeta className={cn('min-w-0 p-4', className)}>
      <div className="mb-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-bold">{titulo}</h3>
          {subtitulo && <p className="mt-0.5 text-[12px] text-ink-soft">{subtitulo}</p>}
        </div>
        {accion}
      </div>
      {children}
    </Tarjeta>
  )
}

/** Reparte los hijos en columnas iguales según el ancho disponible. */
export function Rejilla({
  anchoMinimo = 300,
  maxColumnas,
  children,
}: {
  anchoMinimo?: number
  maxColumnas?: number
  children: ReactNode
}) {
  const espacio = 12
  const minimo = maxColumnas
    ? `min(100%, max(${anchoMinimo}px, calc((100% - ${(maxColumnas - 1) * espacio}px) / ${maxColumnas})))`
    : `min(100%, ${anchoMinimo}px)`
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minimo}, 1fr))` }}>
      {children}
    </div>
  )
}

export function SinDatos({ texto = 'Sin datos para los filtros elegidos' }: { texto?: string }) {
  return <div className="py-7 text-center text-[12px] text-ink-soft">{texto}</div>
}

// ── KPI ─────────────────────────────────────────────────────────────────────

function MiniLinea({ v, color }: { v: number[]; color: string }) {
  const w = 100
  const h = 28
  const max = Math.max(1, ...v)
  const puntos = v.map((y, i) => `${((i / (v.length - 1)) * w).toFixed(2)},${(h - 2 - (y / max) * (h - 4)).toFixed(2)}`)
  const linea = puntos.join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-7 w-full" aria-hidden>
      <polygon points={`0,${h} ${linea} ${w},${h}`} fill={color} fillOpacity={0.08} />
      <polyline points={linea} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

export function KpiTile({
  etiqueta,
  valor,
  valorExacto,
  icono,
  color = DashColors.real,
  delta,
  subirEsBueno = true,
  spark,
  pie,
  onTap,
}: {
  etiqueta: string
  valor: string
  valorExacto?: string
  icono: ReactNode
  color?: string
  /** Variación % contra el período de comparación (null = sin base). */
  delta?: number | null
  /** false si subir es malo (p. ej. cartera pendiente). */
  subirEsBueno?: boolean
  spark?: number[]
  pie?: string | null
  onTap?: () => void
}) {
  let chip: ReactNode = null
  if (delta != null) {
    const sube = delta >= 0
    const bueno = Math.abs(delta) < 0.05 ? null : sube === subirEsBueno
    const c = bueno == null ? DashColors.inkSoft : bueno ? DashColors.bueno : DashColors.malo
    chip = (
      <span
        className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold"
        style={{ color: c, backgroundColor: `color-mix(in srgb, ${c} 10%, transparent)` }}
      >
        {sube ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
        {fmtPct(Math.abs(delta))}
      </span>
    )
  }
  const cuerpo = (
    <>
      <div className="flex items-center gap-2">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4"
          style={{ color, backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)` }}
        >
          {icono}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink-soft">{etiqueta}</span>
        {onTap && <ChevronRight className="size-4 shrink-0 text-ink-soft" />}
      </div>
      <div className="mt-2.5 truncate text-2xl font-extrabold">{valor}</div>
      <div className="mt-1.5 flex min-h-5 items-center gap-1.5">
        {chip}
        {pie && <span className="min-w-0 flex-1 truncate text-[12px] text-ink-soft">{pie}</span>}
      </div>
      {spark && spark.length > 1 && (
        <div className="mt-2">
          <MiniLinea v={spark} color={color} />
        </div>
      )}
    </>
  )
  const clase = 'block w-full rounded-xl border border-line bg-surface p-3.5 text-left'
  return onTap ? (
    <button type="button" onClick={onTap} title={valorExacto ?? valor} className={cn(clase, 'transition-shadow hover:shadow-md')}>
      {cuerpo}
    </button>
  ) : (
    <div title={valorExacto ?? valor} className={clase}>
      {cuerpo}
    </div>
  )
}

// ── Ejes y tooltip ──────────────────────────────────────────────────────────

const TICK = { fontSize: 10.5, fill: DashColors.inkSoft }

interface TipProps {
  active?: boolean
  payload?: ReadonlyArray<{ name?: string | number; value?: unknown; color?: string }>
  label?: string | number
}

function TooltipDash({ active, payload, label, formato }: TipProps & { formato: (n: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-ink px-2.5 py-1.5 text-white shadow-lg">
      <div className="text-[11px] font-semibold text-white/70">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[12px] font-bold">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: {formato(Number(p.value ?? 0))}
        </div>
      ))}
    </div>
  )
}

function Leyenda({ items }: { items: Array<{ nombre: string; color: string; punteada?: boolean }> }) {
  if (items.length < 2) return null
  return (
    <div className="mb-2 flex flex-wrap gap-x-3.5 gap-y-1">
      {items.map((s) => (
        <span key={s.nombre} className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-soft">
          <span
            className="inline-block w-3.5"
            style={s.punteada ? { borderTop: `2px dashed ${s.color}` } : { height: 8, borderRadius: 2, backgroundColor: s.color }}
          />
          {s.nombre}
        </span>
      ))}
    </div>
  )
}

// ── Líneas ──────────────────────────────────────────────────────────────────

export interface SerieLinea {
  nombre: string
  valores: number[]
  color: string
  punteada?: boolean
}

/** Líneas (hasta 2 series, misma unidad) con tooltip. */
export function GraficoLineas({
  etiquetas,
  series,
  formato = fmtCompacto,
  alto = 240,
  titulo = 'Gráfico de líneas',
}: {
  etiquetas: string[]
  series: SerieLinea[]
  formato?: (n: number) => string
  alto?: number
  titulo?: string
}) {
  const maxV = Math.max(0, ...series.flatMap((s) => s.valores))
  const techo = techoEje(maxV)
  const paso = Math.max(1, Math.ceil(etiquetas.length / 8))
  const datos = etiquetas.map((e, i) => {
    const fila: Record<string, string | number | undefined> = { e }
    series.forEach((s, k) => {
      fila[`s${k}`] = s.valores[i]
    })
    return fila
  })
  return (
    <div role="img" aria-label={titulo}>
      <Leyenda items={series} />
      <ResponsiveContainer width="100%" height={alto}>
        <ComposedChart data={datos} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={DashColors.linea} />
          <XAxis dataKey="e" tick={TICK} tickLine={false} axisLine={false} interval={paso - 1} />
          <YAxis
            width={54}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            domain={[0, techo]}
            ticks={[0, 1, 2, 3, 4].map((k) => (techo / 4) * k)}
            tickFormatter={(v: number) => formato(v)}
          />
          <Tooltip content={(p) => <TooltipDash {...p} formato={formato} />} />
          {series.map((s, k) =>
            k === 0 ? (
              <Area
                key={k}
                type="monotone"
                dataKey={`s${k}`}
                name={s.nombre}
                stroke={s.color}
                strokeWidth={2.5}
                strokeDasharray={s.punteada ? '6 4' : undefined}
                fill={s.color}
                fillOpacity={0.08}
                dot={s.valores.length <= 14}
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={k}
                type="monotone"
                dataKey={`s${k}`}
                name={s.nombre}
                stroke={s.color}
                strokeWidth={2.5}
                strokeDasharray={s.punteada ? '6 4' : undefined}
                dot={s.valores.length <= 14}
                isAnimationActive={false}
              />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Columnas ────────────────────────────────────────────────────────────────

export interface SerieColumna {
  nombre: string
  valores: number[]
  color: string
}

/** Columnas agrupadas (1–2 series) con tooltip por barra. */
export function GraficoColumnas({
  etiquetas,
  series,
  formato = fmtCompacto,
  alto = 240,
  titulo = 'Gráfico de columnas',
}: {
  etiquetas: string[]
  series: SerieColumna[]
  formato?: (n: number) => string
  alto?: number
  titulo?: string
}) {
  const maxV = Math.max(0, ...series.flatMap((s) => s.valores))
  const techo = techoEje(maxV)
  const paso = Math.max(1, Math.ceil(etiquetas.length / 12))
  const datos = etiquetas.map((e, i) => {
    const fila: Record<string, string | number> = { e }
    series.forEach((s, k) => {
      fila[`s${k}`] = s.valores[i] ?? 0
    })
    return fila
  })
  return (
    <div role="img" aria-label={titulo}>
      <Leyenda items={series} />
      <ResponsiveContainer width="100%" height={alto}>
        <BarChart data={datos} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={DashColors.linea} />
          <XAxis dataKey="e" tick={TICK} tickLine={false} axisLine={false} interval={paso - 1} />
          <YAxis
            width={54}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            domain={[0, techo]}
            ticks={[0, 1, 2, 3, 4].map((k) => (techo / 4) * k)}
            tickFormatter={(v: number) => formato(v)}
          />
          <Tooltip cursor={{ fill: 'rgba(27,36,48,0.05)' }} content={(p) => <TooltipDash {...p} formato={formato} />} />
          {series.map((s, k) => (
            <Bar
              key={k}
              dataKey={`s${k}`}
              name={s.nombre}
              fill={s.color}
              maxBarSize={etiquetas.length > 24 ? 8 : 18}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Dona ────────────────────────────────────────────────────────────────────

export interface Rebanada {
  nombre: string
  valor: number
}

/**
 * Dona con leyenda clicable (la leyenda también filtra). Muestra hasta [max]
 * entidades con su color fijo y agrupa el resto en "Otros".
 */
export function GraficoDona({
  datos,
  seleccionado,
  onTap,
  centro = '',
  formato = fmtCompacto,
  max = 7,
}: {
  datos: Rebanada[]
  seleccionado?: string | null
  onTap?: (nombre: string) => void
  centro?: string
  formato?: (n: number) => string
  max?: number
}) {
  const [hover, setHover] = useState(-1)
  const positivos = datos.filter((d) => d.valor > 0)
  if (!positivos.length) return <SinDatos />
  const visibles = positivos.slice(0, max)
  const resto = positivos.slice(max).reduce((s, d) => s + d.valor, 0)
  if (resto > 0) visibles.push({ nombre: 'Otros', valor: resto })
  const total = visibles.reduce((s, d) => s + d.valor, 0)
  const color = (r: Rebanada) => (r.nombre === 'Otros' ? DashColors.otros : DashColors.de(r.nombre))
  const h = hover >= 0 && hover < visibles.length ? visibles[hover] : null

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <div className="relative size-[190px] shrink-0" role="img" aria-label={`Distribución: ${visibles.map((v) => v.nombre).join(', ')}`}>
        <PieChart width={190} height={190}>
          <Pie
            data={visibles}
            dataKey="valor"
            nameKey="nombre"
            innerRadius={62}
            outerRadius={90}
            paddingAngle={2}
            stroke="none"
            isAnimationActive={false}
            onMouseEnter={(_, i) => setHover(i)}
            onMouseLeave={() => setHover(-1)}
            onClick={(_, i) => {
              const n = visibles[i]?.nombre
              if (n && n !== 'Otros') onTap?.(n)
            }}
          >
            {visibles.map((v, i) => (
              <Cell
                key={v.nombre}
                fill={color(v)}
                fillOpacity={hover >= 0 && hover !== i ? 0.55 : 1}
                style={{ cursor: v.nombre !== 'Otros' && onTap ? 'pointer' : 'default', outline: 'none' }}
              />
            ))}
          </Pie>
        </PieChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
          <div className="text-[15px] font-extrabold">{formato(h ? h.valor : total)}</div>
          <div className="text-[10px] text-ink-soft">{h ? fmtPct((h.valor / total) * 100) : centro}</div>
        </div>
      </div>
      <div className="min-w-[220px] flex-1">
        {visibles.map((v, i) => {
          const activo = seleccionado === v.nombre
          const clicable = v.nombre !== 'Otros' && !!onTap
          return (
            <button
              key={v.nombre}
              type="button"
              disabled={!clicable}
              aria-pressed={activo}
              onClick={() => onTap?.(v.nombre)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(-1)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left',
                activo ? 'bg-navy/10' : i === hover ? 'bg-muted' : '',
                clicable ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color(v) }} />
              <span className={cn('min-w-0 flex-1 truncate text-[12px]', activo ? 'font-bold' : 'font-medium')}>{v.nombre}</span>
              <span className="text-[12px] font-semibold">{formato(v.valor)}</span>
              <span className="w-12 text-right text-[11px] text-ink-soft">{fmtPct((v.valor / total) * 100)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Ranking ─────────────────────────────────────────────────────────────────

export interface FilaRanking {
  nombre: string
  valor: number
  detalle?: string
  valorTexto?: string
  color?: string
}

/** Ranking de barras horizontales; cada fila se puede tocar para filtrar. */
export function RankingBarras({
  filas,
  seleccionado,
  onTap,
  formato = fmtCompacto,
  mostrarPct = true,
  maxFilas = 10,
}: {
  filas: FilaRanking[]
  seleccionado?: string | null
  onTap?: (nombre: string) => void
  formato?: (n: number) => string
  mostrarPct?: boolean
  maxFilas?: number
}) {
  const lista = filas.filter((f) => f.valor > 0).slice(0, maxFilas)
  if (!lista.length) return <SinDatos />
  const total = filas.reduce((s, f) => s + f.valor, 0)
  const maxV = Math.max(...lista.map((f) => f.valor)) || 1
  return (
    <div>
      {lista.map((f) => {
        const activo = seleccionado === f.nombre
        const texto = f.valorTexto ?? formato(f.valor)
        return (
          <button
            key={f.nombre}
            type="button"
            disabled={!onTap}
            aria-pressed={onTap ? activo : undefined}
            onClick={() => onTap?.(f.nombre)}
            title={`${f.nombre}\n${texto}${f.detalle ? '\n' + f.detalle : ''}`}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left',
              activo && 'bg-navy/10',
              onTap ? 'cursor-pointer hover:bg-muted' : 'cursor-default',
            )}
          >
            <span className={cn('w-28 shrink-0 truncate text-[12px] sm:w-36', activo ? 'font-bold' : 'font-medium')}>{f.nombre}</span>
            <span className="relative h-3.5 min-w-0 flex-1 rounded bg-muted">
              <span
                className="absolute inset-y-0 left-0 rounded"
                style={{ width: `max(3px, ${(f.valor / maxV) * 100}%)`, backgroundColor: f.color ?? DashColors.real }}
              />
            </span>
            <span className="w-[78px] shrink-0 text-right text-[12px] font-bold">{texto}</span>
            {mostrarPct && (
              <span className="w-11 shrink-0 text-right text-[11px] text-ink-soft">{total === 0 ? '' : fmtPct((f.valor / total) * 100)}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Meta ────────────────────────────────────────────────────────────────────

/** Avance contra una meta, con marca del ritmo esperado. */
export function BarraMeta({
  titulo,
  real,
  meta,
  esperado,
  formato,
}: {
  titulo: string
  real: number
  meta: number
  /** Fracción del período ya transcurrida (0–1) para marcar el ritmo. */
  esperado: number
  formato: (n: number) => string
}) {
  const pct = meta <= 0 ? 0 : real / meta
  const ritmo = meta <= 0 || esperado <= 0 ? null : pct / esperado
  let c: string
  let txt: string
  if (meta <= 0) {
    c = DashColors.inkSoft
    txt = 'Sin meta'
  } else if (pct >= 1) {
    c = DashColors.bueno
    txt = 'Meta cumplida'
  } else if (ritmo == null) {
    c = DashColors.inkSoft
    txt = 'Por iniciar'
  } else if (ritmo >= 0.95) {
    c = DashColors.bueno
    txt = 'En ritmo'
  } else if (ritmo >= 0.75) {
    c = DashColors.alerta
    txt = 'Atención'
  } else {
    c = DashColors.malo
    txt = 'Rezagado'
  }
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{titulo}</span>
        <span className="text-[11px] font-bold" style={{ color: c }}>
          {txt}
        </span>
      </div>
      <div
        className="relative mt-1.5 h-4 rounded-full bg-muted"
        role="progressbar"
        aria-label={titulo}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(1, pct) * 100)}
      >
        <div className="h-full rounded-full" style={{ width: `${Math.min(1, Math.max(0, pct)) * 100}%`, backgroundColor: c }} />
        {meta > 0 && esperado > 0 && esperado < 1 && (
          <div className="absolute -top-[3px] -bottom-[3px] w-0.5 bg-ink" style={{ left: `calc(${esperado * 100}% - 1px)` }} title="Avance esperado a hoy" />
        )}
      </div>
      <div className="mt-1 flex items-center">
        <span className="text-[11px] text-ink-soft">
          {formato(real)} de {meta <= 0 ? '—' : formato(meta)}
        </span>
        <span className="flex-1" />
        <span className="text-[12px] font-extrabold" style={{ color: c }}>
          {meta <= 0 ? '' : fmtPct(pct * 100, 0)}
        </span>
      </div>
    </div>
  )
}

// ── Mapa de calor ───────────────────────────────────────────────────────────

/** Mapa de calor aseguradora × ramo (una sola rampa navy; la celda filtra por ambas). */
export function MapaCalor({
  filas,
  columnas,
  valores,
  onTap,
}: {
  filas: string[]
  columnas: string[]
  valores: Record<string, number>
  onTap?: (fila: string, columna: string) => void
}) {
  if (!filas.length || !columnas.length) return <SinDatos />
  const maxV = Math.max(0, ...Object.values(valores))
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse" style={{ tableLayout: 'fixed', width: 140 + columnas.length * 86 }}>
        <colgroup>
          <col style={{ width: 140 }} />
          {columnas.map((c) => (
            <col key={c} style={{ width: 86 }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th />
            {columnas.map((c) => (
              <th key={c} className="line-clamp-2 px-0.5 pb-1.5 text-center text-[10.5px] font-semibold text-ink-soft" title={c}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f}>
              <th scope="row" className="truncate pr-2 text-left text-[12px] font-semibold" title={f}>
                {f}
              </th>
              {columnas.map((c) => {
                const v = valores[`${f}||${c}`] ?? 0
                const t = maxV === 0 ? 0 : v / maxV
                const claro = t < 0.5 || v === 0
                return (
                  <td key={c} className="p-[1.5px]">
                    <button
                      type="button"
                      onClick={() => onTap?.(f, c)}
                      title={`${f} · ${c}\n${fmtMonto(v)}`}
                      className="flex h-[34px] w-full items-center justify-center rounded text-[10.5px] font-bold"
                      style={{
                        backgroundColor: v === 0 ? 'rgba(231,236,241,0.5)' : DashColors.secuencial(0.12 + t * 0.88),
                        color: claro ? '#1b2430' : '#fff',
                      }}
                    >
                      {v === 0 ? '' : fmtCompacto(v)}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Alerta ──────────────────────────────────────────────────────────────────

/** Fila de alerta/insight con ícono, texto y acción opcional. */
export function Alerta({
  icono,
  color,
  titulo,
  detalle,
  onTap,
}: {
  icono: ReactNode
  color: string
  titulo: string
  detalle: string
  onTap?: () => void
}) {
  const cuerpo = (
    <>
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4"
        style={{ color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
      >
        {icono}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold">{titulo}</span>
        <span className="block text-[12px] leading-snug text-ink-soft">{detalle}</span>
      </span>
      {onTap && <ChevronRight className="mt-1 size-[18px] shrink-0 text-ink-soft" />}
    </>
  )
  const clase = 'flex w-full items-start gap-2.5 rounded-lg px-1 py-1.5 text-left'
  return onTap ? (
    <button type="button" onClick={onTap} className={cn(clase, 'hover:bg-muted')}>
      {cuerpo}
    </button>
  ) : (
    <div className={clase}>{cuerpo}</div>
  )
}
