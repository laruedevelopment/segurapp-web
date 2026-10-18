import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FilePlus2, Pencil, ReceiptText, RefreshCw, Search, Trash2, Wallet, X } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Cargando, Chip, MensajeError, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { Input } from '@/components/ui/campos'
import { SelectorRango, type Rango } from '@/components/ui/fecha'
import { useConfirmar } from '@/components/ui/dialogo'
import { Tabla, type Columna } from '@/components/ui/tabla'
import { ESTADOS_PAGO, LIMITE_REPORTES, eliminarReporte, listarAbonosDeReporte, listarReportes, type ReportePago } from '@/datos/pagos'
import { aFecha, fmtFecha } from '@/lib/fechas'
import { fmtDinero, fmtNum } from '@/lib/numeros'
import { mensajeAmigable } from '@/lib/errores'
import { CLAVE_REPORTES, trasCambiarAbonos } from './comun'
import { EstadoPago } from './EstadoPago'
import { useApodos } from './UsuariosReporte'

const FILTROS_ESTADO = ['TODOS', 'I', 'C', 'R', 'V', 'A'] as const
type FiltroEstado = (typeof FILTROS_ESTADO)[number]

export default function ListaReportes() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const confirmar = useConfirmar()
  const apodo = useApodos()
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('TODOS')

  // Búsqueda en el servidor, 400 ms después de la última tecla.
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto.trim()), 400)
    return () => clearTimeout(t)
  }, [texto])

  const [rango, setRango] = useState<Rango>({ desde: null, hasta: null })
  const estado = filtroEstado === 'TODOS' ? null : filtroEstado
  // Con un solo extremo elegido, el rango es ese único día (como en el dashboard).
  const desde = rango.desde ?? rango.hasta
  const hasta = rango.hasta ?? rango.desde

  // Búsqueda, estado y fechas se filtran en el servidor.
  const reportes = useQuery({
    queryKey: [...CLAVE_REPORTES, 'lista', busqueda, estado, desde?.getTime() ?? null, hasta?.getTime() ?? null],
    queryFn: () => listarReportes({ busqueda, estado, desde, hasta }),
    // Siempre fresca: al volver de un reporte los totales pudieron cambiar.
    staleTime: 0,
    placeholderData: (previa) => previa,
  })

  const lista = useMemo(() => reportes.data ?? [], [reportes.data])

  const eliminar = async (r: ReportePago) => {
    const ok = await confirmar({
      titulo: 'Eliminar reporte',
      mensaje: `Se eliminará el Reporte #${r.id} (${fmtFecha(aFecha(r.fecha_rep))}) y ${(r.num_abonos ?? 0) === 1 ? 'su abono' : `sus ${r.num_abonos ?? 0} abonos`}. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar',
      peligro: true,
    })
    if (!ok) return
    try {
      // Pólizas afectadas, para refrescarlas: la base recalcula lo pagado.
      const ids = (r.num_abonos ?? 0) > 0 ? (await listarAbonosDeReporte(r.id)).map((a) => a.id_poliza) : []
      await eliminarReporte(r.id)
      await trasCambiarAbonos(qc, ids)
      toast.success(`Reporte #${r.id} eliminado`)
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudo eliminar el reporte'))
    }
  }

  const columnas: Columna<ReportePago>[] = [
    { id: 'id', titulo: '#', ancho: 70, celda: (r) => <span className="num font-semibold">#{r.id}</span>, ordenar: (r) => r.id },
    {
      id: 'fecha',
      titulo: 'Fecha',
      ancho: 100,
      celda: (r) => <span className="num">{fmtFecha(aFecha(r.fecha_rep))}</span>,
      ordenar: (r) => r.fecha_rep,
    },
    {
      id: 'aseg',
      titulo: 'Aseguradora',
      ancho: 190,
      celda: (r) => r.nombre_aseg ?? '—',
      ordenar: (r) => r.nombre_aseg?.toLowerCase(),
      titleDe: (r) => r.nombre_aseg ?? undefined,
    },
    {
      id: 'interm',
      titulo: 'Intermediario',
      ancho: 200,
      celda: (r) => r.nombre_interm ?? '—',
      ordenar: (r) => r.nombre_interm?.toLowerCase(),
      titleDe: (r) => r.nombre_interm ?? undefined,
    },
    {
      id: 'periodo',
      titulo: 'Período',
      ancho: 180,
      celda: (r) => (
        <span className="num text-[12px]">
          {r.fini_rep && r.ffin_rep ? `${fmtFecha(aFecha(r.fini_rep))} – ${fmtFecha(aFecha(r.ffin_rep))}` : '—'}
        </span>
      ),
      ordenar: (r) => r.fini_rep,
    },
    {
      id: 'polizas',
      titulo: 'Pólizas',
      ancho: 80,
      alinear: 'centro',
      celda: (r) => (
        <span className="num rounded-full bg-navy-soft px-2 py-0.5 text-[12px] font-semibold text-navy-dark">
          {r.num_abonos ?? 0}
        </span>
      ),
      ordenar: (r) => r.num_abonos ?? 0,
    },
    {
      id: 'prima',
      titulo: 'Suma prima',
      ancho: 140,
      alinear: 'der',
      celda: (r) => <span className="num">{fmtDinero(r.vlrsumprima_rep ?? 0)}</span>,
      ordenar: (r) => r.vlrsumprima_rep ?? 0,
    },
    {
      id: 'com',
      titulo: 'Suma comisión',
      ancho: 140,
      alinear: 'der',
      celda: (r) => <span className="num">{fmtDinero(r.vlrsumcom_rep ?? 0)}</span>,
      ordenar: (r) => r.vlrsumcom_rep ?? 0,
    },
    { id: 'estado', titulo: 'Estado', ancho: 110, celda: (r) => <EstadoPago estado={r.estado_rep} />, ordenar: (r) => r.estado_rep },
    {
      id: 'usuarios',
      titulo: 'Creado / editado por',
      ancho: 150,
      celda: (r) => {
        const creador = apodo(r.usuario_id)
        const editor = apodo(r.usuario_ultmod_id)
        return (
          <div className="leading-tight">
            <div className="truncate">{creador ?? '—'}</div>
            {editor && editor !== creador && <div className="truncate text-[11.5px] text-ink-soft">Editó: {editor}</div>}
          </div>
        )
      },
      ordenar: (r) => apodo(r.usuario_id),
      titleDe: (r) => `Creó: ${apodo(r.usuario_id) ?? '—'}\nÚltima edición: ${apodo(r.usuario_ultmod_id) ?? '—'}`,
    },
    {
      id: 'acciones',
      titulo: '',
      ancho: 120,
      celda: (r) => (
        <div className="flex gap-0.5">
          <Link to={`/comisiones/${r.id}`} title="Editar reporte" className="rounded-lg p-2 text-ink-soft hover:bg-muted hover:text-navy">
            <Pencil className="size-4" />
          </Link>
          <Link
            to={`/comisiones/${r.id}/estado-cuenta`}
            title="Estado de cuenta"
            className="rounded-lg p-2 text-ink-soft hover:bg-muted hover:text-green"
          >
            <Wallet className="size-4" />
          </Link>
          <button
            type="button"
            title="Eliminar"
            onClick={() => eliminar(r)}
            className="rounded-lg p-2 text-ink-soft hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo="Reportes de Comisiones"
        subtitulo={reportes.isSuccess ? `${fmtNum(lista.length)} ${lista.length === 1 ? 'reporte' : 'reportes'}` : undefined}
        acciones={
          <>
            <Boton
              variante="fantasma"
              tamano="icono"
              title="Recargar"
              onClick={() => reportes.refetch()}
              disabled={reportes.isFetching}
            >
              <RefreshCw className={reportes.isFetching ? 'animate-spin' : ''} />
            </Boton>
            <Link to="/comisiones/nuevo">
              <Boton variante="verde" tamano="sm">
                <FilePlus2 />
                Nuevo reporte
              </Boton>
            </Link>
          </>
        }
      />
      <Contenido className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
          <Input
            className="pr-9 pl-9"
            placeholder="Buscar por aseguradora, intermediario o código del reporte…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          {texto && (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-soft hover:bg-muted"
              onClick={() => setTexto('')}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTROS_ESTADO.map((e) => (
            <Chip key={e} activo={filtroEstado === e} onClick={() => setFiltroEstado(e)}>
              {e === 'TODOS' ? 'Todos' : ESTADOS_PAGO[e]}
            </Chip>
          ))}
          <SelectorRango etiqueta="Fecha del reporte" valor={rango} onCambio={setRango} />
        </div>
        {lista.length >= LIMITE_REPORTES && (
          <p className="text-[12px] text-ink-soft">
            Se muestran los {LIMITE_REPORTES} reportes más recientes. Afine la búsqueda, el estado o las fechas para ver otros.
          </p>
        )}

        {reportes.isError && !reportes.data ? (
          <MensajeError
            error={
              <div className="flex items-center gap-3">
                <span className="flex-1">{mensajeAmigable(reportes.error, 'No se pudieron cargar los reportes')}</span>
                <Boton tamano="sm" variante="secundario" onClick={() => reportes.refetch()}>
                  Reintentar
                </Boton>
              </div>
            }
          />
        ) : reportes.isPending ? (
          <Cargando texto="Cargando reportes…" />
        ) : (
          <Tabla
            className="min-h-[320px] flex-1"
            filas={lista}
            columnas={columnas}
            clave={(r) => r.id}
            alHacerClic={(r) => navigate(`/comisiones/${r.id}`)}
            vacio={<Vacio icono={<ReceiptText />} titulo="Sin reportes" />}
          />
        )}
      </Contenido>
    </div>
  )
}
