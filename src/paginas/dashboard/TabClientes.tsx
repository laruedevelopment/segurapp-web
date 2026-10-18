import { useMemo } from 'react'
import { Network, PieChart, UserPlus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EncabezadoTab, TablaDash } from './comunes'
import { clTd, clTh, filaClicable } from './estilos'
import { filasDim, type CtxDash } from './contexto'
import { fmtEntero, fmtMonto, fmtPct, fmtPesosCompacto } from './formato'
import { DashColors } from './colores'
import { DashCard, GraficoDona, GraficoLineas, KpiTile, RankingBarras, Rejilla, SinDatos } from './graficos'
import { soloDia, ticketDe, ventaCruzada } from './motor'

export function TabClientes({ c }: { c: CtxDash }) {
  const { r, f } = c
  const a = r.actual
  const totalCli = r.clientesNuevos + r.clientesRecurrentes
  const cross = useMemo(() => ventaCruzada(c.polizas, soloDia(new Date())), [c.polizas])
  const conCom = c.abonos != null
  const serie = DashColors.serie

  return (
    <div className="space-y-3.5">
      <EncabezadoTab titulo="Clientes y asesores" periodo={`${c.periodoTxt}${c.compTxt ? `  ·  ${c.compTxt}` : ''}`} />
      <Rejilla anchoMinimo={230}>
        <KpiTile
          etiqueta="Clientes con póliza en el período"
          valor={fmtEntero(a.clientes)}
          icono={<Users />}
          color={serie[2]}
          pie={`${fmtEntero(r.clientesNuevos)} nuevos · ${fmtEntero(r.clientesRecurrentes)} recurrentes`}
        />
        <KpiTile
          etiqueta="Concentración top 10 clientes"
          valor={fmtPct(r.concentracionTop10, 0)}
          icono={<PieChart />}
          color={r.concentracionTop10 > 50 ? DashColors.alerta : DashColors.real}
          subirEsBueno={false}
          pie={r.concentracionTop10 > 50 ? 'Riesgo: dependencia alta' : 'Cartera diversificada'}
        />
        <KpiTile
          etiqueta="Prima de clientes nuevos"
          valor={fmtPesosCompacto(r.primaNuevos)}
          valorExacto={fmtMonto(r.primaNuevos)}
          icono={<UserPlus />}
          color={serie[0]}
          pie={a.prima === 0 ? null : `${fmtPct((r.primaNuevos / a.prima) * 100, 0)} de la prima`}
        />
        <KpiTile
          etiqueta="Clientes con 1 solo ramo"
          valor={cross[0] === 0 ? '—' : fmtPct((cross[1] / cross[0]) * 100, 0)}
          icono={<Network />}
          color={serie[1]}
          pie={`oportunidad de venta cruzada (${fmtEntero(cross[1])} de ${fmtEntero(cross[0])})`}
        />
      </Rejilla>
      <Rejilla anchoMinimo={520} maxColumnas={2}>
        <DashCard titulo="Ranking de asesores" subtitulo="Prima emitida en el período. Toque para filtrar.">
          <RankingBarras filas={filasDim(r, 'asesor')} maxFilas={15} seleccionado={f.asesor} onTap={(n) => c.alternarDim('asesor', n)} />
        </DashCard>
        <DashCard titulo="Top 15 clientes" subtitulo="Por prima emitida en el período">
          <RankingBarras
            filas={r.clientesTop.map((x) => ({ nombre: x.nombre, valor: x.prima, detalle: `${x.n} pólizas`, color: DashColors.real }))}
            maxFilas={15}
            seleccionado={f.cliente}
            onTap={(n) => c.alternarDim('cliente', n)}
          />
        </DashCard>
      </Rejilla>
      <Rejilla anchoMinimo={520} maxColumnas={2}>
        <DashCard titulo="Curva de concentración (Pareto)" subtitulo="% de la prima que explican los N mayores clientes">
          {r.pareto.length < 2 ? (
            <SinDatos />
          ) : (
            <GraficoLineas
              titulo="Curva de concentración de clientes"
              etiquetas={r.pareto.map((_, i) => String(i + 1))}
              series={[{ nombre: '% acumulado', valores: r.pareto, color: DashColors.real }]}
              formato={(v) => `${Math.round(v)}%`}
            />
          )}
        </DashCard>
        <DashCard titulo="Clientes nuevos vs recurrentes" subtitulo="Nuevo = su primera póliza en el sistema cae dentro del período">
          <GraficoDona
            datos={[
              { nombre: 'Nuevos', valor: r.clientesNuevos },
              { nombre: 'Recurrentes', valor: r.clientesRecurrentes },
            ]}
            centro={`clientes (${totalCli})`}
            formato={fmtEntero}
          />
        </DashCard>
      </Rejilla>
      <DashCard titulo="Detalle por asesor" subtitulo={`Producción, ticket y ${conCom ? 'comisión recibida' : 'participación'}`}>
        <TablaAsesores c={c} />
      </DashCard>
    </div>
  )
}

function TablaAsesores({ c }: { c: CtxDash }) {
  const conCom = c.abonos != null
  const total = c.r.actual.prima
  const filas = c.r.porDim.asesor.slice(0, 30)
  if (!filas.length) return <SinDatos />
  return (
    <TablaDash>
      <thead>
        <tr className="border-b border-line text-left">
          <th className={clTh}>Asesor</th>
          <th className={cn(clTh, 'text-right')}>Pólizas</th>
          <th className={cn(clTh, 'text-right')}>Prima</th>
          <th className={cn(clTh, 'text-right')}>Prima prom.</th>
          <th className={cn(clTh, 'text-right')}>% total</th>
          {conCom && <th className={cn(clTh, 'text-right')}>Comisión recibida</th>}
          {conCom && <th className={cn(clTh, 'text-right')}>Recaudo</th>}
        </tr>
      </thead>
      <tbody>
        {filas.map((x) => {
          const activo = c.f.asesor === x.nombre
          return (
            <tr key={x.nombre} {...filaClicable(() => c.alternarDim('asesor', x.nombre))} className={cn('cursor-pointer hover:bg-muted', activo && 'bg-navy/10')} aria-selected={activo}>
              <td className={cn(clTd, 'font-semibold')}>{x.nombre}</td>
              <td className={cn(clTd, 'num text-right')}>{fmtEntero(x.n)}</td>
              <td className={cn(clTd, 'num text-right')}>{fmtMonto(x.prima)}</td>
              <td className={cn(clTd, 'num text-right')}>{fmtMonto(ticketDe(x))}</td>
              <td className={cn(clTd, 'text-right')}>{total === 0 ? '' : fmtPct((x.prima / total) * 100)}</td>
              {conCom && <td className={cn(clTd, 'num text-right')}>{fmtMonto(x.comision)}</td>}
              {conCom && <td className={cn(clTd, 'num text-right')}>{fmtMonto(x.recaudo)}</td>}
            </tr>
          )
        })}
      </tbody>
    </TablaDash>
  )
}
