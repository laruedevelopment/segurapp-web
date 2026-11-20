import { useMemo } from 'react'
import { Crown, Repeat, Sparkles, Users } from 'lucide-react'
import { DashColors } from '@/paginas/dashboard/colores'
import { clTd, clTh } from '@/paginas/dashboard/estilos'
import { TablaDash } from '@/paginas/dashboard/comunes'
import { fmtEntero, fmtMonto, fmtPct, fmtPesosCompacto } from '@/paginas/dashboard/formato'
import { DashCard, GraficoColumnas, KpiTile, RankingBarras, Rejilla } from '@/paginas/dashboard/graficos'
import { cn } from '@/lib/utils'
import { alternarGrupo, type PropsTab } from './comun'
import { analizarClientes, nuevosYRecurrentes, resumenAsesores } from './clientesLogica'

export default function TabClientes({ filas, todas, filtros, cambiar, hoy }: PropsTab) {
  const a = useMemo(() => analizarClientes(filas), [filas])
  const nr = useMemo(() => nuevosYRecurrentes(filas, todas), [filas, todas])
  const asesores = useMemo(() => resumenAsesores(filas), [filas])
  const anioActual = hoy.getFullYear()
  const iActual = nr.anios.indexOf(anioActual)

  return (
    <div className="flex flex-col gap-4">
      <Rejilla anchoMinimo={220}>
        <KpiTile etiqueta="Clientes con póliza" valor={fmtEntero(a.clientes.length)} icono={<Users />} pie={`${fmtEntero(filas.length)} pólizas`} />
        <KpiTile etiqueta="Concentración top 10" valor={fmtPct(a.concentracionTop10 * 100, 0)} icono={<Crown />} color={DashColors.alerta} pie="% del valor póliza que explican los 10 mayores clientes" />
        <KpiTile etiqueta="Clientes nuevos este año" valor={fmtEntero(iActual >= 0 ? nr.nuevos[iActual] : 0)} icono={<Sparkles />} color={DashColors.bueno} pie={`Primera póliza en ${anioActual}`} />
        <KpiTile etiqueta="Clientes con un solo ramo" valor={fmtPct(a.pctUnSoloRamo * 100, 0)} icono={<Repeat />} color={DashColors.real} pie={`${fmtEntero(a.unSoloRamo)} clientes: oportunidad de venta cruzada`} />
      </Rejilla>

      <Rejilla anchoMinimo={340} maxColumnas={2}>
        <DashCard titulo="Concentración (Pareto)" subtitulo="% del valor póliza que explican los N mayores clientes">
          <GraficoColumnas
            titulo="Curva de concentración de clientes"
            etiquetas={a.pareto.map((p) => `Top ${p.corte}`)}
            series={[{ nombre: '% del valor', valores: a.pareto.map((p) => p.pct * 100), color: DashColors.real }]}
            formato={(n) => `${n.toFixed(0)}%`}
          />
        </DashCard>
        <DashCard titulo="Clientes nuevos y recurrentes" subtitulo="Por año de inicio. Nuevo = su primera póliza es de ese año">
          <GraficoColumnas
            titulo="Clientes nuevos y recurrentes por año"
            etiquetas={nr.anios.map(String)}
            series={[
              { nombre: 'Nuevos', valores: nr.nuevos, color: DashColors.bueno },
              { nombre: 'Recurrentes', valores: nr.recurrentes, color: DashColors.real },
            ]}
            formato={fmtEntero}
          />
        </DashCard>
      </Rejilla>

      <DashCard titulo="Top 15 clientes" subtitulo="Por valor póliza · toque una fila para filtrar">
        <RankingBarras
          filas={a.clientes.slice(0, 15).map((c) => ({
            nombre: c.nombre,
            valor: c.valor,
            valorTexto: fmtPesosCompacto(c.valor),
            detalle: `${fmtEntero(c.polizas)} ${c.polizas === 1 ? 'póliza' : 'pólizas'} · ${c.ramos} ${c.ramos === 1 ? 'ramo' : 'ramos'}`,
          }))}
          seleccionado={filtros.cliente.length === 1 ? filtros.cliente[0] : null}
          onTap={(n) => cambiar(alternarGrupo(filtros, 'cliente', n))}
          formato={fmtPesosCompacto}
          maxFilas={15}
        />
      </DashCard>

      <DashCard titulo="Detalle por asesor" subtitulo="Valor póliza, ticket promedio y clientes · toque una fila para filtrar">
        <TablaDash>
          <thead>
            <tr className="border-b border-line text-left">
              <th className={clTh}>Asesor</th>
              <th className={cn(clTh, 'text-right')}>Pólizas</th>
              <th className={cn(clTh, 'text-right')}>Clientes</th>
              <th className={cn(clTh, 'text-right')}>Valor póliza</th>
              <th className={cn(clTh, 'text-right')}>Peso</th>
              <th className={cn(clTh, 'text-right')}>Prima</th>
              <th className={cn(clTh, 'text-right')}>Ticket</th>
            </tr>
          </thead>
          <tbody>
            {asesores.map((g) => (
              <tr key={g.nombre} className={cn('cursor-pointer hover:bg-muted', filtros.asesor.length === 1 && filtros.asesor[0] === g.nombre && 'bg-navy-soft')} onClick={() => cambiar(alternarGrupo(filtros, 'asesor', g.nombre))}>
                <td className={clTd}>{g.nombre}</td>
                <td className={cn(clTd, 'num text-right')}>{fmtEntero(g.polizas)}</td>
                <td className={cn(clTd, 'num text-right')}>{fmtEntero(g.clientes)}</td>
                <td className={cn(clTd, 'num text-right')}>{fmtMonto(g.valor)}</td>
                <td className={cn(clTd, 'num text-right')}>{fmtPct(g.peso * 100)}</td>
                <td className={cn(clTd, 'num text-right')}>{fmtMonto(g.prima)}</td>
                <td className={cn(clTd, 'num text-right')}>{fmtMonto(g.ticket)}</td>
              </tr>
            ))}
          </tbody>
        </TablaDash>
      </DashCard>
    </div>
  )
}
