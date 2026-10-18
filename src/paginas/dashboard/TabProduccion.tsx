import { useMemo, useState } from 'react'
import { Chip } from '@/components/ui/basicos'
import { cn } from '@/lib/utils'
import { EncabezadoTab, TablaDash } from './comunes'
import { clTd, clTh, filaClicable } from './estilos'
import { filasDim, type CtxDash } from './contexto'
import { MESES_12, fmtCompacto, fmtEntero, fmtPct } from './formato'
import { DashColors } from './colores'
import { DashCard, GraficoColumnas, GraficoLineas, MapaCalor, RankingBarras, Rejilla, SinDatos } from './graficos'
import { DIMS, claveDim, etiquetaDim, ticketDe, valorDe, variacion, type Dim, type Resultado } from './motor'

export function TabProduccion({ c }: { c: CtxDash }) {
  const { r, f, motor } = c
  const [dim, setDim] = useState<Dim>('aseguradora')
  const anio = f.hasta.getFullYear()

  // Año en curso vs anterior (ignora el período; respeta los demás filtros).
  const ry = useMemo(
    () => motor.calcular({ ...f, desde: new Date(anio - 1, 0, 1), hasta: new Date(anio, 11, 31), comparar: 'ninguno' }),
    [motor, f, anio],
  )
  const mActual = ry.actual.primaMes.slice(12, 24)
  const mPrev = ry.actual.primaMes.slice(0, 12)
  const nMes = ry.actual.nMes.slice(12, 24)
  const nPrev = ry.actual.nMes.slice(0, 12)
  const hoy = new Date()
  // El año en curso no se grafica más allá del mes actual.
  const limite = anio === hoy.getFullYear() ? hoy.getMonth() + 1 : 12

  return (
    <div className="space-y-3.5">
      <EncabezadoTab titulo="Producción" periodo={`${c.periodoTxt}${c.compTxt ? `  ·  ${c.compTxt}` : ''}`} />
      <Rejilla anchoMinimo={520} maxColumnas={2}>
        <DashCard titulo={`Prima mensual: ${anio} vs ${anio - 1}`} subtitulo="Todo el año, con los filtros de arriba (sin el período)">
          <GraficoLineas
            titulo={`Prima mensual ${anio} contra ${anio - 1}`}
            etiquetas={MESES_12}
            series={[
              { nombre: String(anio), valores: mActual.slice(0, limite), color: DashColors.real },
              { nombre: String(anio - 1), valores: mPrev, color: DashColors.comparacion, punteada: true },
            ]}
          />
        </DashCard>
        <DashCard titulo={`Pólizas emitidas por mes: ${anio} vs ${anio - 1}`}>
          <GraficoColumnas
            titulo={`Pólizas emitidas por mes ${anio} contra ${anio - 1}`}
            etiquetas={MESES_12}
            formato={fmtEntero}
            series={[
              { nombre: String(anio - 1), valores: nPrev, color: DashColors.comparacion },
              { nombre: String(anio), valores: [...nMes.slice(0, limite), ...new Array<number>(12 - limite).fill(0)], color: DashColors.real },
            ]}
          />
        </DashCard>
      </Rejilla>
      <DashCard
        titulo="Explorador de producción"
        subtitulo={`Cambie la dimensión; toque una fila para filtrar todo el tablero${r.comp ? ' · variación contra la comparación' : ''}`}
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {DIMS.filter((d) => d !== 'cliente').map((d) => (
            <Chip key={d} activo={dim === d} onClick={() => setDim(d)}>
              {etiquetaDim(d)}
            </Chip>
          ))}
        </div>
        <TablaExplorador c={c} r={r} dim={dim} />
      </DashCard>
      <Rejilla anchoMinimo={520} maxColumnas={2}>
        <DashCard titulo="Aseguradora × ramo (prima)" subtitulo="Los 8 mayores de cada eje. Toque una celda para filtrar por ambos.">
          <MapaCalor
            filas={r.matrizFilas}
            columnas={r.matrizCols}
            valores={r.matriz}
            onTap={(fila, col) => c.cambiarFiltros((x) => ({ ...x, aseg: fila, ramo: col }))}
          />
        </DashCard>
        <DashCard titulo="Top productos" subtitulo="Por prima emitida">
          <RankingBarras filas={filasDim(r, 'producto')} maxFilas={12} seleccionado={f.prod} onTap={(n) => c.alternarDim('producto', n)} />
        </DashCard>
      </Rejilla>
    </div>
  )
}

function TablaExplorador({ c, r, dim }: { c: CtxDash; r: Resultado; dim: Dim }) {
  const comp = r.comp
  const total = r.actual.prima
  const conCom = c.abonos != null
  // Prima del período de comparación por grupo.
  const prev = useMemo(() => {
    const m = new Map<string, number>()
    if (comp) for (const p of comp.polizas) m.set(claveDim(p, dim), (m.get(claveDim(p, dim)) ?? 0) + p.primaPoliza)
    return m
  }, [comp, dim])
  const filas = r.porDim[dim].slice(0, 25)
  if (!filas.length) return <SinDatos />
  const mx = filas[0].prima === 0 ? 1 : filas[0].prima
  const elegido = valorDe(c.f, dim)
  return (
    <TablaDash className="min-w-[760px]">
      <thead>
        <tr className="border-b border-line text-left">
          <th className={clTh}>{etiquetaDim(dim)}</th>
          <th className={clTh}>Prima</th>
          <th className={cn(clTh, 'text-right')}>Pólizas</th>
          <th className={cn(clTh, 'text-right')}>Prima prom.</th>
          <th className={cn(clTh, 'text-right')}>% total</th>
          {comp && <th className={cn(clTh, 'text-right')}>Var.</th>}
          {conCom && <th className={cn(clTh, 'text-right')}>Comisión</th>}
        </tr>
      </thead>
      <tbody>
        {filas.map((g) => {
          const v = variacion(g.prima, prev.get(g.nombre))
          const activo = elegido === g.nombre
          return (
            <tr
              key={g.nombre}
              {...filaClicable(() => c.alternarDim(dim, g.nombre))}
              className={cn('cursor-pointer hover:bg-muted', activo && 'bg-navy/10')}
              aria-selected={activo}
            >
              <td className={cn(clTd, 'max-w-[220px] font-semibold')}>
                <span className="flex items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: DashColors.de(g.nombre) }} />
                  <span className="truncate" title={g.nombre}>
                    {g.nombre}
                  </span>
                </span>
              </td>
              <td className={clTd}>
                <span className="flex w-44 items-center gap-1.5">
                  <span className="h-2.5 rounded" style={{ width: `${Math.max(1, (g.prima / mx) * 100)}%`, backgroundColor: DashColors.real, maxWidth: 'calc(100% - 52px)', minWidth: 2 }} />
                  <span className="font-bold">{fmtCompacto(g.prima)}</span>
                </span>
              </td>
              <td className={cn(clTd, 'text-right')}>{fmtEntero(g.n)}</td>
              <td className={cn(clTd, 'text-right')}>{fmtCompacto(ticketDe(g))}</td>
              <td className={cn(clTd, 'text-right')}>{total === 0 ? '' : fmtPct((g.prima / total) * 100)}</td>
              {comp && (
                <td
                  className={cn(clTd, 'text-right font-bold')}
                  style={{ color: v == null ? DashColors.inkSoft : v >= 0 ? DashColors.bueno : DashColors.malo }}
                >
                  {v == null ? 'nuevo' : `${v >= 0 ? '+' : ''}${fmtPct(v, 0)}`}
                </td>
              )}
              {conCom && <td className={cn(clTd, 'text-right')}>{fmtCompacto(g.comision)}</td>}
            </tr>
          )
        })}
      </tbody>
    </TablaDash>
  )
}
