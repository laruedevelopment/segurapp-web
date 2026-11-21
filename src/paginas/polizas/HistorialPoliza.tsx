import { useMemo } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { Etiqueta, SeccionTarjeta } from '@/components/ui/basicos'
import { listarPolizasPorNroContiene } from '@/datos/polizas'
import { anexoDe, nucleoPoliza, vigenciasDe } from '@/datos/grupoPolizaLogica'
import { aFecha, fmtFecha } from '@/lib/fechas'
import { fmtDinero } from '@/lib/numeros'
import { placasDePoliza } from '@/lib/placa'
import type { PolizaLista } from '@/lib/tipos'
import { cn } from '@/lib/utils'

/**
 * Historial de una póliza: todas las filas con el mismo número base y aseguradora. Cada renovación es una
 * vigencia y cada anexo (por ejemplo, agregar un vehículo) cuelga de su vigencia. Arriba, los vehículos de la
 * vigencia más reciente. No se muestra si la póliza no tiene otras filas.
 */
export default function HistorialPoliza({ polizaId, nro, asegId }: { polizaId: number; nro: string; asegId: number | null }) {
  const nucleo = nucleoPoliza(nro)
  const consulta = useQuery({
    queryKey: ['polizas', 'historial', asegId, nucleo],
    queryFn: () => listarPolizasPorNroContiene(nucleo!, 300),
    enabled: !!nucleo && asegId != null,
    staleTime: 60_000,
  })
  const grupo = useMemo<PolizaLista[]>(
    () => (consulta.data ?? []).filter((p) => p.aseg_id === asegId && nucleoPoliza(p.nro_poliza) === nucleo),
    [consulta.data, asegId, nucleo],
  )
  const vigencias = useMemo(
    () => vigenciasDe(grupo.map((p) => ({ ...p, nro: p.nro_poliza, fin: p.ffin_poliza, bien: p.bien_asegurado, obs: p.obs_poliza ?? null }))),
    [grupo],
  )
  if (!nucleo || grupo.length <= 1) return null
  const actual = vigencias[0]

  return (
    <SeccionTarjeta
      titulo={`Historial de la póliza · ${vigencias.length} ${vigencias.length === 1 ? 'vigencia' : 'vigencias'}, ${grupo.length} ${grupo.length === 1 ? 'registro' : 'registros'}`}
      icono={<History />}
    >
      <div className="flex flex-col gap-3 p-4 text-[13px]">
        <div className="text-ink-soft">
          Número base <b className="num text-ink">{nucleo}</b>. Cada renovación es una vigencia; los anexos son los registros que comparten la misma vigencia.
        </div>
        {actual.placas.length > 0 && (
          <div>
            <div className="mb-1 text-[12px] font-semibold text-ink-soft">
              Vehículos de la vigencia más reciente ({actual.placas.length}), hasta {fmtFecha(aFecha(actual.fin))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {actual.placas.map((p) => (
                <span key={p} className="num rounded-md bg-[#f6d33a] px-2 py-0.5 font-bold tracking-wider text-black">{p}</span>
              ))}
            </div>
          </div>
        )}
        {vigencias.map((v, i) => (
          <div key={v.fin} className="rounded-xl border border-line">
            <div className="flex items-center gap-2 border-b border-line bg-muted px-3 py-1.5 font-semibold">
              Vigencia hasta {fmtFecha(aFecha(v.fin))}
              {i === 0 && <Etiqueta tono="verde">más reciente</Etiqueta>}
              {v.filas.length > 1 && <Etiqueta tono="navy">{v.filas.length - 1} {v.filas.length - 1 === 1 ? 'anexo' : 'anexos'}</Etiqueta>}
            </div>
            <ul>
              {v.filas.map((p) => (
                <li key={p.id} className={cn('flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-3 py-1.5', p.id === polizaId && 'bg-navy-soft')}>
                  <Link to={`/polizas/${p.id}`} className="num font-semibold text-navy underline-offset-2 hover:underline">#{p.id}</Link>
                  <span className="num">{p.nro_poliza ?? '—'}</span>
                  <span className="text-ink-soft">{anexoDe(p.nro_poliza) === '' ? 'sin anexo' : `anexo ${anexoDe(p.nro_poliza)}`}</span>
                  <span className="text-ink-soft">{fmtFecha(aFecha(p.fini_poliza))} – {fmtFecha(aFecha(p.ffin_poliza))}</span>
                  <span className="num">{fmtDinero(p.prima_poliza ?? 0)}</span>
                  <span className="min-w-0 truncate text-ink-soft" title={`${p.bien_asegurado ?? ''} ${p.obs_poliza ?? ''}`}>
                    {placasDePoliza(p.bien_asegurado, p.obs_poliza).join(' · ') || p.bien_asegurado || ''}
                  </span>
                  {p.id === polizaId && <Etiqueta tono="neutro">esta póliza</Etiqueta>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SeccionTarjeta>
  )
}
