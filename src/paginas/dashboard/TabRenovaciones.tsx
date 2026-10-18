import { Link } from 'react-router'
import { CalendarClock, Clock, RefreshCw, TriangleAlert } from 'lucide-react'
import { fmtFecha } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import { EncabezadoTab, TablaDash } from './comunes'
import { clTd, clTh } from './estilos'
import type { CtxDash } from './contexto'
import { etiquetasMeses, fmtEntero, fmtMonto, fmtPct, fmtPesosCompacto } from './formato'
import { DashColors } from './colores'
import { DashCard, GraficoColumnas, KpiTile, RankingBarras, Rejilla, SinDatos, type FilaRanking } from './graficos'
import type { FilaPoliza, Grupo } from './motor'

const porTasa = (l: Grupo[]) => l.filter((g) => g.n >= 3).sort((a, b) => b.prima / b.n - a.prima / a.n)

function filasTasa(l: Grupo[]): FilaRanking[] {
  return l.slice(0, 10).map((g) => {
    const t = g.prima / g.n
    return {
      nombre: g.nombre,
      valor: t * 100,
      valorTexto: fmtPct(t * 100, 0),
      detalle: `${Math.round(g.prima)} de ${g.n} renovadas`,
      color: t >= 0.7 ? DashColors.bueno : t >= 0.5 ? DashColors.alerta : DashColors.malo,
    }
  })
}

function TablaPolizas({ filas, colDias }: { filas: FilaPoliza[]; colDias: string }) {
  if (!filas.length) return <SinDatos />
  return (
    <TablaDash>
      <thead>
        <tr className="border-b border-line text-left">
          <th className={clTh}>Póliza</th>
          <th className={clTh}>Cliente</th>
          <th className={clTh}>Aseguradora</th>
          <th className={clTh}>Asesor</th>
          <th className={clTh}>Vence</th>
          <th className={cn(clTh, 'text-right')}>{colDias}</th>
          <th className={cn(clTh, 'text-right')}>Prima</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((x) => (
          <tr key={x.p.id} className="hover:bg-muted">
            <td className={clTd}>
              <Link to={`/polizas/${x.p.id}`} className="num font-semibold text-navy underline-offset-2 hover:underline">
                {x.p.nroPoliza ?? '—'}
              </Link>
            </td>
            <td className={cn(clTd, 'max-w-[200px] truncate')} title={x.p.nombreCliente ?? ''}>
              {x.p.nombreCliente ?? '—'}
            </td>
            <td className={clTd}>{x.p.nombreAseg ?? '—'}</td>
            <td className={clTd}>{x.p.nombreAsesor ?? '—'}</td>
            <td className={cn(clTd, 'num')}>{x.p.ffinPoliza ? fmtFecha(x.p.ffinPoliza) : '—'}</td>
            <td className={cn(clTd, 'num text-right')}>{x.dias}</td>
            <td className={cn(clTd, 'num text-right')}>{fmtMonto(x.valor)}</td>
          </tr>
        ))}
      </tbody>
    </TablaDash>
  )
}

export function TabRenovaciones({ c }: { c: CtxDash }) {
  const { r } = c
  const tasa = r.tasaRenovacion
  const etiq = etiquetasMeses(r.mesesFuturos)
  const ren = porTasa(r.renPorAseg)
  const renAsesor = porTasa(r.renPorAsesor)

  return (
    <div className="space-y-3.5">
      <EncabezadoTab
        titulo="Renovaciones"
        periodo={c.periodoTxt}
        sub="Vencimientos futuros desde hoy (respetan los filtros). La tasa de renovación es una estimación: se cuenta como renovada la póliza vencida en el período si el cliente tiene otra del mismo ramo que arranca cerca de su fin."
      />
      <Rejilla anchoMinimo={230}>
        <KpiTile
          etiqueta="Vencen en 0–30 días"
          valor={fmtEntero(r.vence30[0])}
          icono={<TriangleAlert />}
          color={DashColors.malo}
          pie={`${fmtPesosCompacto(r.vence30[1])} en prima`}
        />
        <KpiTile
          etiqueta="Vencen en 31–60 días"
          valor={fmtEntero(r.vence60[0])}
          icono={<Clock />}
          color={DashColors.alerta}
          pie={`${fmtPesosCompacto(r.vence60[1])} en prima`}
        />
        <KpiTile
          etiqueta="Vencen en 61–90 días"
          valor={fmtEntero(r.vence90[0])}
          icono={<CalendarClock />}
          color={DashColors.serie[3]}
          pie={`${fmtPesosCompacto(r.vence90[1])} en prima`}
        />
        <KpiTile
          etiqueta="Tasa de renovación (estimada)"
          valor={tasa == null ? '—' : fmtPct(tasa * 100, 0)}
          icono={<RefreshCw />}
          color={tasa == null ? DashColors.inkSoft : tasa >= 0.7 ? DashColors.bueno : tasa >= 0.5 ? DashColors.alerta : DashColors.malo}
          pie={r.renBase === 0 ? 'ninguna venció en el período' : `${r.renRenovadas} de ${r.renBase} vencidas en el período`}
        />
      </Rejilla>
      <Rejilla anchoMinimo={520} maxColumnas={2}>
        <DashCard titulo="Vencimientos de los próximos 12 meses" subtitulo="Prima de las pólizas que vencen cada mes (la renovación de mañana)">
          <GraficoColumnas
            titulo="Prima que vence cada mes"
            etiquetas={etiq}
            series={[{ nombre: 'Prima que vence', valores: r.vencePrima, color: DashColors.real }]}
          />
        </DashCard>
        <DashCard titulo="Cantidad que vence por mes">
          <GraficoColumnas
            titulo="Cantidad de pólizas que vence cada mes"
            etiquetas={etiq}
            formato={fmtEntero}
            series={[{ nombre: 'Pólizas', valores: r.venceN, color: DashColors.serie[3] }]}
          />
        </DashCard>
      </Rejilla>
      <Rejilla anchoMinimo={520} maxColumnas={2}>
        <DashCard titulo="Renovación por aseguradora" subtitulo="Mínimo 3 pólizas vencidas en el período">
          <RankingBarras filas={filasTasa(ren)} mostrarPct={false} />
        </DashCard>
        <DashCard titulo="Renovación por asesor" subtitulo="Mínimo 3 pólizas vencidas en el período">
          <RankingBarras filas={filasTasa(renAsesor)} mostrarPct={false} />
        </DashCard>
      </Rejilla>
      <DashCard titulo="A renovar en los próximos 30 días" subtitulo="Ordenadas por fecha de vencimiento · toque el número para abrir la póliza">
        <TablaPolizas filas={r.porRenovar30} colDias="Días" />
      </DashCard>
      <DashCard
        titulo="Vencidas en los últimos 90 días sin renovar"
        subtitulo="Oportunidad de recuperación, mayor prima primero · toque el número para abrir la póliza"
      >
        <TablaPolizas filas={r.sinRenovar90} colDias="Días vencida" />
      </DashCard>
    </div>
  )
}
