import { useMemo, useState } from 'react'
import { Banknote, CircleCheck, Hourglass, PiggyBank, Percent } from 'lucide-react'
import { Aviso, Chip, Cargando } from '@/components/ui/basicos'
import { useAbonosDashboard } from '@/datos/dashboard'
import { DashColors } from '@/paginas/dashboard/colores'
import { clTd, clTh, filaClicable } from '@/paginas/dashboard/estilos'
import { TablaDash } from '@/paginas/dashboard/comunes'
import { fmtEntero, fmtMonto, fmtPct, fmtPesosCompacto } from '@/paginas/dashboard/formato'
import { DashCard, GraficoColumnas, KpiTile, RankingBarras, Rejilla, SinDatos } from '@/paginas/dashboard/graficos'
import { cn } from '@/lib/utils'
import { alternarGrupo, type PropsTab } from './comun'
import { PERIODOS_PAGOS, calcularCartera, calcularRecaudo, rangoPagos, type PeriodoPagos } from './carteraLogica'

/** Cartera por recaudar y comisión recibida de las pólizas filtradas (reglas del Dashboard gerencial). */
export default function TabCartera({ filas, filtros, cambiar, hoy }: PropsTab) {
  const abonos = useAbonosDashboard()
  const [periodo, setPeriodo] = useState<PeriodoPagos>('12m')
  const cartera = useMemo(() => calcularCartera(filas, hoy), [filas, hoy])
  const rec = useMemo(() => (abonos.data ? calcularRecaudo(filas, abonos.data, rangoPagos(periodo, hoy)) : null), [filas, abonos.data, periodo, hoy])

  const agingFilas = cartera.aging.map((a) => ({
    nombre: a.nombre,
    valor: a.saldo,
    valorTexto: fmtPesosCompacto(a.saldo),
    detalle: `${fmtEntero(a.polizas)} pólizas`,
    color: a.nombre === 'Más de 180' || a.nombre === '91–180 días' ? DashColors.malo : a.nombre === '61–90 días' ? DashColors.alerta : DashColors.real,
  }))
  const deudores = cartera.deudores.map((d) => ({
    nombre: d.nombre,
    valor: d.saldo,
    valorTexto: fmtPesosCompacto(d.saldo),
    detalle: `${fmtEntero(d.polizas)} ${d.polizas === 1 ? 'póliza' : 'pólizas'} con saldo`,
  }))

  return (
    <div className="flex flex-col gap-4">
      <Aviso tono="navy">
        <b>Cartera</b> = prima de las pólizas no anuladas − prima ya pagada. Sigue los filtros de arriba. <b>Recaudo y comisión</b> = pagos registrados con fecha dentro del período que elija aquí.
      </Aviso>

      <Rejilla anchoMinimo={220}>
        <KpiTile etiqueta="Prima emitida" valor={fmtPesosCompacto(cartera.prima)} valorExacto={fmtMonto(cartera.prima)} icono={<Banknote />} />
        <KpiTile
          etiqueta="Ya recaudada"
          valor={fmtPesosCompacto(cartera.pagada)}
          valorExacto={fmtMonto(cartera.pagada)}
          icono={<CircleCheck />}
          color={DashColors.bueno}
          pie={`${fmtPct(cartera.pctRecaudo * 100, 0)} de lo emitido`}
        />
        <KpiTile
          etiqueta="Por recaudar"
          valor={fmtPesosCompacto(cartera.saldo)}
          valorExacto={fmtMonto(cartera.saldo)}
          icono={<Hourglass />}
          color={DashColors.alerta}
          pie={`${fmtEntero(cartera.polizasConSaldo)} pólizas con saldo`}
          subirEsBueno={false}
        />
      </Rejilla>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold">Pagos del período:</span>
        {PERIODOS_PAGOS.map((p) => (
          <Chip key={p.id} activo={periodo === p.id} onClick={() => setPeriodo(p.id)}>{p.texto}</Chip>
        ))}
      </div>

      {abonos.isPending ? (
        <Cargando texto="Cargando los pagos…" />
      ) : abonos.isError || !rec ? (
        <Aviso>No se pudieron cargar los pagos. Recargue los datos con el botón de arriba e intente de nuevo.</Aviso>
      ) : (
        <>
          <Rejilla anchoMinimo={220}>
            <KpiTile etiqueta="Prima recaudada (período)" valor={fmtPesosCompacto(rec.recaudo)} valorExacto={fmtMonto(rec.recaudo)} icono={<PiggyBank />} color={DashColors.bueno} pie={`${fmtEntero(rec.pagos)} pagos`} />
            <KpiTile etiqueta="Comisión recibida (período)" valor={fmtPesosCompacto(rec.comision)} valorExacto={fmtMonto(rec.comision)} icono={<Banknote />} color={DashColors.real} />
            <KpiTile etiqueta="Comisión efectiva" valor={fmtPct(rec.efectiva * 100, 1)} icono={<Percent />} pie="Comisión recibida ÷ prima recaudada" />
          </Rejilla>

          <DashCard titulo={rec.etiquetas.length > 12 || periodo === 'todo' ? 'Recaudo y comisión por año' : 'Recaudo y comisión por mes'} subtitulo="Pagos registrados con fecha en el período">
            <GraficoColumnas
              titulo="Recaudo y comisión"
              etiquetas={rec.etiquetas}
              series={[
                { nombre: 'Prima recaudada', valores: rec.serieRecaudo, color: DashColors.real },
                { nombre: 'Comisión recibida', valores: rec.serieComision, color: DashColors.bueno },
              ]}
              formato={fmtPesosCompacto}
            />
          </DashCard>

          <DashCard titulo="Rentabilidad por aseguradora" subtitulo="Comisión efectiva = comisión recibida ÷ prima recaudada · toque una fila para filtrar">
            {rec.porAseguradora.length === 0 ? (
              <SinDatos />
            ) : (
              <TablaDash>
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className={clTh}>Aseguradora</th>
                    <th className={cn(clTh, 'text-right')}>Pagos</th>
                    <th className={cn(clTh, 'text-right')}>Prima recaudada</th>
                    <th className={cn(clTh, 'text-right')}>Comisión</th>
                    <th className={cn(clTh, 'text-right')}>Comisión efectiva</th>
                  </tr>
                </thead>
                <tbody>
                  {rec.porAseguradora.map((g) => (
                    <tr key={g.nombre} {...filaClicable(() => cambiar(alternarGrupo(filtros, 'aseg', g.nombre)))} className={cn('hover:bg-muted', filtros.aseg.length === 1 && filtros.aseg[0] === g.nombre && 'bg-navy-soft')}>
                      <td className={clTd}>{g.nombre}</td>
                      <td className={cn(clTd, 'num text-right')}>{fmtEntero(g.pagos)}</td>
                      <td className={cn(clTd, 'num text-right')}>{fmtMonto(g.recaudo)}</td>
                      <td className={cn(clTd, 'num text-right')}>{fmtMonto(g.comision)}</td>
                      <td className={cn(clTd, 'num text-right font-semibold')}>{fmtPct(g.efectiva * 100, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </TablaDash>
            )}
          </DashCard>
        </>
      )}

      <Rejilla anchoMinimo={340} maxColumnas={2}>
        <DashCard titulo="Antigüedad de la cartera por recaudar" subtitulo="Días desde el inicio de vigencia de cada póliza con saldo">
          <RankingBarras filas={agingFilas} formato={fmtPesosCompacto} maxFilas={6} />
        </DashCard>
        <DashCard titulo="Mayores saldos por cliente" subtitulo="Prima aún sin recaudar · toque una fila para filtrar">
          <RankingBarras
            filas={deudores}
            seleccionado={filtros.cliente.length === 1 ? filtros.cliente[0] : null}
            onTap={(n) => cambiar(alternarGrupo(filtros, 'cliente', n))}
            formato={fmtPesosCompacto}
            maxFilas={15}
          />
        </DashCard>
      </Rejilla>
    </div>
  )
}
