import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react'
import { Aviso, Cargando } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { MENSAJE_TABLA_METAS, esTablaMetasFaltante, useMetas } from '@/datos/dashboard'
import { EncabezadoTab } from './comunes'
import type { CtxDash } from './contexto'
import { MESES_12, fmtEntero, fmtPct, fmtPesosCompacto, mesCorto } from './formato'
import { DashColors } from './colores'
import { BarraMeta, DashCard, GraficoColumnas, Rejilla } from './graficos'
import { DialogoMetas } from './DialogoMetas'
import { mensajeAmigable } from '@/lib/errores'
import { INDICADORES_META, fraccionesMeta, metaDe, type Meta } from './motor'

export function TabMetas({ c }: { c: CtxDash }) {
  const { f, motor, polizas } = c
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [editando, setEditando] = useState(false)
  const consulta = useMetas(anio)
  const metas: Meta[] | null = consulta.data ?? null

  const asesores = useMemo(() => {
    const m = new Map<number, string>()
    for (const p of polizas) if (p.asesorId != null && p.nombreAsesor != null) m.set(p.asesorId, p.nombreAsesor)
    return [...m.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [polizas])

  // Filtro por asesor: se busca su id; "Sin asesor" (o un nombre sin pólizas)
  // no tiene id y entonces no hay metas ni avance que mostrar (-1 no coincide
  // con ningún asesor).
  const asesorSel: number | null = useMemo(() => {
    if (f.asesor == null) return null
    return polizas.find((p) => p.nombreAsesor === f.asesor && p.asesorId != null)?.asesorId ?? -1
  }, [f.asesor, polizas])

  const real = useMemo(() => motor.realesAnio(anio, asesorSel), [motor, anio, asesorSel])
  const hoy = new Date()
  const { mesRef, fracMes, fracAnio } = fraccionesMeta(anio, hoy)
  const esActual = anio === hoy.getFullYear()

  const errorMetas = consulta.isError ? consulta.error : null
  const faltaTabla = errorMetas != null && esTablaMetasFaltante(errorMetas)

  const tarjetas = INDICADORES_META.map((i) => {
    const fmt = i.monetario ? fmtPesosCompacto : fmtEntero
    const realMes = real[i.clave][mesRef - 1]
    const metaMes = metaDe(metas, i.clave, mesRef, asesorSel ?? 0)
    const realAnio = real[i.clave].reduce((s, v) => s + v, 0)
    const metaAnio = Array.from({ length: 12 }, (_, k) => metaDe(metas, i.clave, k + 1, asesorSel ?? 0)).reduce((s, v) => s + v, 0)
    const proy = fracAnio > 0 && fracAnio < 1 ? realAnio / fracAnio : realAnio
    return (
      <DashCard key={i.clave} titulo={i.nombre} subtitulo={asesorSel == null ? 'Toda la agencia' : `Asesor: ${f.asesor}`}>
        <div className="space-y-3.5">
          <BarraMeta
            titulo={`Mes: ${mesCorto(new Date(anio, mesRef - 1, 1), true)}`}
            real={realMes}
            meta={metaMes}
            esperado={fracMes}
            formato={fmt}
          />
          <BarraMeta titulo={`Año ${anio} acumulado`} real={realAnio} meta={metaAnio} esperado={fracAnio} formato={fmt} />
          {metaAnio > 0 && esActual && (
            <p className="text-[11.5px] text-ink-soft">
              Al ritmo actual cerraría en {fmt(proy)} ({fmtPct((proy / metaAnio) * 100, 0)} de la meta).
            </p>
          )}
        </div>
      </DashCard>
    )
  })

  const primaMeta = Array.from({ length: 12 }, (_, m) => metaDe(metas, 'prima', m + 1, asesorSel ?? 0))

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <EncabezadoTab
            titulo="Metas y cumplimiento"
            periodo=""
            sub="La marca negra indica dónde debería ir el avance según los días transcurridos."
          />
        </div>
        <div className="flex items-center gap-1">
          <Boton variante="fantasma" tamano="icono" onClick={() => setAnio(anio - 1)} aria-label="Año anterior">
            <ChevronLeft />
          </Boton>
          <span className="num min-w-12 text-center text-base font-extrabold">{anio}</span>
          <Boton variante="fantasma" tamano="icono" onClick={() => setAnio(anio + 1)} aria-label="Año siguiente">
            <ChevronRight />
          </Boton>
        </div>
        <Boton onClick={() => setEditando(true)} disabled={faltaTabla}>
          <Flag /> Configurar metas
        </Boton>
      </div>

      {consulta.isPending && <Cargando texto="Cargando metas…" className="py-6" />}
      {errorMetas != null && (
        <DashCard titulo="Metas no disponibles">
          <p className="text-[13px]">{faltaTabla ? MENSAJE_TABLA_METAS : mensajeAmigable(errorMetas, 'No se pudieron leer las metas')}</p>
        </DashCard>
      )}
      {metas != null && metas.length === 0 && (
        <Aviso tono="navy">
          <b>Aún no hay metas para {anio}.</b> Use «Configurar metas» para definir la meta mensual de cada indicador (agencia o por asesor).
        </Aviso>
      )}

      <Rejilla anchoMinimo={380} maxColumnas={2}>
        {tarjetas}
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
        <DashCard titulo="Cumplimiento de prima por asesor (mes de referencia)" subtitulo="Meta individual del mes vs prima emitida">
          <MetasPorAsesor c={c} anio={anio} mes={mesRef} frac={fracMes} metas={metas ?? []} asesores={asesores} />
        </DashCard>
      )}

      <DialogoMetas abierto={editando} anio={anio} metasActuales={metas ?? []} asesores={asesores} onCerrar={() => setEditando(false)} />
    </div>
  )
}

function MetasPorAsesor({
  c,
  anio,
  mes,
  frac,
  metas,
  asesores,
}: {
  c: CtxDash
  anio: number
  mes: number
  frac: number
  metas: Meta[]
  asesores: Array<{ id: number; nombre: string }>
}) {
  const porAsesor = metas.filter((m) => m.indicador === 'prima' && m.mes === mes && m.asesorId !== 0 && m.valor > 0)
  const nombres = useMemo(() => new Map(asesores.map((a) => [a.id, a.nombre])), [asesores])
  const reales = useMemo(
    () => new Map(porAsesor.map((m) => [m.asesorId, c.motor.realesAnio(anio, m.asesorId).prima[mes - 1]])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c.motor, anio, mes, metas],
  )
  if (!porAsesor.length) {
    return <p className="py-3 text-[12px] text-ink-soft">No hay metas individuales de prima para este mes.</p>
  }
  return (
    <div className="space-y-3.5">
      {porAsesor.map((m) => (
        <BarraMeta
          key={m.asesorId}
          titulo={nombres.get(m.asesorId) ?? `Asesor ${m.asesorId}`}
          real={reales.get(m.asesorId) ?? 0}
          meta={m.valor}
          esperado={frac}
          formato={fmtPesosCompacto}
        />
      ))}
    </div>
  )
}
