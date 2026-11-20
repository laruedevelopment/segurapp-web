import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, CircleCheck, CircleX } from 'lucide-react'
import { DashColors } from '@/paginas/dashboard/colores'
import { fmtEntero, fmtMonto, fmtPesosCompacto } from '@/paginas/dashboard/formato'
import { DashCard, GraficoColumnas, KpiTile, RankingBarras, Rejilla, type FilaRanking } from '@/paginas/dashboard/graficos'
import { Chip } from '@/components/ui/basicos'
import { alternarGrupo, type PropsTab } from './comun'
import { agruparTablero, diasVence, porAnioInicio, totales, vencidasRecientes, type DimTablero, type Medida } from './logica'

const TEXTO_MEDIDA: Record<Medida, string> = { valor: 'Valor póliza', prima: 'Prima', registros: 'Registros' }

function top(filas: PropsTab['filas'], dim: DimTablero): FilaRanking[] {
  return agruparTablero(filas, dim, 'valor')
    .slice(0, 8)
    .map((g) => ({ nombre: g.nombre, valor: g.valor, valorTexto: fmtPesosCompacto(g.valor), detalle: `${fmtEntero(g.registros)} registros · prima ${fmtPesosCompacto(g.prima)}` }))
}

export default function TabResumen({ filas, todas, filtros, cambiar, hoy }: PropsTab) {
  const [medida, setMedida] = useState<Medida>('valor')
  const t = totales(filas)
  let vigentes = 0
  let vencidas = 0
  let vence30 = 0
  for (const r of filas) {
    const d = diasVence(r, hoy)
    if (d == null) continue
    if (d < 0) vencidas++
    else {
      vigentes++
      if (d <= 30) vence30++
    }
  }
  const rec = useMemo(() => vencidasRecientes(filas, todas, hoy, 90), [filas, todas, hoy])
  const anios = porAnioInicio(filas)
  const fmtMedida = (n: number) => (medida === 'registros' ? fmtEntero(n) : fmtPesosCompacto(n))

  return (
    <div className="flex flex-col gap-4">
      <Rejilla anchoMinimo={190}>
        <KpiTile etiqueta="Valor póliza" valor={fmtPesosCompacto(t.valor)} valorExacto={fmtMonto(t.valor)} icono={<CircleCheck />} color={DashColors.real} />
        <KpiTile etiqueta="Prima" valor={fmtPesosCompacto(t.prima)} valorExacto={fmtMonto(t.prima)} icono={<CircleCheck />} color={DashColors.bueno} />
        <KpiTile etiqueta="Registros" valor={fmtEntero(t.registros)} icono={<CircleCheck />} />
        <KpiTile etiqueta="Vigentes" valor={fmtEntero(vigentes)} icono={<CircleCheck />} color={DashColors.bueno} onTap={() => cambiar({ estado: 'vigentes' })} />
        <KpiTile
          etiqueta="Vencidas hace menos de 90 días"
          valor={fmtEntero(rec.vencidas)}
          pie={`${fmtEntero(vencidas)} vencidas en todo el historial`}
          icono={<CircleX />}
          color={DashColors.alerta}
          onTap={() => cambiar({ ffinRel: { sentido: 'anterior', n: 90, unidad: 'dias' }, estado: 'todas' })}
        />
        <KpiTile
          etiqueta="…y sin renovar"
          valor={fmtEntero(rec.sinRenovar)}
          pie="No hay otra póliza posterior del mismo cliente, ramo y bien"
          icono={<CircleX />}
          color={DashColors.malo}
          onTap={() => cambiar({ ffinRel: { sentido: 'anterior', n: 90, unidad: 'dias' }, estado: 'todas' })}
        />
        <KpiTile
          etiqueta="Vencen en 30 días"
          valor={fmtEntero(vence30)}
          icono={<AlertTriangle />}
          color={DashColors.alerta}
          onTap={() => cambiar({ ffinRel: { sentido: 'siguiente', n: 30, unidad: 'dias' }, estado: 'todas' })}
        />
      </Rejilla>

      <DashCard
        titulo="Evolución por año de inicio"
        subtitulo="Según la fecha de inicio de la vigencia"
        accion={
          <div className="flex gap-1.5">
            {(Object.keys(TEXTO_MEDIDA) as Medida[]).map((m) => (
              <Chip key={m} activo={medida === m} onClick={() => setMedida(m)}>{TEXTO_MEDIDA[m]}</Chip>
            ))}
          </div>
        }
      >
        <GraficoColumnas
          titulo={`${TEXTO_MEDIDA[medida]} por año de inicio`}
          etiquetas={anios.map((a) => String(a.anio))}
          series={[{ nombre: TEXTO_MEDIDA[medida], valores: anios.map((a) => (medida === 'valor' ? a.valor : medida === 'prima' ? a.prima : a.registros)), color: DashColors.real }]}
          formato={fmtMedida}
        />
      </DashCard>

      <Rejilla anchoMinimo={340} maxColumnas={3}>
        {(['ramo', 'aseg', 'asesor'] as DimTablero[]).map((d) => (
          <DashCard key={d} titulo={`Top ${d === 'ramo' ? 'ramos' : d === 'aseg' ? 'aseguradoras' : 'asesores'}`} subtitulo="Por valor póliza · toque una fila para filtrar">
            <RankingBarras
              filas={top(filas, d)}
              seleccionado={filtros[d].length === 1 ? filtros[d][0] : null}
              onTap={(n) => cambiar(alternarGrupo(filtros, d, n))}
              formato={fmtPesosCompacto}
              maxFilas={8}
            />
          </DashCard>
        ))}
      </Rejilla>
      <p className="flex items-center gap-1.5 text-[12px] text-ink-soft">
        <CalendarClock className="size-3.5" /> Las cifras cambian con los filtros de arriba. Las anuladas no cuentan salvo que se marque "Incluir anuladas".
      </p>
    </div>
  )
}
