import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertCircle, CopyCheck, Download, FilePlus2, Inbox, ListChecks, Pencil, RefreshCw, Search, Trash2, Upload, Wallet, X } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Aviso, Cargando, MensajeError, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { Input } from '@/components/ui/campos'
import { FiltroOpciones } from '@/components/ui/filtro-opciones'
import { Tabla, type Columna } from '@/components/ui/tabla'
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
import { esAdmin, useSesion } from '@/lib/sesion'
import type { PolizaLista } from '@/lib/tipos'
import { mensajeError } from '@/lib/utils'
import DialogoEliminar from './DialogoEliminar'

const LIMITE_RAPIDO = 500

const docCliente = (p: PolizaLista) =>
  p.doc_cliente ? `${p.tipodoc_cliente ? p.tipodoc_cliente + ' ' : ''}${fmtDoc(p.doc_cliente)}` : ''

const dinero = (n: number | null) => (n ? fmtDinero(n) : '—')

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

  const recargar = () => {
    if (busqueda) resultadoBusqueda.refetch()
    else if (todas.data) todas.refetch()
    else recientes.refetch()
  }

  const columnas: Columna<PolizaLista>[] = [
    ...(modoSeleccion
      ? [
          {
            id: 'sel',
            titulo: '',
            ancho: 44,
            alinear: 'centro' as const,
            celda: (p: PolizaLista) => (
              <input
                type="checkbox"
                className="size-4 accent-navy"
                aria-label={`Seleccionar la póliza ${p.nro_poliza ?? p.id}`}
                checked={sel.has(p.id)}
                onChange={() => alternarFila(p.id)}
              />
            ),
          },
        ]
      : []),
    { id: 'id', titulo: 'Cód.', ancho: 70, alinear: 'der', celda: (p) => <span className="num">{p.id}</span>, ordenar: (p) => p.id },
    {
      id: 'nro',
      titulo: 'Nro. póliza',
      ancho: 180,
      celda: (p) => <span className="num font-semibold">{p.nro_poliza ?? '—'}</span>,
      ordenar: (p) => p.nro_poliza,
      titleDe: (p) => p.nro_poliza ?? undefined,
    },
    {
      id: 'bien',
      titulo: 'Bien asegurado',
      ancho: 170,
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
      ancho: 230,
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
    { id: 'aseg', titulo: 'Aseguradora', ancho: 160, celda: (p) => p.nombre_aseg ?? '—', ordenar: (p) => p.nombre_aseg?.toLowerCase(), titleDe: (p) => p.nombre_aseg ?? undefined },
    {
      id: 'ramo',
      titulo: 'Ramo / Producto',
      ancho: 170,
      celda: (p) => (
        <div className="leading-tight">
          <div className="truncate font-medium">{p.nombre_ramo ?? '—'}</div>
          {p.nombre_prod && <div className="truncate text-[11.5px] text-ink-soft">{p.nombre_prod}</div>}
        </div>
      ),
      ordenar: (p) => p.nombre_ramo?.toLowerCase(),
      titleDe: (p) => [p.nombre_ramo, p.nombre_prod].filter(Boolean).join('\n'),
    },
    { id: 'fini', titulo: 'F. inicio', ancho: 95, celda: (p) => <span className="num">{fmtFecha(aFecha(p.fini_poliza)) || '—'}</span>, ordenar: (p) => p.fini_poliza },
    { id: 'ffin', titulo: 'F. vence', ancho: 95, celda: (p) => <span className="num">{fmtFecha(aFecha(p.ffin_poliza)) || '—'}</span>, ordenar: (p) => p.ffin_poliza },
    { id: 'prima', titulo: 'V. prima', ancho: 120, alinear: 'der', celda: (p) => <span className="num">{dinero(p.prima_poliza)}</span>, ordenar: (p) => p.prima_poliza },
    { id: 'valor', titulo: 'V. total', ancho: 120, alinear: 'der', celda: (p) => <span className="num">{dinero(p.valor_poliza)}</span>, ordenar: (p) => p.valor_poliza },
    { id: 'fexp', titulo: 'F. exp.', ancho: 95, celda: (p) => <span className="num">{fmtFecha(aFecha(p.fexp_poliza)) || '—'}</span>, ordenar: (p) => p.fexp_poliza },
    { id: 'asesor', titulo: 'Asesor', ancho: 130, celda: (p) => p.nombre_asesor ?? '—', ordenar: (p) => p.nombre_asesor?.toLowerCase(), titleDe: (p) => p.nombre_asesor ?? undefined },
    {
      id: 'fcreado',
      titulo: 'Registro / Últ. mod.',
      ancho: 140,
      celda: (p) => (
        <div className="num leading-tight">
          <div className="text-[12px]">{fmtFechaHora(aFechaHora(p.fcreado)) || '—'}</div>
          {p.fultmod && <div className="text-[11px] text-ink-soft">{fmtFechaHora(aFechaHora(p.fultmod))}</div>}
        </div>
      ),
      ordenar: (p) => p.fcreado,
    },
    { id: 'usuario', titulo: 'Usuario', ancho: 90, celda: (p) => p.apodo_usuario ?? '—', ordenar: (p) => p.apodo_usuario?.toLowerCase() },
    {
      id: 'acciones',
      titulo: '',
      ancho: 120,
      celda: (p) => (
        <div className="flex gap-0.5">
          <Link to={`/polizas/${p.id}`} title="Editar" className="rounded-lg p-2 text-ink-soft hover:bg-muted hover:text-navy">
            <Pencil className="size-4" />
          </Link>
          <Link to={`/polizas/${p.id}/pagos`} title="Ver pagos" className="rounded-lg p-2 text-ink-soft hover:bg-muted hover:text-green">
            <Wallet className="size-4" />
          </Link>
          {!modoSeleccion && (
            <button
              type="button"
              title="Eliminar (la autoriza un administrador)"
              aria-label={`Eliminar la póliza ${p.nro_poliza ?? p.id}`}
              onClick={() => setParaEliminar({ polizas: [p], grupo: false })}
              className="rounded-lg p-2 text-ink-soft hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

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
            <Link to="/polizas/pendientes">
              <Boton variante="secundario" tamano="sm">
                <Inbox />
                Pendientes
                {!!pendientes.data && (
                  <span className="num rounded-full bg-warning px-1.5 text-[11px] text-white">{pendientes.data}</span>
                )}
              </Boton>
            </Link>
            <Link to="/polizas/carga-masiva">
              <Boton variante="secundario" tamano="sm" title="Carga masiva de pólizas (PDF/imagen con IA)">
                <Upload />
                Carga masiva
              </Boton>
            </Link>
            <Link to="/polizas/duplicadas">
              <Boton variante="secundario" tamano="sm" title="Pólizas con número repetido">
                <CopyCheck />
                Repetidas
              </Boton>
            </Link>
            <Boton
              variante={modoSeleccion ? 'primario' : 'secundario'}
              tamano="sm"
              title={modoSeleccion ? 'Salir de la selección' : 'Seleccionar varias pólizas para eliminar'}
              onClick={() => (modoSeleccion ? salirSeleccion() : setModoSeleccion(true))}
            >
              {modoSeleccion ? <X /> : <ListChecks />}
              {modoSeleccion ? 'Salir de la selección' : 'Eliminar varias'}
            </Boton>
            {admin && (
              <Link to="/polizas/eliminaciones">
                <Boton variante="secundario" tamano="sm" title="Eliminaciones por autorizar">
                  <Trash2 />
                  Por autorizar
                  {!!conteoEliminaciones.data && (
                    <span className="num rounded-full bg-danger px-1.5 text-[11px] text-white">{conteoEliminaciones.data}</span>
                  )}
                </Boton>
              </Link>
            )}
            <Boton variante="fantasma" tamano="icono" title="Recargar" onClick={recargar} disabled={fuente.isFetching}>
              <RefreshCw className={fuente.isFetching ? 'animate-spin' : ''} />
            </Boton>
            <Link to="/polizas/nueva">
              <Boton variante="verde" tamano="sm" title="Nueva póliza (Alt+N)">
                <FilePlus2 />
                Nueva póliza
              </Boton>
            </Link>
          </>
        }
      />
      <Contenido className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
          <Input
            className="pl-9"
            placeholder="Buscar por código, nro. póliza, cliente, documento, aseguradora, ramo, asesor…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-56">
            <Input className="h-10 pr-8" placeholder="Cliente o documento" value={fCliente} onChange={(e) => setFCliente(e.target.value)} />
            {fCliente && (
              <button type="button" className="absolute top-1/2 right-2 -translate-y-1/2 text-ink-soft" onClick={() => setFCliente('')}>
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] bg-navy-soft px-4 py-2">
            <span className="font-semibold">
              {elegidas.length === 0
                ? 'Marque las pólizas que quiere eliminar'
                : plural(elegidas.length, 'póliza seleccionada', 'pólizas seleccionadas')}
              {ocultasSel > 0 &&
                ` (${plural(ocultasSel, 'más quedó oculta', 'más quedaron ocultas')} por el filtro y no se ${ocultasSel === 1 ? 'incluye' : 'incluyen'})`}
            </span>
            <Boton variante="fantasma" tamano="sm" disabled={filtradas.length === 0} onClick={seleccionarTodasVisibles}>
              {filtradas.length > MAX_SELECCION
                ? `Seleccionar las primeras ${MAX_SELECCION} de ${fmtNum(filtradas.length)}`
                : `Seleccionar todas las visibles (${fmtNum(filtradas.length)})`}
            </Boton>
            {sel.size > 0 && (
              <Boton variante="fantasma" tamano="sm" onClick={() => setSel(new Set())}>
                Quitar selección
              </Boton>
            )}
            <Boton
              variante="peligro"
              tamano="sm"
              disabled={elegidas.length === 0}
              onClick={() => setParaEliminar({ polizas: elegidas, grupo: true })}
            >
              <Trash2 />
              Eliminar ({elegidas.length})
            </Boton>
            <Boton variante="fantasma" tamano="sm" onClick={salirSeleccion}>
              Cancelar
            </Boton>
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
          <Tabla
            className="min-h-[320px] flex-1"
            filas={filtradas}
            columnas={columnas}
            clave={(p) => p.id}
            ordenInicial={{ columna: 'id', asc: false }}
            alHacerClic={(p) => (modoSeleccion ? alternarFila(p.id) : navigate(`/polizas/${p.id}`))}
            vacio={
              <Vacio
                titulo={polizas.length ? 'Ninguna póliza coincide con los filtros' : 'No se encontraron pólizas'}
                detalle={hayFiltros ? 'Pruebe quitando algún filtro.' : undefined}
              />
            }
          />
        )}
        <p className="text-[12px] text-ink-soft">Atajo: Alt+N crea una póliza nueva.</p>
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
