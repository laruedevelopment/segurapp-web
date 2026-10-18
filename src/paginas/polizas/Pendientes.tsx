import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
  AlertCircle,
} from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Aviso, Cargando, Chip, MensajeError, Tarjeta, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { Input } from '@/components/ui/campos'
import { useConfirmar } from '@/components/ui/dialogo'
import { useCargaMasiva } from '@/datos/cargaMasiva'
import {
  descartarPendiente,
  listarPendientes,
  nombresUsuarios,
  purgarVencidos,
  restaurarPendiente,
  type PolizaPendiente,
} from '@/datos/pendientes'
import {
  DIAS_RETENCION,
  diasParaBorrarse,
  filtrarYOrdenar,
  nroPolizaDe,
  plural,
  quienSubio,
  resumenDe,
  verboOrigen,
  type CriterioOrden,
} from '@/datos/pendientesLogica'
import { aFechaHora, fmtFechaHora } from '@/lib/fechas'
import { fmtDinero } from '@/lib/numeros'
import { mensajeAmigable } from '@/lib/errores'
import { cn } from '@/lib/utils'

type Vista = 'activos' | 'descartados'

interface Bandeja {
  activos: PolizaPendiente[]
  descartados: PolizaPendiente[]
  usuarios: Map<number, string>
}

/** Trae las dos listas; antes purga las descartadas que ya cumplieron el plazo. */
async function cargarBandeja(): Promise<Bandeja> {
  // Si la purga falla no impide ver la lista (se reintenta la próxima vez).
  try {
    await purgarVencidos()
  } catch {
    /* sin purga esta vez */
  }
  const [activos, descartados] = await Promise.all([listarPendientes(), listarPendientes({ descartadas: true })])
  // Quién subió cada una: si falla, la lista sale igual, sin ese dato.
  let usuarios = new Map<number, string>()
  try {
    usuarios = await nombresUsuarios()
  } catch {
    /* sin nombres */
  }
  return { activos, descartados, usuarios }
}

export default function Pendientes() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const confirmar = useConfirmar()
  const carga = useCargaMasiva()
  const [vista, setVista] = useState<Vista>('activos')
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<CriterioOrden>('fecha')
  const [ascendente, setAscendente] = useState(false)
  const [trabajando, setTrabajando] = useState<number | null>(null)

  // Siempre se recarga al entrar (al volver del formulario la lista cambia).
  const consulta = useQuery({
    queryKey: ['pendientes', 'lista'],
    queryFn: cargarBandeja,
    refetchOnMount: 'always',
  })
  const usuarios = useMemo(() => consulta.data?.usuarios ?? new Map<number, string>(), [consulta.data])
  const activos = consulta.data?.activos
  const descartados = consulta.data?.descartados

  const { porRevisar, borradores } = useMemo(() => {
    const ver = (estado: string) =>
      filtrarYOrdenar((activos ?? []).filter((p) => p.estado === estado), { texto: busqueda, orden, ascendente, descartadas: false, usuarios })
    return { porRevisar: ver('pendiente_revision'), borradores: ver('borrador') }
  }, [activos, busqueda, orden, ascendente, usuarios])
  const descartadosVista = useMemo(
    () => filtrarYOrdenar(descartados ?? [], { texto: busqueda, orden, ascendente, descartadas: true, usuarios }),
    [descartados, busqueda, orden, ascendente, usuarios],
  )


  const abrir = (p: PolizaPendiente) => navigate(`/polizas/nueva?pendiente=${p.id}`)
  const refrescar = () => qc.invalidateQueries({ queryKey: ['pendientes'] })

  const descartar = async (p: PolizaPendiente) => {
    const ok = await confirmar({
      titulo: 'Descartar',
      mensaje: `¿Descartar “${resumenDe(p.datos)}”? Queda ${DIAS_RETENCION} días en «Descartados» por si hay que recuperarla; pasado ese tiempo se borra sola.`,
      confirmar: 'Descartar',
      peligro: true,
    })
    if (!ok) return
    setTrabajando(p.id)
    try {
      await descartarPendiente(p.id)
      toast.success('Pendiente descartado. Puede restaurarlo desde «Descartados».')
      await refrescar()
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudo descartar'))
    } finally {
      setTrabajando(null)
    }
  }

  const restaurar = async (p: PolizaPendiente) => {
    setTrabajando(p.id)
    try {
      await restaurarPendiente(p.id)
      toast.success('Pendiente restaurado.')
      await refrescar()
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudo restaurar'))
    } finally {
      setTrabajando(null)
    }
  }

  const elegirOrden = (c: CriterioOrden) => {
    // Tocar el criterio activo invierte el sentido; tocar otro lo elige
    // (más reciente / mayor primero).
    if (orden === c) setAscendente((a) => !a)
    else {
      setOrden(c)
      setAscendente(false)
    }
  }

  const fila = (p: PolizaPendiente, descartada: boolean) => (
    <FilaPendiente
      key={p.id}
      p={p}
      descartada={descartada}
      quien={quienSubio(p, usuarios)}
      ocupada={trabajando === p.id}
      onAbrir={() => abrir(p)}
      onDescartar={() => void descartar(p)}
      onRestaurar={() => void restaurar(p)}
    />
  )

  const seccion = (titulo: string, lista: PolizaPendiente[]) =>
    lista.length > 0 && (
      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-semibold text-ink-soft">
          {titulo} ({lista.length})
        </h2>
        {lista.map((p) => fila(p, false))}
      </section>
    )

  const hayActivos = (activos?.length ?? 0) > 0
  const sinResultados = busqueda.trim() !== ''

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo="Pólizas pendientes"
        subtitulo={consulta.isSuccess ? 'Borradores guardados a medio llenar y pólizas leídas por la IA sin revisar' : undefined}
        volver="/polizas"
        acciones={
          <>
            <Link to="/polizas/carga-masiva">
              <Boton variante="secundario" tamano="sm">
                <Upload />
                Carga masiva
              </Boton>
            </Link>
            <Boton
              variante="fantasma"
              tamano="icono"
              title="Recargar"
              onClick={() => void consulta.refetch()}
              disabled={consulta.isFetching}
            >
              <RefreshCw className={consulta.isFetching ? 'animate-spin' : ''} />
            </Boton>
          </>
        }
      />
      <Contenido className="flex max-w-4xl flex-col gap-4">
        {carga.procesando && (
          <Aviso tono="navy" icono={<Loader2 className="animate-spin" />}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1">
                Carga masiva en curso:{' '}
                <b className="num">
                  {carga.procesados}/{carga.total}
                </b>{' '}
                archivos procesados. Las pólizas van apareciendo aquí.
              </span>
              <Link to="/polizas/carga-masiva" className="font-semibold underline">
                Ver detalle
              </Link>
            </div>
          </Aviso>
        )}

        {consulta.isError && !consulta.data ? (
          <MensajeError
            error={
              <div className="flex items-center gap-3">
                <span className="flex-1">{mensajeAmigable(consulta.error, 'No se pudieron cargar las pólizas pendientes')}</span>
                <Boton tamano="sm" variante="secundario" onClick={() => void consulta.refetch()}>
                  Reintentar
                </Boton>
              </div>
            }
          />
        ) : consulta.isPending ? (
          <Cargando texto="Cargando pólizas pendientes…" />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Chip activo={vista === 'activos'} onClick={() => setVista('activos')}>
                Activos ({activos?.length ?? 0})
              </Chip>
              <Chip activo={vista === 'descartados'} onClick={() => setVista('descartados')}>
                <Trash2 />
                Descartados ({descartados?.length ?? 0})
              </Chip>
            </div>

            {(hayActivos || (descartados?.length ?? 0) > 0) && (
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
                  <Input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por código, número de póliza, archivo, cliente o quien la subió…"
                    aria-label="Buscar pólizas pendientes"
                    className="pr-9 pl-9"
                  />
                  {busqueda && (
                    <button
                      type="button"
                      aria-label="Borrar la búsqueda"
                      className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-soft hover:bg-muted"
                      onClick={() => setBusqueda('')}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] text-ink-soft">Ordenar por:</span>
                  {(
                    [
                      ['fecha', vista === 'descartados' ? 'Fecha de descarte' : 'Fecha de guardado'],
                      ['cod', 'Código'],
                      ['nro', 'Nº póliza'],
                    ] as [CriterioOrden, string][]
                  ).map(([c, etiqueta]) => (
                    <Chip key={c} activo={orden === c} onClick={() => elegirOrden(c)}>
                      {etiqueta}
                      {orden === c && (ascendente ? <ArrowUp aria-label="ascendente" /> : <ArrowDown aria-label="descendente" />)}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {vista === 'activos' ? (
              !hayActivos ? (
                <Vacio icono={<CheckCircle2 className="text-green" />} titulo="No hay pólizas pendientes." />
              ) : porRevisar.length === 0 && borradores.length === 0 ? (
                <Vacio titulo={sinResultados ? 'Ninguna póliza coincide con la búsqueda.' : 'No hay pólizas pendientes.'} />
              ) : (
                <>
                  {seccion('Pendientes de revisión', porRevisar)}
                  {seccion('Borradores', borradores)}
                </>
              )
            ) : descartadosVista.length === 0 ? (
              <Vacio titulo={sinResultados ? 'Ninguna póliza coincide con la búsqueda.' : 'No hay pólizas descartadas.'} />
            ) : (
              <section className="flex flex-col gap-2">{descartadosVista.map((p) => fila(p, true))}</section>
            )}
          </>
        )}
      </Contenido>
    </div>
  )
}

/**
 * Tarjeta de una póliza pendiente, en tres niveles:
 *  1. Título: el cliente (o "Sin datos") y su estado a la derecha.
 *  2. Datos clave, cada uno con su etiqueta: N.º de póliza, aseguradora, prima y código.
 *  3. Origen, en una línea fija de íconos: archivo, quién la subió, cuándo.
 * Si falló la lectura, un aviso rojo aparte al final.
 */
function FilaPendiente({
  p,
  descartada,
  quien,
  ocupada,
  onAbrir,
  onDescartar,
  onRestaurar,
}: {
  p: PolizaPendiente
  descartada: boolean
  quien: string | null
  ocupada: boolean
  onAbrir: () => void
  onDescartar: () => void
  onRestaurar: () => void
}) {
  const esPendiente = p.estado === 'pendiente_revision'
  const conError = !!p.error_msg
  const nro = nroPolizaDe(p.datos)
  const aseguradora = String(p.datos.nombre_aseguradora ?? '').trim()
  const prima = typeof p.datos.prima === 'number' && p.datos.prima > 0 ? p.datos.prima : null
  const guardada = fmtFechaHora(aFechaHora(p.fcreado))
  const dias = diasParaBorrarse(p.fdescartado)

  // Estado: una sola etiqueta, la más importante.
  const [estadoTxt, estadoClase] = descartada
    ? ['Descartada', 'bg-muted text-ink-soft']
    : conError
      ? ['Error de lectura', 'bg-danger-soft text-danger']
      : esPendiente
        ? ['Por revisar', 'bg-warning-soft text-warning-ink']
        : ['Borrador', 'bg-muted text-ink-soft']
  const Icono = descartada ? Trash2 : conError ? AlertCircle : esPendiente ? Sparkles : FileText

  const dato = (etiqueta: string, valor: string, mono = false) => (
    <div className="min-w-0">
      <div className="text-[11px] text-ink-soft">{etiqueta}</div>
      <div className={cn('text-[13px] font-semibold', mono && 'num')}>{valor}</div>
    </div>
  )
  const origen = (icono: ReactNode, texto: ReactNode) => (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] text-ink-soft [&_svg]:size-3.5 [&_svg]:shrink-0">
      {icono}
      <span className="truncate">{texto}</span>
    </span>
  )

  const contenido = (
    <>
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5', estadoClase)}>
        <Icono />
      </span>
      <div className="min-w-0 flex-1">
        {/* Nivel 1: título + estado */}
        <div className="flex items-start gap-2.5">
          <div className="line-clamp-2 min-w-0 flex-1 text-[15px] font-bold">{resumenDe(p.datos)}</div>
          <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold', estadoClase)}>{estadoTxt}</span>
        </div>
        {/* Nivel 2: datos clave, con etiqueta */}
        <div className="mt-2 flex flex-wrap gap-x-7 gap-y-2">
          {dato('N.º de póliza', nro || '—', !!nro)}
          {aseguradora && dato('Aseguradora', aseguradora)}
          {prima != null && dato('Prima', fmtDinero(prima), true)}
          {dato('Código', String(p.id), true)}
        </div>
        {/* Nivel 3: origen (siempre en este orden) */}
        <div className="mt-2.5 flex flex-wrap gap-x-[18px] gap-y-1 border-t border-line pt-2">
          {p.nombre_archivo && origen(<FileText />, p.nombre_archivo)}
          {origen(<UserRound />, quien ? `${verboOrigen(p.origen)} por ${quien}` : 'Usuario no registrado')}
          {origen(<Clock />, <>Guardada el <span className="num">{guardada}</span></>)}
          {descartada &&
            p.fdescartado &&
            origen(
              <Trash2 />,
              <>
                Descartada el <span className="num">{fmtFechaHora(aFechaHora(p.fdescartado))}</span> · se borra en {plural(dias ?? 0, 'día', 'días')}
              </>,
            )}
        </div>
        {conError && (
          <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-danger-soft/70 p-2.5 text-[12.5px] leading-snug text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">{p.error_msg}</span>
          </div>
        )}
      </div>
    </>
  )

  return (
    <Tarjeta
      className={cn(
        'flex items-start gap-2 px-4 py-3 transition-colors',
        !descartada && 'hover:bg-navy-soft/40',
        ocupada && 'pointer-events-none opacity-60',
      )}
    >
      {descartada ? (
        <div className="flex min-w-0 flex-1 items-start gap-3.5">{contenido}</div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-3.5 outline-none"
          onClick={() => {
            if (window.getSelection()?.toString()) return
            onAbrir()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onAbrir()
            }
          }}
        >
          {contenido}
        </div>
      )}
      {descartada ? (
        <Boton variante="fantasma" tamano="sm" onClick={onRestaurar} cargando={ocupada}>
          Restaurar
        </Boton>
      ) : (
        <Boton variante="fantasma" tamano="icono" title="Descartar" aria-label="Descartar" onClick={onDescartar} cargando={ocupada}>
          {!ocupada && <Trash2 className="text-danger" />}
        </Boton>
      )}
    </Tarjeta>
  )
}
