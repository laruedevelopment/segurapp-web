import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, CalendarClock, Clock, RefreshCw, TriangleAlert } from 'lucide-react'
import { Chip } from '@/components/ui/basicos'
import { DashColors } from '@/paginas/dashboard/colores'
import { clTd, clTh } from '@/paginas/dashboard/estilos'
import { TablaDash } from '@/paginas/dashboard/comunes'
import { fmtEntero, fmtMonto, fmtPct, fmtPesosCompacto } from '@/paginas/dashboard/formato'
import { DashCard, GraficoColumnas, KpiTile, Rejilla, SinDatos } from '@/paginas/dashboard/graficos'
import { fmtFecha } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import { alternarGrupo, type PropsTab } from './comun'
import { diasVence, valorDe, type Medida } from './logica'
import { analizarRenovacion, vencePorMes, type GrupoRenovacion } from './renovacionLogica'

const dia = (hoy: Date, n: number) => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + n)

function TablaRenovacion({ grupos, onTap, seleccionado }: { grupos: GrupoRenovacion[]; onTap: (n: string) => void; seleccionado: string | null }) {
  if (!grupos.length) return <SinDatos texto="Se necesitan al menos 3 pólizas vencidas por grupo en los últimos 12 meses" />
  return (
    <TablaDash>
      <thead>
        <tr className="border-b border-line text-left">
          <th className={clTh}>Nombre</th>
          <th className={cn(clTh, 'text-right')}>Vencidas</th>
          <th className={cn(clTh, 'text-right')}>Renovadas</th>
          <th className={cn(clTh, 'text-right')}>Tasa</th>
        </tr>
      </thead>
      <tbody>
        {grupos.map((g) => (
          <tr key={g.nombre} className={cn('cursor-pointer hover:bg-muted', seleccionado === g.nombre && 'bg-navy-soft')} onClick={() => onTap(g.nombre)}>
            <td className={clTd}>{g.nombre}</td>
            <td className={cn(clTd, 'num text-right')}>{fmtEntero(g.vencidas)}</td>
            <td className={cn(clTd, 'num text-right')}>{fmtEntero(g.renovadas)}</td>
            <td className={cn(clTd, 'num text-right font-semibold')} style={{ color: g.tasa >= 0.7 ? DashColors.bueno : g.tasa >= 0.5 ? DashColors.alerta : DashColors.malo }}>
              {fmtPct(g.tasa * 100, 0)}
            </td>
          </tr>
        ))}
      </tbody>
    </TablaDash>
  )
}

export default function TabRenovaciones({ filas, todas, filtros, cambiar, hoy }: PropsTab) {
  const [medida, setMedida] = useState<Medida>('valor')
  const an = useMemo(() => analizarRenovacion(filas, todas, hoy), [filas, todas, hoy])
  const meses = useMemo(() => vencePorMes(filas, hoy, 12), [filas, hoy])
  const cuenta = (a: number, b: number) =>
    filas.filter((r) => {
      const d = diasVence(r, hoy)
      return d != null && d >= a && d <= b
    }).length
  const ir = (a: number, b: number) => cambiar({ ffinRango: { desde: dia(hoy, a), hasta: dia(hoy, b) }, ffinRel: null, estado: 'todas' })
  const serie = medida === 'valor' ? meses.valor : medida === 'prima' ? meses.prima : meses.registros
  const fmt = medida === 'registros' ? fmtEntero : fmtPesosCompacto

  return (
    <div className="flex flex-col gap-4">
      <Rejilla anchoMinimo={210}>
        <KpiTile etiqueta="Vencen en 0–30 días" valor={fmtEntero(cuenta(0, 30))} icono={<AlertTriangle />} color={DashColors.malo} onTap={() => ir(0, 30)} />
        <KpiTile etiqueta="Vencen en 31–60 días" valor={fmtEntero(cuenta(31, 60))} icono={<Clock />} color={DashColors.alerta} onTap={() => ir(31, 60)} />
        <KpiTile etiqueta="Vencen en 61–90 días" valor={fmtEntero(cuenta(61, 90))} icono={<CalendarClock />} color={DashColors.real} onTap={() => ir(61, 90)} />
        <KpiTile
          etiqueta="Tasa de renovación (12 meses)"
          valor={fmtPct(an.tasa * 100, 0)}
          icono={<RefreshCw />}
          color={an.tasa >= 0.7 ? DashColors.bueno : an.tasa >= 0.5 ? DashColors.alerta : DashColors.malo}
          pie={`${fmtEntero(an.renovadas)} de ${fmtEntero(an.vencidas)} vencidas tienen una póliza posterior`}
        />
        <KpiTile
          etiqueta="Vencidas hace menos de 90 días sin renovar"
          valor={fmtEntero(an.sinRenovar.length)}
          icono={<TriangleAlert />}
          color={DashColors.malo}
          pie={`${fmtPesosCompacto(an.sinRenovar.reduce((s, r) => s + valorDe(r), 0))} en valor póliza`}
        />
      </Rejilla>

      <DashCard
        titulo="Vencimientos de los próximos 12 meses"
        subtitulo="Lo que vence cada mes: la renovación de mañana"
        accion={
          <div className="flex gap-1.5">
            {([['valor', 'Valor póliza'], ['prima', 'Prima'], ['registros', 'Cantidad']] as [Medida, string][]).map(([m, t]) => (
              <Chip key={m} activo={medida === m} onClick={() => setMedida(m)}>{t}</Chip>
            ))}
          </div>
        }
      >
        <GraficoColumnas titulo="Vencimientos por mes" etiquetas={meses.etiquetas} series={[{ nombre: medida === 'registros' ? 'Pólizas' : medida === 'prima' ? 'Prima' : 'Valor póliza', valores: serie, color: DashColors.real }]} formato={fmt} />
      </DashCard>

      <Rejilla anchoMinimo={340} maxColumnas={2}>
        <DashCard titulo="Renovación por aseguradora" subtitulo="Pólizas vencidas en los últimos 12 meses · mínimo 3 · toque para filtrar">
          <TablaRenovacion grupos={an.porAseguradora} seleccionado={filtros.aseg.length === 1 ? filtros.aseg[0] : null} onTap={(n) => cambiar(alternarGrupo(filtros, 'aseg', n))} />
        </DashCard>
        <DashCard titulo="Renovación por asesor" subtitulo="Pólizas vencidas en los últimos 12 meses · mínimo 3 · toque para filtrar">
          <TablaRenovacion grupos={an.porAsesor} seleccionado={filtros.asesor.length === 1 ? filtros.asesor[0] : null} onTap={(n) => cambiar(alternarGrupo(filtros, 'asesor', n))} />
        </DashCard>
      </Rejilla>

      <DashCard titulo="Vencidas hace menos de 90 días sin renovar" subtitulo="Oportunidad de recuperación: mayor valor primero · los 50 primeros · toque el código para abrir la póliza">
        {an.sinRenovar.length === 0 ? (
          <SinDatos texto="No hay pólizas vencidas sin renovar en este período" />
        ) : (
          <TablaDash>
            <thead>
              <tr className="border-b border-line text-left">
                <th className={clTh}>Código</th>
                <th className={clTh}>Cliente</th>
                <th className={clTh}>Bien asegurado</th>
                <th className={clTh}>Aseguradora</th>
                <th className={clTh}>Asesor</th>
                <th className={clTh}>Venció</th>
                <th className={cn(clTh, 'text-right')}>Valor póliza</th>
              </tr>
            </thead>
            <tbody>
              {an.sinRenovar.slice(0, 50).map((r) => (
                <tr key={r.p.id} className="hover:bg-muted">
                  <td className={clTd}>
                    <Link to={`/polizas/${r.p.id}`} className="num font-semibold text-navy underline-offset-2 hover:underline">{r.p.id}</Link>
                  </td>
                  <td className={cn(clTd, 'max-w-[220px] truncate')} title={r.p.nombre_cliente ?? ''}>{r.p.nombre_cliente ?? '—'}</td>
                  <td className={cn(clTd, 'max-w-[160px] truncate')} title={r.p.bien_asegurado ?? ''}>{r.p.bien_asegurado ?? '—'}</td>
                  <td className={clTd}>{r.p.nombre_aseg ?? '—'}</td>
                  <td className={clTd}>{r.p.nombre_asesor ?? '—'}</td>
                  <td className={cn(clTd, 'num')}>{fmtFecha(r.ffin)}</td>
                  <td className={cn(clTd, 'num text-right')}>{fmtMonto(valorDe(r))}</td>
                </tr>
              ))}
            </tbody>
          </TablaDash>
        )}
      </DashCard>
    </div>
  )
}
