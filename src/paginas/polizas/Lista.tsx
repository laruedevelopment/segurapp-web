import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { toast } from 'sonner'
import { AlertCircle, Columns3, CopyCheck, Download, FilePlus2, Inbox, ListChecks, Loader2, Pencil, RefreshCw, Search, Trash2, Upload, Wallet, X } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Aviso, Cargando, MensajeError, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { CasillaTactil, Input } from '@/components/ui/campos'
import { FiltroOpciones } from '@/components/ui/filtro-opciones'
import { ItemMenu, MenuAcciones } from '@/components/ui/menu'
import { Tabla, restablecerColumnas, type Columna } from '@/components/ui/tabla'
import { useCargaMasiva } from '@/datos/cargaMasiva'
import { useConteoEliminaciones } from '@/datos/eliminacion'
import {
  MAX_SELECCION,
  alternarSeleccion,
  elegidasVisibles,
  plural,
  seleccionarVisibles,
} from '@/datos/eliminacionLogica'
import { contarPendientes } from '@/datos/pendientes'
import { listarPolizasRecientes, listarTodasPolizas } from '@/datos/polizas'
import { CLAVE_TODAS, usePolizasTodas, useProgresoPolizas } from '@/datos/usePolizas'
import { aFecha, aFechaHora, fmtFecha, fmtFechaHora } from '@/lib/fechas'
import { fmtDinero, fmtDoc, fmtNum } from '@/lib/numeros'
import { esAdmin, useSesion, veComisiones } from '@/lib/sesion'
import type { PolizaLista } from '@/lib/tipos'
import { useEsAncha, useMediaQuery } from '@/lib/useMediaQuery'
import { mensajeError } from '@/lib/utils'
import DialogoEliminar from './DialogoEliminar'
import { alternarTodasVisibles, estadoSeleccionVisibles } from './seleccionLogica'
import { TarjetaPoliza } from './TarjetaPoliza'

const LIMITE_RAPIDO = 500

const docCliente = (p: PolizaLista) =>
  p.doc_cliente ? `${p.tipodoc_cliente ? p.tipodoc_cliente + ' ' : ''}${fmtDoc(p.doc_cliente)}` : ''

const boton40 = 'h-10 md:h-8'

const dinero = (n: number | null) => (n ? fmtDinero(n) : '—')

interface AccionLista {
  clave: string
  icono: ReactNode
  texto: string
  onClick: () => void
  disabled?: boolean
  insignia?: ReactNode
}

export default function ListaPolizas() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [quiereTodas, setQuiereTodas] = useState(() => !!qc.getQueryData(CLAVE_TODAS))
  const [fCliente, setFCliente] = useState('')
  const [fAseg, setFAseg] = useState<string | null>(null)
  const [fRamo, setFRamo] = useState<string | null>(null)
  const [fProd, setFProd] = useState<string | null>(null)
  const [fAsesor, setFAsesor] = useState<string | null>(null)
  const clienteDiferido = useDeferredValue(fCliente)

  // Selección para eliminar (la autoriza un administrador).
  const sesion = useSesion()
  const admin = esAdmin(sesion?.usuario)
  const verPagos = veComisiones(sesion?.usuario)
  const ancha = useEsAncha()
  const carga = useCargaMasiva()
  const conteoEliminaciones = useConteoEliminaciones()
  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [paraEliminar, setParaEliminar] = useState<{ polizas: PolizaLista[]; grupo: boolean } | null>(null)

  // Búsqueda en el servidor, 400 ms después de la última tecla.
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto.trim()), 400)
    return () => clearTimeout(t)
  }, [texto])

  const hayFiltros = !!(fCliente || fAseg || fRamo || fProd || fAsesor)
  // Un filtro necesita todas las pólizas (no solo las 500 más recientes).
  useEffect(() => {
    if (hayFiltros) setQuiereTodas(true)
  }, [hayFiltros])

  const todas = usePolizasTodas(quiereTodas && !busqueda)
  const progreso = useProgresoPolizas()

  const recientes = useQuery({
    queryKey: ['polizas', 'recientes'],
    queryFn: () => listarPolizasRecientes(LIMITE_RAPIDO),
    enabled: !busqueda && !todas.data,
    staleTime: 60_000,
  })

  const resultadoBusqueda = useQuery({
    queryKey: ['polizas', 'busqueda', busqueda],
    queryFn: ({ signal }) => listarTodasPolizas(busqueda, undefined, signal),
    enabled: !!busqueda,
    staleTime: 60_000,
  })

  const pendientes = useQuery({ queryKey: ['pendientes', 'conteo'], queryFn: contarPendientes, staleTime: 30_000 })

  const fuente = busqueda ? resultadoBusqueda : todas.data ? todas : recientes
  const polizas: PolizaLista[] = useMemo(() => {
    if (busqueda) return resultadoBusqueda.data ?? []
    if (todas.data) return todas.data.polizas
    return recientes.data ?? []
  }, [busqueda, resultadoBusqueda.data, todas.data, recientes.data])
  const completas = !!busqueda || !!todas.data || (recientes.data?.length ?? 0) < LIMITE_RAPIDO

  const cumple = useMemo(() => {
    const q = clienteDiferido.trim().toLowerCase()
    const qDoc = q.replace(/\./g, '')
    return (p: PolizaLista, excluir?: string) =>
      (excluir === 'aseg' || !fAseg || p.nombre_aseg === fAseg) &&
      (excluir === 'ramo' || !fRamo || p.nombre_ramo === fRamo) &&
      (excluir === 'prod' || !fProd || p.nombre_prod === fProd) &&
      (excluir === 'asesor' || !fAsesor || p.nombre_asesor === fAsesor) &&
      (excluir === 'cliente' ||
        !q ||
        (p.nombre_cliente ?? '').toLowerCase().includes(q) ||
        (!!qDoc && (p.doc_cliente ?? '').toLowerCase().includes(qDoc)))
  }, [fAseg, fRamo, fProd, fAsesor, clienteDiferido])

  const filtradas = useMemo(() => polizas.filter((p) => cumple(p)), [polizas, cumple])

  // Opciones de cada filtro según los demás filtros (cascada).
  const opciones = useMemo(() => {
    const de = (excluir: string, campo: (p: PolizaLista) => string | null) =>
      [...new Set(polizas.filter((p) => cumple(p, excluir)).map(campo).filter((s): s is string => !!s))].sort((a, b) =>
        a.localeCompare(b, 'es'),
      )
    return {
      aseg: de('aseg', (p) => p.nombre_aseg),
      ramo: de('ramo', (p) => p.nombre_ramo),
      prod: de('prod', (p) => p.nombre_prod),
      asesor: de('asesor', (p) => p.nombre_asesor),
    }
  }, [polizas, cumple])

  // Solo cuentan las seleccionadas que se ven con la búsqueda y los filtros de ahora.
  const elegidas = useMemo(() => elegidasVisibles(filtradas, sel), [filtradas, sel])
  const ocultasSel = sel.size - elegidas.length

  const alternarFila = (id: number) => {
    const r = alternarSeleccion(sel, id)
    if (r.excedido) toast.error(`Máximo ${MAX_SELECCION} pólizas por vez.`)
    setSel(r.sel)
  }
  const salirSeleccion = () => {
    setModoSeleccion(false)
    setSel(new Set())
  }
  const seleccionarTodasVisibles = () => {
    const r = seleccionarVisibles(filtradas)
    setSel(r.sel)
    if (r.recortado) toast.info(`Se seleccionaron las primeras ${MAX_SELECCION} (máximo por vez).`)
  }
  const alternarTodas = () => {
    const r = alternarTodasVisibles(filtradas, sel)
    setSel(r.sel)
    if (r.recortado) toast.info(`Se seleccionaron las primeras ${MAX_SELECCION} (máximo por vez).`)
  }
  const estadoTodas = estadoSeleccionVisibles(filtradas, sel)
  const alMarcar = (marcadas: number[]) => {
    const grupo = paraEliminar?.grupo ?? false
    setParaEliminar(null)
    if (grupo) {
      // Eliminación del grupo seleccionado: se sale del modo selección.
      salirSeleccion()
    } else {
      // Papelera de una fila: no se pierde el resto de la selección.
      setSel((a) => new Set([...a].filter((id) => !marcadas.includes(id))))
    }
  }

  const limpiarFiltros = () => {
    setFCliente('')
    setFAseg(null)
    setFRamo(null)
    setFProd(null)
    setFAsesor(null)
  }

  // Alt+N: nueva póliza.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        navigate('/polizas/nueva')
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [navigate])

  const [versionColumnas, setVersionColumnas] = useState(0)
  const recargar = () => {
    if (busqueda) resultadoBusqueda.refetch()
    else if (todas.data) todas.refetch()
    else recientes.refetch()
  }

  // En pantallas anchas los botones van a la vista; en las angostas se agrupan en "Más acciones".
  const anchoCompleto = useMediaQuery('(min-width: 1024px)')
  const accionesSecundarias: AccionLista[] = [
    { clave: 'carga', icono: <Upload />, texto: 'Carga masiva', onClick: () => navigate('/polizas/carga-masiva') },
    { clave: 'repetidas', icono: <CopyCheck />, texto: 'Repetidas', onClick: () => navigate('/polizas/duplicadas') },
    {
      clave: 'seleccion',
      icono: modoSeleccion ? <X /> : <ListChecks />,
      texto: modoSeleccion ? 'Salir de la selección' : 'Eliminar varias',
      onClick: () => (modoSeleccion ? salirSeleccion() : setModoSeleccion(true)),
    },
    ...(admin
      ? [
          {
            clave: 'autorizar',
            icono: <Trash2 />,
            texto: 'Por autorizar',
            onClick: () => navigate('/polizas/eliminaciones'),
            insignia: !!conteoEliminaciones.data && (
              <span className="num rounded-full bg-danger px-1.5 text-[11px] text-white">
                <span aria-hidden="true">{conteoEliminaciones.data}</span>
                <span className="sr-only"> por autorizar</span>
              </span>
            ),
          },
        ]
      : []),
    {
      clave: 'recargar',
      icono: <RefreshCw className={fuente.isFetching ? 'animate-spin' : ''} />,
      texto: 'Recargar',
      disabled: fuente.isFetching,
      onClick: recargar,
    },
  ]
  const restablecer: AccionLista = {
    clave: 'columnas',
    icono: <Columns3 />,
    texto: 'Restablecer columnas',
    onClick: () => {
      restablecerColumnas('polizas')
      setVersionColumnas((v) => v + 1)
    },
  }

  const columnas: Columna<PolizaLista>[] = [
    ...(modoSeleccion
      ? [
          {
            id: 'sel',
            titulo: (
              <CasillaTactil
                className="-my-2.5"
                label="Seleccionar todas las visibles"
                checked={estadoTodas === 'todas'}
                indeterminada={estadoTodas === 'algunas'}
                onChange={alternarTodas}
              />
            ),
            ancho: 50,
            alinear: 'centro' as const,
            celda: (p: PolizaLista) => (
              <CasillaTactil
                label={`Seleccionar la póliza ${p.nro_poliza ?? p.id}`}
                checked={sel.has(p.id)}
                onChange={() => alternarFila(p.id)}
              />
            ),
          },
        ]
      : []),
    { id: 'id', titulo: 'Cód.', ancho: 72, alinear: 'der', celda: (p) => <span className="num">{p.id}</span>, ordenar: (p) => p.id },
    {
      id: 'nro',
      titulo: 'Nro. póliza',
      ancho: 150,
      celda: (p) => <span className="num font-semibold">{p.nro_poliza ?? '—'}</span>,
      ordenar: (p) => p.nro_poliza,
      titleDe: (p) => p.nro_poliza ?? undefined,
    },
    {
      id: 'bien',
      titulo: 'Bien asegurado',
      ancho: 165,
      celda: (p) => (
        <div className="leading-tight">
          <div className="truncate">{p.bien_asegurado ?? '—'}</div>
          {!!p.vlraseg_poliza && <div className="num truncate text-[11.5px] text-ink-soft">{fmtDinero(p.vlraseg_poliza)}</div>}
        </div>
      ),
      ordenar: (p) => p.bien_asegurado?.toLowerCase(),
      titleDe: (p) => p.bien_asegurado ?? undefined,
    },
    {
      id: 'cliente',
      titulo: 'Cliente',
      ancho: 210,
      celda: (p) => (
        <div className="leading-tight">
          <div className="truncate">
            {p.nombre_cliente ?? '—'}
            {p.cliente_id != null && <span className="ml-1 text-[10.5px] text-ink-soft">#{p.cliente_id}</span>}
          </div>
          {p.doc_cliente && <div className="num truncate text-[11.5px] text-ink-soft">{docCliente(p)}</div>}
        </div>
      ),
      ordenar: (p) => p.nombre_cliente?.toLowerCase(),
      titleDe: (p) => [p.nombre_cliente, docCliente(p)].filter(Boolean).join('\n'),
    },
    { id: 'aseg', titulo: 'Aseguradora', ancho: 130, celda: (p) => p.nombre_aseg ?? '—', ordenar: (p) => p.nombre_aseg?.toLowerCase(), titleDe: (p) => p.nombre_aseg ?? undefined },
    {
      id: 'ramo',
      titulo: 'Ramo / Producto',
      ancho: 150,
      celda: (p) => (
        <div className="leading-tight">
          <div className="truncate font-medium">{p.nombre_ramo ?? '—'}</div>
          {p.nombre_prod && <div className="truncate text-[11.5px] text-ink-soft">{p.nombre_prod}</div>}
        </div>
      ),
      ordenar: (p) => p.nombre_ramo?.toLowerCase(),
      titleDe: (p) => [p.nombre_ramo, p.nombre_prod].filter(Boolean).join('\n'),
    },
    { id: 'fini', titulo: 'F. inicio', ancho: 94, celda: (p) => <span className="num">{fmtFecha(aFecha(p.fini_poliza)) || '—'}</span>, ordenar: (p) => p.fini_poliza },
    { id: 'ffin', titulo: 'F. vence', ancho: 94, celda: (p) => <span className="num">{fmtFecha(aFecha(p.ffin_poliza)) || '—'}</span>, ordenar: (p) => p.ffin_poliza },
    { id: 'prima', titulo: 'V. prima', ancho: 110, alinear: 'der', celda: (p) => <span className="num">{dinero(p.prima_poliza)}</span>, ordenar: (p) => p.prima_poliza },
    { id: 'valor', titulo: 'V. total', ancho: 110, alinear: 'der', celda: (p) => <span className="num">{dinero(p.valor_poliza)}</span>, ordenar: (p) => p.valor_poliza },
    { id: 'fexp', titulo: 'F. exp.', ancho: 94, celda: (p) => <span className="num">{fmtFecha(aFecha(p.fexp_poliza)) || '—'}</span>, ordenar: (p) => p.fexp_poliza },
    { id: 'asesor', titulo: 'Asesor', ancho: 62, celda: (p) => p.nombre_asesor ?? '—', ordenar: (p) => p.nombre_asesor?.toLowerCase(), titleDe: (p) => p.nombre_asesor ?? undefined },
    {
      id: 'fcreado',
      titulo: 'Registro / Últ. mod.',
      ancho: 145,
      celda: (p) => (
        <div className="num leading-tight">
          <div className="text-[12px]">{fmtFechaHora(aFechaHora(p.fcreado)) || '—'}</div>
          {p.fultmod && <div className="text-[11px] text-ink-soft">{fmtFechaHora(aFechaHora(p.fultmod))}</div>}
        </div>
      ),
      ordenar: (p) => p.fcreado,
    },
    { id: 'usuario', titulo: 'Usuario', ancho: 78, celda: (p) => p.apodo_usuario ?? '—', ordenar: (p) => p.apodo_usuario?.toLowerCase() },
    {
      id: 'acciones',
      titulo: <span className="sr-only">Acciones</span>,
      ancho: 140,
      celda: (p) => (
        <div className="flex">
          {!modoSeleccion && (
            <>
              <Link
                to={`/polizas/${p.id}`}
                title="Editar"
                aria-label={`Editar la póliza ${p.nro_poliza ?? p.id}`}
                className="flex size-11 items-center justify-center rounded-lg text-ink-soft hover:bg-muted hover:text-navy"
              >
                <Pencil className="size-4" />
              </Link>
              {verPagos && (
                <Link
                  to={`/polizas/${p.id}/pagos`}
                  title="Ver pagos"
                  aria-label={`Ver pagos de la póliza ${p.nro_poliza ?? p.id}`}
                  className="flex size-11 items-center justify-center rounded-lg text-ink-soft hover:bg-muted hover:text-green"
                >
                  <Wallet className="size-4" />
                </Link>
              )}
              <button
                type="button"
                title="Eliminar (la autoriza un administrador)"
                aria-label={`Eliminar la póliza ${p.nro_poliza ?? p.id}`}
                onClick={() => setParaEliminar({ polizas: [p], grupo: false })}
                className="flex size-11 items-center justify-center rounded-lg text-ink-soft hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  const vacio = (
    <Vacio
      titulo={polizas.length ? 'Ninguna póliza coincide con los filtros' : 'No se encontraron pólizas'}
      detalle={hayFiltros ? 'Pruebe quitando algún filtro.' : undefined}
    />
  )
  // Mismo orden que la tabla al abrirla: código de mayor a menor.
  const tarjetas = useMemo(() => (ancha ? [] : [...filtradas].sort((a, b) => b.id - a.id)), [ancha, filtradas])

  const cargandoTodas = todas.isFetching && !busqueda

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo="Pólizas"
        subtitulo={
          fuente.isSuccess
            ? `${fmtNum(filtradas.length)} de ${fmtNum(polizas.length)} pólizas${completas ? '' : ' (las más recientes)'}`
            : undefined
        }
        acciones={
          <>
            {carga.procesando && (
              <Link
                to="/polizas/carga-masiva"
                role="status"
                title="Ver el detalle de la carga masiva"
                className="num inline-flex h-10 items-center gap-1.5 rounded-full bg-navy-soft px-3 text-[12.5px] font-semibold text-navy-dark md:h-8"
              >
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Cargando {carga.procesados}/{carga.total}
              </Link>
            )}
            <Link to="/polizas/pendientes">
              <Boton variante="secundario" tamano="sm" className={boton40}>
                <Inbox />
                Pendientes
                {!!pendientes.data && (
                  <span className="num rounded-full bg-warning-soft px-1.5 text-[11px] font-semibold text-warning-ink">
                    <span aria-hidden="true">{pendientes.data}</span>
                    <span className="sr-only">{pendientes.data === 1 ? '1 pendiente' : `${pendientes.data} pendientes`}</span>
                  </span>
                )}
              </Boton>
            </Link>
            {anchoCompleto ? (
              <>
                {accionesSecundarias.map((x) => (
                  <Boton key={x.clave} variante="secundario" tamano="sm" className={boton40} disabled={x.disabled} onClick={x.onClick}>
                    {x.icono}
                    {x.texto}
                    {x.insignia}
                  </Boton>
                ))}
                <MenuAcciones etiqueta="Más">
                  <ItemMenu icono={restablecer.icono} onSelect={restablecer.onClick}>
                    {restablecer.texto}
                  </ItemMenu>
                </MenuAcciones>
              </>
            ) : (
              <MenuAcciones>
                {[...accionesSecundarias, restablecer].map((x) => (
                  <ItemMenu key={x.clave} icono={x.icono} disabled={x.disabled} onSelect={x.onClick} insignia={x.insignia}>
                    {x.texto}
                  </ItemMenu>
                ))}
              </MenuAcciones>
            )}
            <Link to="/polizas/nueva">
              <Boton variante="verde" tamano="sm" className={boton40} title="Nueva póliza (Alt+N)">
                <FilePlus2 />
                Nueva póliza
              </Boton>
            </Link>
          </>
        }
      />
      <Contenido className="flex min-h-0 max-w-none flex-1 flex-col gap-3">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
          <Input
            className="pl-9"
            aria-label="Buscar pólizas"
            placeholder="Buscar por código, nro. póliza, cliente, documento, aseguradora, ramo, asesor…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-56">
            <Input className="h-10 pr-8" aria-label="Filtrar por cliente o documento" placeholder="Cliente o documento" value={fCliente} onChange={(e) => setFCliente(e.target.value)} />
            {fCliente && (
              <button type="button" aria-label="Borrar el filtro de cliente" className="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-ink-soft" onClick={() => setFCliente('')}>
                <X className="size-4" />
              </button>
            )}
          </div>
          <FiltroOpciones etiqueta="Aseguradora" valor={fAseg} opciones={opciones.aseg} onCambio={setFAseg} />
          <FiltroOpciones etiqueta="Ramo" valor={fRamo} opciones={opciones.ramo} onCambio={setFRamo} />
          <FiltroOpciones etiqueta="Producto" valor={fProd} opciones={opciones.prod} onCambio={setFProd} />
          <FiltroOpciones etiqueta="Asesor" valor={fAsesor} opciones={opciones.asesor} onCambio={setFAsesor} />
          {hayFiltros && (
            <Boton variante="fantasma" tamano="sm" onClick={limpiarFiltros}>
              <X />
              Limpiar
            </Boton>
          )}
        </div>

        {modoSeleccion && (
          <div className="sticky bottom-0 z-20 order-last -mx-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-navy-soft px-4 py-2 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] md:static md:order-none md:mx-0 md:rounded-[10px] md:border-t-0 md:shadow-none">
            <span className="font-semibold" aria-live="polite">
              {elegidas.length === 0
                ? 'Toque las pólizas que quiere eliminar'
                : plural(elegidas.length, 'póliza seleccionada', 'pólizas seleccionadas')}
              {ocultasSel > 0 &&
                ` (${plural(ocultasSel, 'más quedó oculta', 'más quedaron ocultas')} por el filtro y no se ${ocultasSel === 1 ? 'incluye' : 'incluyen'})`}
            </span>
            <Boton variante="fantasma" tamano="sm" className={boton40} disabled={filtradas.length === 0} onClick={seleccionarTodasVisibles}>
              {filtradas.length > MAX_SELECCION
                ? `Seleccionar las primeras ${MAX_SELECCION} de ${fmtNum(filtradas.length)}`
                : `Seleccionar todas las visibles (${fmtNum(filtradas.length)})`}
            </Boton>
            {sel.size > 0 && (
              <Boton variante="fantasma" tamano="sm" className={boton40} onClick={() => setSel(new Set())}>
                Quitar selección
              </Boton>
            )}
            <div className="flex w-full items-center justify-between gap-3 md:ml-auto md:w-auto">
              <Boton
                variante="peligro"
                tamano="sm"
                className={boton40}
                disabled={elegidas.length === 0}
                onClick={() => setParaEliminar({ polizas: elegidas, grupo: true })}
              >
                <Trash2 />
                Eliminar ({elegidas.length})
              </Boton>
              <Boton variante="secundario" tamano="sm" className={boton40} onClick={salirSeleccion}>
                Cancelar
              </Boton>
            </div>
          </div>
        )}

        {cargandoTodas && (
          <Aviso tono="navy" icono={<Download />}>
            Cargando todas las pólizas… <b className="num">{fmtNum(progreso)}</b>
          </Aviso>
        )}
        {!busqueda && !todas.data && !cargandoTodas && recientes.isSuccess && !completas && (
          <Aviso tono="navy" icono={<AlertCircle />}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1">Mostrando las {fmtNum(polizas.length)} pólizas más recientes.</span>
              <Boton tamano="sm" variante="secundario" onClick={() => setQuiereTodas(true)}>
                <Download />
                Cargar todas
              </Boton>
            </div>
          </Aviso>
        )}

        {fuente.isError && !polizas.length ? (
          <MensajeError
            error={
              <div className="flex items-center gap-3">
                <span className="flex-1">No se pudieron cargar las pólizas: {mensajeError(fuente.error)}</span>
                <Boton tamano="sm" variante="secundario" onClick={recargar}>
                  Reintentar
                </Boton>
              </div>
            }
          />
        ) : fuente.isPending && !polizas.length ? (
          <Cargando texto="Cargando pólizas…" />
        ) : (
          ancha ? (
            <Tabla
              key={versionColumnas}
              className="min-h-[320px] flex-1"
              claveAnchos="polizas"
              filas={filtradas}
              columnas={columnas}
              clave={(p) => p.id}
              ordenInicial={{ columna: 'id', asc: false }}
              alHacerClic={(p) => (modoSeleccion ? alternarFila(p.id) : navigate(`/polizas/${p.id}`))}
              claseFila={(p) => (sel.has(p.id) ? 'bg-navy-soft' : undefined)}
              vacio={vacio}
            />
          ) : (
            <ListaTarjetas
              filas={tarjetas}
              vacio={vacio}
              modoSeleccion={modoSeleccion}
              sel={sel}
              onAbrir={(p) => navigate(`/polizas/${p.id}`)}
              onAlternar={(p) => alternarFila(p.id)}
              onEntrarSeleccion={(p) => {
                setModoSeleccion(true)
                setSel(new Set([p.id]))
              }}
              onEliminar={(p) => setParaEliminar({ polizas: [p], grupo: false })}
            />
          )
        )}
        <p className="hidden text-[12px] text-ink-soft md:block">Atajo: Alt+N crea una póliza nueva.</p>
      </Contenido>
      <DialogoEliminar
        polizas={paraEliminar?.polizas ?? []}
        abierto={!!paraEliminar}
        onCerrar={() => setParaEliminar(null)}
        onHecho={alMarcar}
      />
    </div>
  )
}

/** Lista de tarjetas con scroll virtual (pantallas angostas). */
function ListaTarjetas({
  filas,
  vacio,
  modoSeleccion,
  sel,
  onAbrir,
  onAlternar,
  onEntrarSeleccion,
  onEliminar,
}: {
  filas: PolizaLista[]
  vacio: ReactNode
  modoSeleccion: boolean
  sel: ReadonlySet<number>
  onAbrir: (p: PolizaLista) => void
  onAlternar: (p: PolizaLista) => void
  onEntrarSeleccion: (p: PolizaLista) => void
  onEliminar: (p: PolizaLista) => void
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  const virtual = useVirtualizer({
    count: filas.length,
    getScrollElement: () => contenedor.current,
    estimateSize: () => 210,
    overscan: 6,
  })
  return (
    <div ref={contenedor} className="min-h-[320px] flex-1 overflow-auto">
      {filas.length === 0 ? (
        vacio
      ) : (
        <div style={{ height: virtual.getTotalSize(), position: 'relative' }}>
          {virtual.getVirtualItems().map((v) => {
            const p = filas[v.index]
            return (
              <div
                key={p.id}
                data-index={v.index}
                ref={virtual.measureElement}
                className="absolute top-0 left-0 w-full pb-2"
                style={{ transform: `translateY(${v.start}px)` }}
              >
                <TarjetaPoliza
                  p={p}
                  modoSeleccion={modoSeleccion}
                  marcada={sel.has(p.id)}
                  onAbrir={() => onAbrir(p)}
                  onAlternar={() => onAlternar(p)}
                  onEntrarSeleccion={() => onEntrarSeleccion(p)}
                  onEliminar={() => onEliminar(p)}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
