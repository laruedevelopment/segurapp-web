import {
  Banknote,
  CalendarX2,
  ClipboardList,
  History,
  Hourglass,
  ListChecks,
  PiggyBank,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Tag,
  Users,
  Wallet,
} from 'lucide-react'
import { EncabezadoTab } from './comunes'
import { filasDim, type CtxDash } from './contexto'
import { etiquetasMeses, fmtEntero, fmtMonto, fmtPct, fmtPesosCompacto } from './formato'
import { DashColors } from './colores'
import { Alerta, DashCard, GraficoDona, GraficoLineas, KpiTile, RankingBarras, Rejilla } from './graficos'
import { variacion } from './motor'

export function TabResumen({ c }: { c: CtxDash }) {
  const { r, f, abonos, calidad: cal } = c
  const a = r.actual
  const comp = r.comp
  const tasa = r.tasaRenovacion
  const etiq = etiquetasMeses(r.meses)
  const conPagos = abonos != null
  const carteraVieja = r.aging.filter(([k]) => k === 'Más de 180' || k === '91–180 días').reduce((s, [, v]) => s + v, 0)
  const serie = DashColors.serie

  return (
    <div className="space-y-3.5">
      <EncabezadoTab titulo="Resumen ejecutivo" periodo={`${c.periodoTxt}${c.compTxt ? `  ·  ${c.compTxt}` : ''}`} />
      <Rejilla anchoMinimo={230}>
        <KpiTile
          etiqueta="Prima emitida"
          valor={fmtPesosCompacto(a.prima)}
          valorExacto={fmtMonto(a.prima)}
          icono={<Banknote />}
          delta={variacion(a.prima, comp?.prima)}
          spark={a.primaMes}
          pie={comp ? `ant. ${fmtPesosCompacto(comp.prima)}` : null}
        />
        <KpiTile
          etiqueta="Pólizas emitidas"
          valor={fmtEntero(a.n)}
          icono={<ReceiptText />}
          color={serie[0]}
          delta={variacion(a.n, comp?.n)}
          spark={a.nMes}
          pie={comp ? `ant. ${fmtEntero(comp.n)}` : null}
        />
        <KpiTile
          etiqueta="Prima promedio"
          valor={fmtPesosCompacto(a.ticket)}
          valorExacto={fmtMonto(a.ticket)}
          icono={<Tag />}
          color={serie[6]}
          delta={variacion(a.ticket, comp?.ticket)}
          pie={comp ? `ant. ${fmtPesosCompacto(comp.ticket)}` : null}
        />
        <KpiTile
          etiqueta="Clientes con póliza nueva"
          valor={fmtEntero(a.clientes)}
          icono={<Users />}
          color={serie[2]}
          delta={variacion(a.clientes, comp?.clientes)}
          pie={`${fmtEntero(r.clientesNuevos)} nuevos`}
          onTap={() => c.irA('clientes')}
        />
        {conPagos && (
          <>
            <KpiTile
              etiqueta="Comisión recibida"
              valor={fmtPesosCompacto(a.comision)}
              valorExacto={fmtMonto(a.comision)}
              icono={<PiggyBank />}
              color={DashColors.bueno}
              delta={variacion(a.comision, comp?.comision)}
              spark={a.comisionMes}
              pie={a.recaudo > 0 ? `${fmtPct((a.comision / a.recaudo) * 100)} del recaudo` : null}
            />
            <KpiTile
              etiqueta="Recaudo de prima"
              valor={fmtPesosCompacto(a.recaudo)}
              valorExacto={fmtMonto(a.recaudo)}
              icono={<Wallet />}
              color={serie[2]}
              delta={variacion(a.recaudo, comp?.recaudo)}
              spark={a.recaudoMes}
            />
            <KpiTile
              etiqueta="Cartera por recaudar"
              valor={fmtPesosCompacto(r.carteraSaldo)}
              valorExacto={fmtMonto(r.carteraSaldo)}
              icono={<Hourglass />}
              color={DashColors.alerta}
              subirEsBueno={false}
              pie={r.carteraPrima > 0 ? `${fmtPct((r.carteraPagada / r.carteraPrima) * 100, 0)} recaudado` : null}
              onTap={() => c.irA('cartera')}
            />
          </>
        )}
        <KpiTile
          etiqueta="Renovación (estimada)"
          valor={tasa == null ? '—' : fmtPct(tasa * 100, 0)}
          icono={<RefreshCw />}
          color={serie[3]}
          pie={r.renBase === 0 ? 'sin vencimientos en el período' : `${r.renRenovadas} de ${r.renBase} vencidas`}
          onTap={() => c.irA('renovaciones')}
        />
      </Rejilla>
      <Rejilla anchoMinimo={520} maxColumnas={2}>
        <DashCard titulo="Prima emitida por mes" subtitulo={comp ? 'Período seleccionado vs comparación' : 'Período seleccionado'}>
          <GraficoLineas
            titulo="Prima emitida por mes"
            etiquetas={etiq}
            series={[
              { nombre: 'Actual', valores: a.primaMes, color: DashColors.real },
              ...(comp ? [{ nombre: 'Comparación', valores: comp.primaMes, color: DashColors.comparacion, punteada: true }] : []),
            ]}
          />
        </DashCard>
        <DashCard titulo="Atención del día" subtitulo="Lo que requiere una acción">
          <div>
            <Alerta
              icono={<CalendarX2 />}
              color={r.vence30[0] > 0 ? DashColors.alerta : DashColors.bueno}
              titulo={`${fmtEntero(r.vence30[0])} pólizas vencen en 30 días`}
              detalle={`Prima en juego: ${fmtPesosCompacto(r.vence30[1])}. Es la renovación a gestionar ya.`}
              onTap={() => c.irA('renovaciones')}
            />
            <Alerta
              icono={<History />}
              color={r.sinRenovar90Tot[0] > 0 ? DashColors.malo : DashColors.bueno}
              titulo={`${fmtEntero(r.sinRenovar90Tot[0])} vencidas hace menos de 90 días sin renovar`}
              detalle={`Prima perdida si no se recuperan: ${fmtPesosCompacto(r.sinRenovar90Tot[1])}.`}
              onTap={() => c.irA('renovaciones')}
            />
            <Alerta
              icono={<Wallet />}
              color={carteraVieja > 0 ? DashColors.malo : DashColors.bueno}
              titulo={`Cartera con más de 90 días: ${fmtPesosCompacto(carteraVieja)}`}
              detalle="Prima emitida en el período que aún no se recauda."
              onTap={() => c.irA('cartera')}
            />
            {(c.casos ?? 0) > 0 && (
              <Alerta
                icono={<ClipboardList />}
                color={DashColors.alerta}
                titulo={`${c.casos} casos por revisar`}
                detalle="Pólizas pendientes de revisión (menú Pólizas → Pendientes)."
              />
            )}
            <Alerta
              icono={cal.problemas === 0 ? <ShieldCheck /> : <ListChecks />}
              color={cal.problemas === 0 ? DashColors.bueno : DashColors.alerta}
              titulo={
                cal.problemas === 0
                  ? 'Datos completos'
                  : `Calidad de datos: ${fmtEntero(cal.problemas)} campos por completar`
              }
              detalle={
                cal.problemas === 0
                  ? 'Todas las pólizas tienen asesor, ramo, cliente, prima y vencimiento.'
                  : `Sin asesor ${fmtEntero(cal.sinAsesor)} · sin ramo ${fmtEntero(cal.sinRamo)} · ` +
                    `sin vencimiento ${fmtEntero(cal.sinVencimiento)} · sin prima ${fmtEntero(cal.sinPrima)} · ` +
                    `sin cliente ${fmtEntero(cal.sinCliente)} (de ${fmtEntero(cal.total)}). ` +
                    'Afectan la precisión de este tablero.'
              }
            />
          </div>
        </DashCard>
      </Rejilla>
      <Rejilla anchoMinimo={460} maxColumnas={3}>
        <DashCard titulo="Prima por aseguradora" subtitulo="Toque una rebanada para filtrar">
          <GraficoDona
            datos={r.porDim.aseguradora.map((g) => ({ nombre: g.nombre, valor: g.prima }))}
            seleccionado={f.aseg}
            centro="prima total"
            onTap={(n) => c.alternarDim('aseguradora', n)}
          />
        </DashCard>
        <DashCard titulo="Prima por ramo" subtitulo="Toque una rebanada para filtrar">
          <GraficoDona
            datos={r.porDim.ramo.map((g) => ({ nombre: g.nombre, valor: g.prima }))}
            seleccionado={f.ramo}
            centro="prima total"
            onTap={(n) => c.alternarDim('ramo', n)}
          />
        </DashCard>
        <DashCard titulo="Top 5 asesores" subtitulo="Por prima emitida">
          <RankingBarras
            filas={filasDim(r, 'asesor')}
            maxFilas={5}
            seleccionado={f.asesor}
            onTap={(n) => c.alternarDim('asesor', n)}
          />
        </DashCard>
      </Rejilla>
    </div>
  )
}
