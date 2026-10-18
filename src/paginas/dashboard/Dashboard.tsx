import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CloudOff, FilterX, RefreshCw } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Cargando, Chip, MensajeError } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { SelectorRango } from '@/components/ui/fecha'
import { FiltroOpciones } from '@/components/ui/filtro-opciones'
import { MINUTOS_DASHBOARD, useAbonosDashboard } from '@/datos/dashboard'
import { CLAVE_CASOS, contarCasosPendientes } from '@/datos/casos'
import { CLAVE_TODAS, usePolizasTodas, useProgresoPolizas } from '@/datos/usePolizas'
import { esAdmin, useSesion } from '@/lib/sesion'
import { cn } from '@/lib/utils'
import { fmtEntero, mesCorto } from './formato'
import { PESTANAS, type CtxDash, type Pestana } from './contexto'
import { mensajeAmigable } from '@/lib/errores'
import { DIMS, MotorDash, aPolizaMotor, etiquetaDim, nDimensiones, nuevosFiltros, poner, soloDia, valorDe, type Comparar, type Dim, type FiltrosDash } from './motor'
import { TabCartera } from './TabCartera'
import { TabClientes } from './TabClientes'
import { TabMetas } from './TabMetas'
import { TabProduccion } from './TabProduccion'
import { TabRenovaciones } from './TabRenovaciones'
import { TabResumen } from './TabResumen'

const PRESETS = ['Este mes', 'Mes anterior', 'Trimestre', 'Este año', 'Año anterior', '12 meses', 'Todo'] as const
type Preset = (typeof PRESETS)[number] | 'Personalizado'

const COMPARAR: Array<{ id: Comparar; texto: string }> = [
  { id: 'periodoAnterior', texto: 'Período anterior' },
  { id: 'anioAnterior', texto: 'Año anterior' },
  { id: 'ninguno', texto: 'Nada' },
]

const ESTADOS: Array<{ id: 0 | 1 | 2; texto: string }> = [
  { id: 0, texto: 'Todas' },
  { id: 1, texto: 'Vigentes' },
  { id: 2, texto: 'Vencidas' },
]

const dosDig = (n: number) => String(n).padStart(2, '0')
const fmtLargo = (d: Date) => `${d.getDate()} ${mesCorto(d)} ${d.getFullYear()}`
const fmtCorto = (d: Date) => `${dosDig(d.getDate())}/${dosDig(d.getMonth() + 1)}/${dosDig(d.getFullYear() % 100)}`

/** Rango de fechas de cada atajo de período. */
function rangoPreset(nombre: (typeof PRESETS)[number], motor: MotorDash): [Date, Date] {
  const h = new Date()
  const hoy = soloDia(h)
  switch (nombre) {
    case 'Este mes':
      return [new Date(h.getFullYear(), h.getMonth(), 1), new Date(h.getFullYear(), h.getMonth() + 1, 0)]
    case 'Mes anterior':
      return [new Date(h.getFullYear(), h.getMonth() - 1, 1), new Date(h.getFullYear(), h.getMonth(), 0)]
    case 'Trimestre': {
      const q = Math.floor(h.getMonth() / 3)
      return [new Date(h.getFullYear(), q * 3, 1), new Date(h.getFullYear(), q * 3 + 3, 0)]
    }
    case 'Este año':
      return [new Date(h.getFullYear(), 0, 1), new Date(h.getFullYear(), 11, 31)]
    case 'Año anterior':
      return [new Date(h.getFullYear() - 1, 0, 1), new Date(h.getFullYear() - 1, 11, 31)]
    case '12 meses':
      return [new Date(h.getFullYear(), h.getMonth() - 11, 1), new Date(h.getFullYear(), h.getMonth() + 1, 0)]
    case 'Todo': {
      const r = motor.rangoTotal()
      return [r ? new Date(r[0].getFullYear(), r[0].getMonth(), 1) : new Date(h.getFullYear(), 0, 1), hoy]
    }
  }
}

/**
 * Dashboard gerencial: KPIs, producción, comercial, cartera, renovaciones y
 * metas, con filtros globales y comparación contra un período anterior. Los
 * gráficos son interactivos: tocar una barra, rebanada o fila filtra todo el
 * tablero. Solo para el Administrador.
 */
export default function Dashboard() {
  const sesion = useSesion()
  if (!esAdmin(sesion?.usuario)) {
    return (
      <>
        <EncabezadoPagina titulo="Dashboard gerencial" />
        <Contenido>
          <p className="py-16 text-center text-ink-soft">Solo disponible para administradores.</p>
        </Contenido>
      </>
    )
  }
  return <Tablero />
}

function Tablero() {
  const qc = useQueryClient()
  const pq = usePolizasTodas()
  const aq = useAbonosDashboard()
  const progreso = useProgresoPolizas()
  const casosQ = useQuery({
    queryKey: [...CLAVE_CASOS, 'contador'],
    queryFn: contarCasosPendientes,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const [pestana, setPestana] = useState<Pestana>('resumen')
  const [preset, setPreset] = useState<Preset>('Este año')
  const [f, setF] = useState<FiltrosDash>(() => {
    const h = new Date()
    return nuevosFiltros(new Date(h.getFullYear(), 0, 1), new Date(h.getFullYear(), 11, 31))
  })

  // "Tiempo real": se refresca solo cada 15 minutos mientras está abierto (cada
  // recarga baja todas las pólizas; más seguido gasta el límite de datos del plan).
  useEffect(() => {
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: CLAVE_TODAS })
    }, MINUTOS_DASHBOARD * 60_000)
    return () => clearInterval(t)
  }, [qc])

  const polizas = useMemo(() => pq.data?.polizas.map(aPolizaMotor) ?? [], [pq.data])
  // Los pagos son opcionales: si fallan, el resto del tablero funciona sin ellos.
  const abonos = aq.data ?? null
  const motor = useMemo(() => new MotorDash(polizas, abonos), [polizas, abonos])
  const r = useMemo(() => motor.calcular(f), [motor, f])
  const calidad = useMemo(() => motor.calidad(), [motor])
  const opciones = useMemo(() => Object.fromEntries(DIMS.map((d) => [d, motor.opciones(f, d)])) as Record<Dim, string[]>, [motor, f])

  const cambiarFiltros = useCallback((fn: (x: FiltrosDash) => FiltrosDash) => setF(fn), [])
  const alternarDim = useCallback(
    (d: Dim, valor: string) => setF((x) => poner(x, d, valorDe(x, d) === valor ? null : valor)),
    [],
  )

  const elegirPreset = (nombre: (typeof PRESETS)[number]) => {
    const [desde, hasta] = rangoPreset(nombre, motor)
    setPreset(nombre)
    setF((x) => ({ ...x, desde, hasta, comparar: nombre === 'Todo' ? 'ninguno' : x.comparar }))
  }

  const cargandoTodo = pq.isPending || aq.isPending
  const actualizar = () => {
    pq.refetch()
    aq.refetch()
    casosQ.refetch()
  }

  const ctx: CtxDash = {
    r,
    f,
    motor,
    polizas,
    abonos,
    calidad,
    casos: casosQ.data ?? null,
    alternarDim,
    cambiarFiltros,
    irA: setPestana,
    periodoTxt: `${fmtLargo(r.filtros.desde)} – ${fmtLargo(r.filtros.hasta)}`,
    compTxt: r.comp ? `vs ${fmtCorto(r.comp.desde)} – ${fmtCorto(r.comp.hasta)}` : '',
  }

  const hayFiltros = nDimensiones(f) > 0 || f.estado !== 0 || f.incluirAnuladas
  const actualizadoEn = pq.data?.cargadasEn

  const acciones = (
    <>
      {actualizadoEn && !cargandoTodo && (
        <span className="num text-[12px] text-ink-soft">
          Actualizado {dosDig(actualizadoEn.getHours())}:{dosDig(actualizadoEn.getMinutes())}
        </span>
      )}
      <Boton variante="secundario" tamano="sm" onClick={actualizar} disabled={cargandoTodo || pq.isFetching} title="Volver a bajar pólizas y pagos">
        <RefreshCw className={cn(pq.isFetching && 'animate-spin')} /> Actualizar
      </Boton>
    </>
  )

  if (pq.isError && !pq.data) {
    return (
      <>
        <EncabezadoPagina titulo="Dashboard gerencial" />
        <Contenido>
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <CloudOff className="size-12 text-line-strong" />
            <MensajeError error={mensajeAmigable(pq.error, 'No se pudieron cargar los datos')} />
            <Boton onClick={() => pq.refetch()}>
              <RefreshCw /> Reintentar
            </Boton>
          </div>
        </Contenido>
      </>
    )
  }

  if (cargandoTodo) {
    return (
      <>
        <EncabezadoPagina titulo="Dashboard gerencial" />
        <Contenido>
          <Cargando texto={progreso === 0 ? 'Conectando…' : `${fmtEntero(progreso)} pólizas cargadas`} />
        </Contenido>
      </>
    )
  }

  return (
    <>
      <EncabezadoPagina titulo="Dashboard gerencial" subtitulo="Producción, cartera, renovaciones y metas" acciones={acciones} />
      <div className="border-b border-line bg-surface">
        <div className="mx-auto w-full max-w-[1400px] space-y-2 px-4 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map((p) => (
              <Chip key={p} activo={preset === p} onClick={() => elegirPreset(p)}>
                {p}
              </Chip>
            ))}
            <SelectorRango
              etiqueta="Personalizado"
              valor={preset === 'Personalizado' ? { desde: f.desde, hasta: f.hasta } : { desde: null, hasta: null }}
              onCambio={(rg) => {
                const desde = rg.desde ?? rg.hasta
                const hasta = rg.hasta ?? rg.desde
                if (!desde || !hasta) return
                setPreset('Personalizado')
                setF((x) => ({ ...x, desde: soloDia(desde), hasta: soloDia(hasta) }))
              }}
            />
            <span className="ml-2 text-[12px] text-ink-soft">Comparar con:</span>
            {COMPARAR.map((o) => (
              <Chip key={o.id} activo={f.comparar === o.id} onClick={() => setF((x) => ({ ...x, comparar: o.id }))}>
                {o.texto}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {DIMS.map((d) => (
              <FiltroOpciones
                key={d}
                etiqueta={etiquetaDim(d)}
                valor={valorDe(f, d)}
                opciones={opciones[d]}
                onCambio={(v) => setF((x) => poner(x, d, v))}
                className="w-44"
              />
            ))}
            <Chip activo={f.incluirAnuladas} onClick={() => setF((x) => ({ ...x, incluirAnuladas: !x.incluirAnuladas }))}>
              Incluir anuladas
            </Chip>
            {ESTADOS.map((e) => (
              <Chip key={e.id} activo={f.estado === e.id} onClick={() => setF((x) => ({ ...x, estado: e.id }))}>
                {e.texto}
              </Chip>
            ))}
            {hayFiltros && (
              <Boton
                variante="fantasma"
                tamano="sm"
                onClick={() => setF((x) => ({ ...x, aseg: null, ramo: null, prod: null, asesor: null, cliente: null, estado: 0, incluirAnuladas: false }))}
              >
                <FilterX /> Limpiar filtros
              </Boton>
            )}
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1400px] overflow-x-auto px-4 sm:px-6">
          <div role="tablist" aria-label="Secciones del dashboard" className="flex gap-1">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                role="tab"
                type="button"
                id={`tab-${p.id}`}
                aria-selected={pestana === p.id}
                aria-controls="panel-dashboard"
                onClick={() => setPestana(p.id)}
                className={cn(
                  '-mb-px border-b-2 px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap',
                  pestana === p.id ? 'border-navy text-navy' : 'border-transparent text-ink-soft hover:text-ink',
                )}
              >
                {p.texto}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Contenido className="max-w-[1400px]">
        <div role="tabpanel" id="panel-dashboard" aria-labelledby={`tab-${pestana}`}>
          {pestana === 'resumen' && <TabResumen c={ctx} />}
          {pestana === 'produccion' && <TabProduccion c={ctx} />}
          {pestana === 'clientes' && <TabClientes c={ctx} />}
          {pestana === 'cartera' && <TabCartera c={ctx} />}
          {pestana === 'renovaciones' && <TabRenovaciones c={ctx} />}
          {pestana === 'metas' && <TabMetas c={ctx} />}
        </div>
      </Contenido>
    </>
  )
}
