import { Banknote, CircleCheck, Hourglass, PiggyBank } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EncabezadoTab, TablaDash } from './comunes'
import { clTd, clTh, filaClicable } from './estilos'
import { filasDim, type CtxDash } from './contexto'
import { etiquetasMeses, fmtMonto, fmtPct, fmtPesosCompacto } from './formato'
import { DashColors } from './colores'
import { DashCard, GraficoColumnas, KpiTile, RankingBarras, Rejilla, SinDatos } from './graficos'
import { variacion } from './motor'

export function TabCartera({ c }: { c: CtxDash }) {
  const { r, f, abonos } = c
  const a = r.actual
  const comp = r.comp
  if (abonos == null) {
    return (
      <div className="space-y-3.5">
        <EncabezadoTab titulo="Cartera y recaudo" periodo={c.periodoTxt} />
        <DashCard titulo="Sin datos de pagos">
          <p className="text-[13px]">No se pudieron cargar los pagos. Use «Actualizar» e intente de nuevo.</p>
        </DashCard>
      </div>
    )
  }
  const pctRec = r.carteraPrima === 0 ? 0 : (r.carteraPagada / r.carteraPrima) * 100
  const agingFilas = r.aging.map(([k, v]) => ({
    nombre: k,
    valor: v,
    color: k === 'Más de 180' || k === '91–180 días' ? DashColors.malo : k === '61–90 días' ? DashColors.alerta : DashColors.real,
  }))
  const etiq = etiquetasMeses(r.meses)
  const rentab = r.porDim.aseguradora.filter((x) => x.recaudo > 0).sort((x, y) => y.comision - x.comision)

  return (
    <div className="space-y-3.5">
      <EncabezadoTab
        titulo="Cartera y recaudo"
        periodo={c.periodoTxt}
        sub="Cartera = prima emitida en el período − prima ya recaudada (pólizas no anuladas). Recaudo y comisión = pagos registrados con fecha dentro del período."
      />
      <Rejilla anchoMinimo={230}>
        <KpiTile etiqueta="Prima emitida (período)" valor={fmtPesosCompacto(r.carteraPrima)} valorExacto={fmtMonto(r.carteraPrima)} icono={<Banknote />} />
        <KpiTile
          etiqueta="Ya recaudada"
          valor={fmtPesosCompacto(r.carteraPagada)}
          valorExacto={fmtMonto(r.carteraPagada)}
          icono={<CircleCheck />}
          color={DashColors.bueno}
          pie={`${fmtPct(pctRec, 0)} de lo emitido`}
        />
        <KpiTile
          etiqueta="Por recaudar"
          valor={fmtPesosCompacto(r.carteraSaldo)}
          valorExacto={fmtMonto(r.carteraSaldo)}
          icono={<Hourglass />}
          color={DashColors.alerta}
          subirEsBueno={false}
        />
        <KpiTile
          etiqueta="Comisión recibida"
          valor={fmtPesosCompacto(a.comision)}
          valorExacto={fmtMonto(a.comision)}
          icono={<PiggyBank />}
          color={DashColors.bueno}
          delta={variacion(a.comision, comp?.comision)}
          pie={a.recaudo > 0 ? `${fmtPct((a.comision / a.recaudo) * 100)} efectivo` : null}
        />
      </Rejilla>
      <Rejilla anchoMinimo={520} maxColumnas={2}>
        <DashCard titulo="Recaudo y comisión por mes" subtitulo="Pagos registrados con fecha en el período">
          <GraficoColumnas
            titulo="Recaudo y comisión por mes"
            etiquetas={etiq}
            series={[
              { nombre: 'Recaudo de prima', valores: a.recaudoMes, color: DashColors.real },
              { nombre: 'Comisión', valores: a.comisionMes, color: DashColors.bueno },
            ]}
          />
        </DashCard>
        <DashCard titulo="Antigüedad de la cartera por recaudar" subtitulo="Días desde el inicio de vigencia de cada póliza con saldo">
          <RankingBarras filas={agingFilas} maxFilas={6} />
        </DashCard>
      </Rejilla>
      <Rejilla anchoMinimo={520} maxColumnas={2}>
        <DashCard titulo="Comisión recibida por aseguradora" subtitulo="Toque para filtrar">
          <RankingBarras filas={filasDim(r, 'aseguradora', 'comision')} seleccionado={f.aseg} onTap={(n) => c.alternarDim('aseguradora', n)} />
        </DashCard>
        <DashCard titulo="Mayores saldos por cliente" subtitulo="Prima emitida en el período aún sin recaudar">
          <RankingBarras
            filas={r.deudores.map((d) => ({ nombre: d.nombre, valor: d.prima, color: DashColors.alerta, detalle: `${d.n} pólizas con saldo` }))}
            seleccionado={f.cliente}
            onTap={(n) => c.alternarDim('cliente', n)}
            mostrarPct={false}
          />
        </DashCard>
      </Rejilla>
      <DashCard titulo="Rentabilidad por aseguradora" subtitulo="Comisión efectiva = comisión recibida ÷ prima recaudada">
        {rentab.length === 0 ? (
          <SinDatos />
        ) : (
          <TablaDash>
            <thead>
              <tr className="border-b border-line text-left">
                <th className={clTh}>Aseguradora</th>
                <th className={cn(clTh, 'text-right')}>Prima recaudada</th>
                <th className={cn(clTh, 'text-right')}>Comisión</th>
                <th className={cn(clTh, 'text-right')}>Comisión efectiva</th>
              </tr>
            </thead>
            <tbody>
              {rentab.slice(0, 20).map((x) => (
                <tr key={x.nombre} {...filaClicable(() => c.alternarDim('aseguradora', x.nombre))} className="cursor-pointer hover:bg-muted">
                  <td className={cn(clTd, 'font-semibold')}>{x.nombre}</td>
                  <td className={cn(clTd, 'num text-right')}>{fmtMonto(x.recaudo)}</td>
                  <td className={cn(clTd, 'num text-right')}>{fmtMonto(x.comision)}</td>
                  <td className={cn(clTd, 'text-right')}>{fmtPct((x.comision / x.recaudo) * 100)}</td>
                </tr>
              ))}
            </tbody>
          </TablaDash>
        )}
      </DashCard>
    </div>
  )
}
