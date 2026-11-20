import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react'
import { Aviso, Cargando } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { SelectorSimple } from '@/components/ui/campos'
import { MENSAJE_TABLA_METAS, esTablaMetasFaltante, useAbonosDashboard, useMetas } from '@/datos/dashboard'
import { mensajeAmigable } from '@/lib/errores'
import { DashColors } from '@/paginas/dashboard/colores'
import { DialogoMetas } from '@/paginas/dashboard/DialogoMetas'
import { MESES_12, fmtEntero, fmtPct, fmtPesosCompacto, mesCorto } from '@/paginas/dashboard/formato'
import { BarraMeta, DashCard, GraficoColumnas, Rejilla } from '@/paginas/dashboard/graficos'
import { INDICADORES_META, MotorDash, aPolizaMotor, fraccionesMeta, metaDe, type Meta } from '@/paginas/dashboard/motor'
import type { PropsTab } from './comun'

/**
 * Metas y cumplimiento (las mismas metas y el mismo cálculo del Dashboard gerencial). Las metas son por
 * agencia o por asesor, así que esta pestaña usa todas las pólizas y no los demás filtros del tablero.
 */
export default function TabMetas({ todas, hoy }: PropsTab) {
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [asesorSel, setAsesorSel] = useState<number | null>(null)
  const [editando, setEditando] = useState(false)
  const consulta = useMetas(anio)
  const abonos = useAbonosDashboard()
  const metas: Meta[] | null = consulta.data ?? null

  const polizas = useMemo(() => todas.map((r) => aPolizaMotor(r.p)), [todas])
  const motor = useMemo(() => new MotorDash(polizas, abonos.data ?? null, hoy), [polizas, abonos.data, hoy])
  const asesores = useMemo(() => {
    const m = new Map<number, string>()
    for (const p of polizas) if (p.asesorId != null && p.nombreAsesor != null) m.set(p.asesorId, p.nombreAsesor)
    return [...m.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [polizas])
  const nombreSel = asesores.find((a) => a.id === asesorSel)?.nombre ?? null

  const real = useMemo(() => motor.realesAnio(anio, asesorSel), [motor, anio, asesorSel])
  const { mesRef, fracMes, fracAnio } = fraccionesMeta(anio, hoy)
  const esActual = anio === hoy.getFullYear()
  const errorMetas = consulta.isError ? consulta.error : null
  const faltaTabla = errorMetas != null && esTablaMetasFaltante(errorMetas)
  const primaMeta = Array.from({ length: 12 }, (_, m) => metaDe(metas, 'prima', m + 1, asesorSel ?? 0))

  const porAsesor = (metas ?? []).filter((m) => m.indicador === 'prima' && m.mes === mesRef && m.asesorId !== 0 && m.valor > 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h2 className="text-lg font-extrabold">Metas y cumplimiento</h2>
          <p className="text-[12px] text-ink-soft">La marca negra indica dónde debería ir el avance según los días transcurridos. Usa todas las pólizas: los filtros del tablero no aplican.</p>
        </div>
        <SelectorSimple<string>
          className="h-9 w-48 text-[13px]"
          valor={asesorSel == null ? null : String(asesorSel)}
          vacio="Toda la agencia"
          opciones={asesores.map((a) => ({ valor: String(a.id), etiqueta: a.nombre }))}
          onCambio={(v) => setAsesorSel(v == null ? null : Number(v))}
        />
        <div className="flex items-center gap-1">
          <Boton variante="fantasma" tamano="icono" onClick={() => setAnio(anio - 1)} aria-label="Año anterior"><ChevronLeft /></Boton>
          <span className="num min-w-12 text-center text-base font-extrabold">{anio}</span>
          <Boton variante="fantasma" tamano="icono" onClick={() => setAnio(anio + 1)} aria-label="Año siguiente"><ChevronRight /></Boton>
        </div>
        <Boton onClick={() => setEditando(true)} disabled={faltaTabla}><Flag /> Configurar metas</Boton>
      </div>

      {consulta.isPending && <Cargando texto="Cargando metas…" className="py-6" />}
      {errorMetas != null && (
        <DashCard titulo="Metas no disponibles">
          <p className="text-[13px]">{faltaTabla ? MENSAJE_TABLA_METAS : mensajeAmigable(errorMetas, 'No se pudieron leer las metas')}</p>
        </DashCard>
      )}
      {metas != null && metas.length === 0 && (
        <Aviso tono="navy"><b>Aún no hay metas para {anio}.</b> Use «Configurar metas» para definir la meta mensual de cada indicador (agencia o por asesor).</Aviso>
      )}
      {abonos.isError && <Aviso>No se pudieron cargar los pagos: las metas de comisión y recaudo saldrán en cero.</Aviso>}

      <Rejilla anchoMinimo={380} maxColumnas={2}>
        {INDICADORES_META.map((i) => {
          const fmt = i.monetario ? fmtPesosCompacto : fmtEntero
          const realMes = real[i.clave][mesRef - 1]
          const metaMes = metaDe(metas, i.clave, mesRef, asesorSel ?? 0)
          const realAnio = real[i.clave].reduce((s, v) => s + v, 0)
          const metaAnio = Array.from({ length: 12 }, (_, k) => metaDe(metas, i.clave, k + 1, asesorSel ?? 0)).reduce((s, v) => s + v, 0)
          const proy = fracAnio > 0 && fracAnio < 1 ? realAnio / fracAnio : realAnio
          return (
            <DashCard key={i.clave} titulo={i.nombre} subtitulo={nombreSel == null ? 'Toda la agencia' : `Asesor: ${nombreSel}`}>
              <div className="space-y-3.5">
                <BarraMeta titulo={`Mes: ${mesCorto(new Date(anio, mesRef - 1, 1), true)}`} real={realMes} meta={metaMes} esperado={fracMes} formato={fmt} />
                <BarraMeta titulo={`Año ${anio} acumulado`} real={realAnio} meta={metaAnio} esperado={fracAnio} formato={fmt} />
                {metaAnio > 0 && esActual && (
                  <p className="text-[11.5px] text-ink-soft">Al ritmo actual cerraría en {fmt(proy)} ({fmtPct((proy / metaAnio) * 100, 0)} de la meta).</p>
                )}
              </div>
            </DashCard>
          )
        })}
      </Rejilla>

      <DashCard titulo="Prima emitida: real vs meta por mes">
        <GraficoColumnas
          titulo="Prima emitida real contra meta por mes"
          etiquetas={MESES_12}
          series={[
            { nombre: 'Meta', valores: primaMeta, color: DashColors.comparacion },
            { nombre: 'Real', valores: real.prima, color: DashColors.real },
          ]}
        />
      </DashCard>

      {asesorSel == null && (
        <DashCard titulo="Cumplimiento de prima por asesor (mes de referencia)" subtitulo="Meta individual del mes contra prima emitida">
          {porAsesor.length === 0 ? (
            <p className="py-3 text-[12px] text-ink-soft">No hay metas individuales de prima para este mes.</p>
          ) : (
            <div className="space-y-3.5">
              {porAsesor.map((m) => (
                <BarraMeta
                  key={m.asesorId}
                  titulo={asesores.find((a) => a.id === m.asesorId)?.nombre ?? `Asesor ${m.asesorId}`}
                  real={motor.realesAnio(anio, m.asesorId).prima[mesRef - 1]}
                  meta={m.valor}
                  esperado={fracMes}
                  formato={fmtPesosCompacto}
                />
              ))}
            </div>
          )}
        </DashCard>
      )}

      <DialogoMetas abierto={editando} anio={anio} metasActuales={metas ?? []} asesores={asesores} onCerrar={() => setEditando(false)} />
    </div>
  )
}
