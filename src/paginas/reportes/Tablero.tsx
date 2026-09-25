import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CalendarClock, CalendarX2, CircleX, Clock, CloudOff, Download, FileSpreadsheet, Filter, FilterX, RefreshCw, Search, ShieldCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Aviso, Chip } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { Input } from '@/components/ui/campos'
import { SelectorRango } from '@/components/ui/fecha'
import { FiltroOpciones } from '@/components/ui/filtro-opciones'
import { usePolizasTodas, useProgresoPolizas } from '@/datos/usePolizas'
import { aFecha, aISO, fmtFechaHora, hoy as hoyLocal } from '@/lib/fechas'
import { fmtNum } from '@/lib/numeros'
import { cn, mensajeError } from '@/lib/utils'
import { Agrupado, Resumen, Vencimientos, type DatosResumen, type SeccionVenc } from './secciones'
import {
  FILTROS_VACIOS,
  SIN_RANGO,
  agrupar,
  clasificar,
  contarFiltrosActivos,
  filtrar,
  mismoRango,
  opcionesDe,
  porVencer,
  prepararFilas,
  rangoAnio,
  rangoDias,
  rangoMes,
  sumarPrimas,
  type Dimension,
  type EstadoVigencia,
  type FiltrosReporte,
  type RangoFechas,
} from './calculos'

type Pestana = 'resumen' | 'aseg' | 'ramo' | 'asesor' | 'venc'

const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: 'resumen', texto: 'Resumen' },
  { id: 'aseg', texto: 'Aseguradoras' },
  { id: 'ramo', texto: 'Ramos' },
  { id: 'asesor', texto: 'Asesores' },
  { id: 'venc', texto: 'Vencimientos' },
]

const ESTADOS: { id: EstadoVigencia; texto: string }[] = [
  { id: 'todas', texto: 'Todas' },
  { id: 'vigentes', texto: 'Vigentes' },
  { id: 'vencidas', texto: 'Vencidas' },
  { id: 'sinFecha', texto: 'Sin fecha' },
]

const TITULO_DIM: Record<'aseg' | 'ramo' | 'asesor', string> = { aseg: 'Aseguradora', ramo: 'Ramo', asesor: 'Asesor' }

/** Texto con espera: el valor "confirmado" llega 250 ms después de la última tecla. */
function useTextoConEspera(onConfirmar: (v: string) => void) {
  const [texto, setTexto] = useState('')
  useEffect(() => {
    const t = setTimeout(() => onConfirmar(texto.trim()), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto])
  return [texto, setTexto] as const
}

export default function Tablero() {
  const consulta = usePolizasTodas()
  const progreso = useProgresoPolizas()

  const [filtros, setFiltros] = useState<FiltrosReporte>(FILTROS_VACIOS)
  const cambiar = (parcial: Partial<FiltrosReporte>) => setFiltros((f) => ({ ...f, ...parcial }))
  const [busquedaTexto, setBusquedaTexto] = useTextoConEspera((v) => setFiltros((f) => (f.busqueda === v ? f : { ...f, busqueda: v })))
  const [clienteTexto, setClienteTexto] = useTextoConEspera((v) => setFiltros((f) => (f.cliente === v ? f : { ...f, cliente: v })))

  const [filtrosVisibles, setFiltrosVisibles] = useState(true)
  const [pestana, setPestana] = useState<Pestana>('resumen')
  const [porPrima, setPorPrima] = useState(false)
  const [exportando, setExportando] = useState(false)

  // "Hoy" cambia solo si cambia el día (la pantalla puede quedar abierta de noche).
  const claveHoy = aISO(hoyLocal())!
  const hoy = useMemo(() => aFecha(claveHoy)!, [claveHoy])

  // ── Cálculos memorizados (33 mil pólizas) ────────────────────────────────
  const filas = useMemo(() => prepararFilas(consulta.data?.polizas ?? []), [consulta.data])
  const filtradas = useMemo(() => filtrar(filas, filtros, hoy), [filas, filtros, hoy])
  const clasif = useMemo(() => clasificar(filtradas, hoy), [filtradas, hoy])
  const vencimientos = useMemo(
    () => ({
      pv30: porVencer(filtradas, hoy, 0, 30),
      pv60: porVencer(filtradas, hoy, 31, 60),
      pv90: porVencer(filtradas, hoy, 61, 90),
    }),
    [filtradas, hoy],
  )
  // El Resumen siempre ordena por cantidad (sus barras muestran cantidades).
  const gruposCantidad = useMemo(
    () => ({ aseg: agrupar(filtradas, 'aseg', false), ramo: agrupar(filtradas, 'ramo', false), asesor: agrupar(filtradas, 'asesor', false) }),
    [filtradas],
  )
  const gruposPrima = useMemo(
    () => (porPrima ? { aseg: agrupar(filtradas, 'aseg', true), ramo: agrupar(filtradas, 'ramo', true), asesor: agrupar(filtradas, 'asesor', true) } : null),
    [filtradas, porPrima],
  )
  const grupos = gruposPrima ?? gruposCantidad

  // Opciones en cascada: dependen solo de los filtros de lista y del cliente.
  const { aseg, ramo, asesor, prod, cliente } = filtros
  const opciones = useMemo(() => {
    const f = { ...FILTROS_VACIOS, aseg, ramo, asesor, prod, cliente }
    return {
      aseg: opcionesDe(filas, f, 'aseg'),
      ramo: opcionesDe(filas, f, 'ramo'),
      prod: opcionesDe(filas, f, 'prod'),
      asesor: opcionesDe(filas, f, 'asesor'),
    }
  }, [filas, aseg, ramo, asesor, prod, cliente])

  const activos = contarFiltrosActivos(filtros)

  const limpiar = () => {
    setBusquedaTexto('')
    setClienteTexto('')
    setFiltros(FILTROS_VACIOS)
  }

  const irAVencimientos = () => setPestana('venc')

  const filtrarPorGrupo = (dim: Dimension, nombre: string) => {
    cambiar({ [dim]: nombre } as Partial<FiltrosReporte>)
    toast(`Filtrando por: ${nombre}`, {
      id: 'filtro-grupo',
      duration: 3000,
      action: { label: 'Quitar', onClick: () => cambiar({ [dim]: null } as Partial<FiltrosReporte>) },
    })
  }

  const exportar = async () => {
    setExportando(true)
    // Deja pintar el indicador antes de armar el archivo.
    await new Promise((r) => setTimeout(r, 50))
    try {
      const { descargarExcel } = await import('./excel')
      descargarExcel(filtradas, porVencer(filtradas, hoy, 0, 90), hoy)
      toast.success('Excel generado correctamente.')
    } catch (e) {
      toast.error(`Error al exportar: ${mensajeError(e)}`)
    } finally {
      setExportando(false)
    }
  }

  const datos = consulta.data
  const cargadasEn = datos?.cargadasEn

  // ── Carga inicial y error ────────────────────────────────────────────────
  if (!datos) {
    return (
      <div className="flex h-full flex-col">
        <EncabezadoPagina titulo="Reportes" />
        {consulta.isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <CloudOff className="size-14 text-line-strong" />
            <p className="max-w-md text-ink-soft">No se pudieron cargar los datos: {mensajeError(consulta.error)}</p>
            <Boton onClick={() => consulta.refetch()}>
              <RefreshCw />
              Reintentar
            </Boton>
          </div>
        ) : (
          <>
            <div className="h-1 w-full overflow-hidden bg-muted">
              <div className="h-full w-1/3 animate-pulse rounded bg-navy" />
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <div className="mb-6 flex size-24 animate-pulse items-center justify-center rounded-full bg-navy-soft">
                <ShieldCheck className="size-12 text-navy" />
              </div>
              {progreso === 0 ? (
                <p className="text-2xl font-bold text-navy">Conectando…</p>
              ) : (
                <>
                  <p className="num text-4xl font-bold text-navy">{fmtNum(progreso)}</p>
                  <p className="text-ink-soft">pólizas cargadas</p>
                </>
              )}
              <p className="mt-4 text-ink-soft">Cargando el historial completo de pólizas.</p>
              <p className="text-[12.5px] text-line-strong">Esto puede tardar unos segundos. No cierre esta página.</p>
            </div>
          </>
        )}
      </div>
    )
  }

  const encabezadoResumen = [
    cargadasEn ? `Datos cargados ${fmtFechaHora(cargadasEn)}` : null,
    `${fmtNum(filtradas.length)} pólizas`,
    clasif.sinFfin.length > 0 ? `${fmtNum(clasif.sinFfin.length)} sin fecha de vencimiento` : null,
    filtros.incluirAnuladas ? null : 'sin anuladas',
  ]
    .filter(Boolean)
    .join(' · ') + (activos > 0 ? ` (filtradas de ${fmtNum(filas.length)})` : '')

  const datosResumen: DatosResumen = {
    total: filtradas.length,
    vigentes: clasif.vigentes,
    vencidas: clasif.vencidas.length,
    sinFfin: clasif.sinFfin.length,
    primaTotal: clasif.primaTotal,
    pv30: vencimientos.pv30.length,
    pv60: vencimientos.pv60.length,
    pv90: vencimientos.pv90.length,
    topAseg: gruposCantidad.aseg.slice(0, 5),
    topRamo: gruposCantidad.ramo.slice(0, 5),
  }

  const secciones: SeccionVenc[] = [
    { clave: 'v30', titulo: 'Vencen en 0 – 30 días', filas: vencimientos.pv30, tono: 'peligro', icono: <AlertTriangle /> },
    { clave: 'v60', titulo: 'Vencen en 31 – 60 días', filas: vencimientos.pv60, tono: 'alerta', icono: <Clock /> },
    { clave: 'v90', titulo: 'Vencen en 61 – 90 días', filas: vencimientos.pv90, tono: 'ambar', icono: <CalendarClock /> },
  ].map((s) => ({ ...s, cantidad: s.filas.length, prima: sumarPrimas(s.filas) }) as SeccionVenc)
  secciones.push(
    {
      clave: 'vencidas',
      titulo: `Ya vencidas: ${fmtNum(clasif.vencidas.length)} en total — se muestran las ${fmtNum(Math.min(100, clasif.vencidas.length))} más recientes`,
      filas: clasif.vencidas.slice(0, 100),
      cantidad: clasif.vencidas.length,
      prima: sumarPrimas(clasif.vencidas),
      tono: 'neutro',
      icono: <CircleX />,
    },
    {
      clave: 'sinfecha',
      titulo: 'Sin fecha de vencimiento',
      filas: clasif.sinFfin,
      cantidad: clasif.sinFfin.length,
      prima: sumarPrimas(clasif.sinFfin),
      tono: 'neutro',
      icono: <CalendarX2 />,
    },
  )

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo="Reportes"
        subtitulo={
          <span>
            {cargadasEn && <>Datos cargados {fmtFechaHora(cargadasEn)} · </>}
            {fmtNum(filtradas.length)} de {fmtNum(filas.length)} pólizas
          </span>
        }
        acciones={
          <>
            <Boton
              variante={filtrosVisibles ? 'secundario' : 'fantasma'}
              tamano="sm"
              onClick={() => setFiltrosVisibles((v) => !v)}
              title={filtrosVisibles ? 'Ocultar filtros' : 'Mostrar filtros'}
            >
              {filtrosVisibles ? <FilterX /> : <Filter />}
              Filtros
              {activos > 0 && <span className="num rounded-full bg-danger px-1.5 text-[11px] text-white">{activos}</span>}
            </Boton>
            <Boton variante="verde" tamano="sm" onClick={exportar} cargando={exportando} title="Exportar a Excel lo que está filtrado">
              {!exportando && <FileSpreadsheet />}
              Exportar a Excel
            </Boton>
            <Boton
              variante="fantasma"
              tamano="icono"
              title="Recargar los datos"
              aria-label="Recargar los datos"
              onClick={() => consulta.refetch()}
              disabled={consulta.isFetching}
            >
              <RefreshCw className={consulta.isFetching ? 'animate-spin' : ''} />
            </Boton>
          </>
        }
      />
      <Contenido className="flex flex-col gap-3">
        {consulta.isFetching && (
          <Aviso tono="navy" icono={<Download />}>
            Recargando las pólizas… <b className="num">{fmtNum(progreso)}</b>
          </Aviso>
        )}
        {consulta.isError && (
          <Aviso icono={<AlertTriangle />}>No se pudieron recargar los datos: {mensajeError(consulta.error)}. Se muestran los cargados antes.</Aviso>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
          <Input
            className="pr-9 pl-9"
            placeholder="Buscar por código, póliza, cliente, documento, aseguradora, ramo, asesor…"
            value={busquedaTexto}
            onChange={(e) => setBusquedaTexto(e.target.value)}
          />
          {busquedaTexto && (
            <button
              type="button"
              aria-label="Borrar búsqueda"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-soft hover:bg-muted"
              onClick={() => {
                setBusquedaTexto('')
                cambiar({ busqueda: '' })
              }}
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {filtrosVisibles && (
          <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-52">
                <Input className="pr-8" placeholder="Cliente o documento" value={clienteTexto} onChange={(e) => setClienteTexto(e.target.value)} />
                {clienteTexto && (
                  <button
                    type="button"
                    aria-label="Quitar cliente"
                    className="absolute top-1/2 right-2 -translate-y-1/2 text-ink-soft"
                    onClick={() => {
                      setClienteTexto('')
                      cambiar({ cliente: '' })
                    }}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <FiltroOpciones etiqueta="Aseguradora" valor={filtros.aseg} opciones={opciones.aseg} onCambio={(v) => cambiar({ aseg: v })} />
              <FiltroOpciones etiqueta="Ramo" valor={filtros.ramo} opciones={opciones.ramo} onCambio={(v) => cambiar({ ramo: v })} />
              <FiltroOpciones etiqueta="Producto" valor={filtros.prod} opciones={opciones.prod} onCambio={(v) => cambiar({ prod: v })} />
              <FiltroOpciones etiqueta="Asesor" valor={filtros.asesor} opciones={opciones.asesor} onCambio={(v) => cambiar({ asesor: v })} />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <GrupoFechas
                etiqueta="F. vencimiento"
                valor={filtros.ffin}
                onCambio={(r) => cambiar({ ffin: r })}
                atajos={[
                  { texto: 'Próx. 30 días', rango: rangoDias(hoy, 0, 30) },
                  { texto: 'Próx. 90 días', rango: rangoDias(hoy, 0, 90) },
                  { texto: 'Próx. 180 días', rango: rangoDias(hoy, 0, 180) },
                ]}
              />
              <GrupoFechas
                etiqueta="F. registro"
                valor={filtros.freg}
                onCambio={(r) => cambiar({ freg: r })}
                atajos={[
                  { texto: 'Este mes', rango: rangoMes(hoy) },
                  { texto: 'Este año', rango: rangoAnio(hoy) },
                ]}
              />
              <GrupoFechas
                etiqueta="F. expedición"
                valor={filtros.fexp}
                onCambio={(r) => cambiar({ fexp: r })}
                atajos={[
                  { texto: 'Exp. este mes', rango: rangoMes(hoy) },
                  { texto: 'Exp. este año', rango: rangoAnio(hoy) },
                ]}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {ESTADOS.map((e) => (
                <Chip key={e.id} activo={filtros.estado === e.id} onClick={() => cambiar({ estado: e.id })}>
                  {e.texto}
                </Chip>
              ))}
              <span className="mx-1 h-5 w-px bg-line" />
              <Chip activo={filtros.incluirAnuladas} onClick={() => cambiar({ incluirAnuladas: !filtros.incluirAnuladas })}>
                Incluir anuladas
              </Chip>
              <span className="flex-1" />
              <span className="text-[12px] text-ink-soft">
                <span className="num">{fmtNum(filtradas.length)}</span> de <span className="num">{fmtNum(filas.length)}</span> pólizas
              </span>
              {activos > 0 && (
                <Boton variante="fantasma" tamano="sm" className="text-danger" onClick={limpiar}>
                  <X />
                  Limpiar
                </Boton>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto border-b border-line" role="tablist">
          {PESTANAS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={pestana === t.id}
              onClick={() => setPestana(t.id)}
              className={cn(
                '-mb-px shrink-0 border-b-2 px-4 py-2 text-[13.5px] font-semibold transition-colors',
                pestana === t.id ? 'border-navy text-navy' : 'border-transparent text-ink-soft hover:text-ink',
              )}
            >
              {t.texto}
            </button>
          ))}
        </div>

        <div className="pt-2 pb-6">
          {pestana === 'resumen' && (
            <Resumen
              d={datosResumen}
              encabezado={encabezadoResumen}
              onVigentes={() => {
                cambiar({ estado: 'vigentes' })
                setFiltrosVisibles(true)
              }}
              onVencidas={() => {
                cambiar({ estado: 'vencidas' })
                irAVencimientos()
              }}
              onSinFecha={irAVencimientos}
              onPorVencer={(desde, hasta) => {
                cambiar({ ffin: rangoDias(hoy, desde, hasta) })
                irAVencimientos()
              }}
              onGrupo={(dim, nombre) => {
                cambiar({ [dim]: nombre } as Partial<FiltrosReporte>)
                setPestana(dim === 'aseg' ? 'aseg' : 'ramo')
              }}
            />
          )}
          {(pestana === 'aseg' || pestana === 'ramo' || pestana === 'asesor') && (
            <Agrupado
              key={pestana}
              grupos={grupos[pestana]}
              titulo={TITULO_DIM[pestana]}
              total={filtradas.length}
              primaTotal={clasif.primaTotal}
              porPrima={porPrima}
              onCambiarOrden={() => setPorPrima((v) => !v)}
              activo={filtros[pestana]}
              onClickGrupo={(nombre) =>
                filtros[pestana] === nombre ? cambiar({ [pestana]: null } as Partial<FiltrosReporte>) : filtrarPorGrupo(pestana, nombre)
              }
            />
          )}
          {pestana === 'venc' && <Vencimientos secciones={secciones} hoy={hoy} />}
        </div>
      </Contenido>
    </div>
  )
}

/** Selector de rango con sus atajos (Próx. 30 días, Este mes…). */
function GrupoFechas({
  etiqueta,
  valor,
  onCambio,
  atajos,
}: {
  etiqueta: string
  valor: RangoFechas
  onCambio: (r: RangoFechas) => void
  atajos: { texto: string; rango: RangoFechas }[]
}): ReactNode {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <SelectorRango etiqueta={etiqueta} valor={valor} onCambio={(r) => onCambio(r.desde || r.hasta ? r : SIN_RANGO)} />
      {(valor.desde || valor.hasta) && <span className="text-[11.5px] text-ink-soft">{etiqueta}</span>}
      {atajos.map((a) => (
        <Chip key={a.texto} activo={mismoRango(valor, a.rango)} onClick={() => onCambio(mismoRango(valor, a.rango) ? SIN_RANGO : a.rango)}>
          {a.texto}
        </Chip>
      ))}
    </div>
  )
}
