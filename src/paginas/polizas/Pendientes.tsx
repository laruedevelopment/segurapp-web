import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, FileText, Loader2, RefreshCw, Sparkles, Trash2, Upload } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Aviso, Cargando, Chip, MensajeError, Tarjeta, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { useConfirmar } from '@/components/ui/dialogo'
import { useCargaMasiva } from '@/datos/cargaMasiva'
import { eliminarPendiente, listarPendientes, resumenPendiente, type EstadoPendiente, type PolizaPendiente } from '@/datos/pendientes'
import { aFechaHora, fmtFechaHora } from '@/lib/fechas'
import { cn, mensajeError } from '@/lib/utils'

type Filtro = 'todos' | EstadoPendiente

export default function Pendientes() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const confirmar = useConfirmar()
  const carga = useCargaMasiva()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [eliminando, setEliminando] = useState<number | null>(null)

  // Siempre se recarga al entrar (al volver del formulario la lista cambia).
  const consulta = useQuery({
    queryKey: ['pendientes', 'lista'],
    queryFn: () => listarPendientes(),
    refetchOnMount: 'always',
  })
  const items = consulta.data ?? []
  const porRevisar = items.filter((p) => p.estado === 'pendiente_revision')
  const borradores = items.filter((p) => p.estado === 'borrador')

  const abrir = (p: PolizaPendiente) => navigate(`/polizas/nueva?pendiente=${p.id}`)

  const eliminar = async (p: PolizaPendiente) => {
    const ok = await confirmar({
      titulo: 'Descartar',
      mensaje: `¿Descartar “${resumenPendiente(p)}”? Esto no se puede deshacer.`,
      confirmar: 'Descartar',
      peligro: true,
    })
    if (!ok) return
    setEliminando(p.id)
    try {
      await eliminarPendiente(p.id)
      toast.success('Pendiente descartado.')
      await qc.invalidateQueries({ queryKey: ['pendientes'] })
    } catch (e) {
      toast.error(`No se pudo descartar: ${mensajeError(e)}`)
    } finally {
      setEliminando(null)
    }
  }

  const seccion = (titulo: string, lista: PolizaPendiente[]) =>
    lista.length > 0 && (
      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-semibold text-ink-soft">
          {titulo} ({lista.length})
        </h2>
        {lista.map((p) => (
          <FilaPendiente
            key={p.id}
            p={p}
            eliminando={eliminando === p.id}
            onAbrir={() => abrir(p)}
            onEliminar={() => void eliminar(p)}
          />
        ))}
      </section>
    )

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

        {consulta.isError && !items.length ? (
          <MensajeError
            error={
              <div className="flex items-center gap-3">
                <span className="flex-1">No se pudieron cargar las pólizas pendientes: {mensajeError(consulta.error)}</span>
                <Boton tamano="sm" variante="secundario" onClick={() => void consulta.refetch()}>
                  Reintentar
                </Boton>
              </div>
            }
          />
        ) : consulta.isPending ? (
          <Cargando texto="Cargando pólizas pendientes…" />
        ) : items.length === 0 ? (
          <Vacio icono={<CheckCircle2 className="text-green" />} titulo="No hay pólizas pendientes." />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Chip activo={filtro === 'todos'} onClick={() => setFiltro('todos')}>
                Todas ({items.length})
              </Chip>
              <Chip activo={filtro === 'pendiente_revision'} onClick={() => setFiltro('pendiente_revision')}>
                <Sparkles />
                Pendientes de revisión ({porRevisar.length})
              </Chip>
              <Chip activo={filtro === 'borrador'} onClick={() => setFiltro('borrador')}>
                <FileText />
                Borradores ({borradores.length})
              </Chip>
            </div>
            {filtro !== 'borrador' && seccion('Pendientes de revisión', porRevisar)}
            {filtro !== 'pendiente_revision' && seccion('Borradores', borradores)}
            {((filtro === 'borrador' && !borradores.length) || (filtro === 'pendiente_revision' && !porRevisar.length)) && (
              <Vacio titulo={filtro === 'borrador' ? 'No hay borradores.' : 'No hay pólizas pendientes de revisión.'} />
            )}
          </>
        )}
      </Contenido>
    </div>
  )
}

function FilaPendiente({
  p,
  eliminando,
  onAbrir,
  onEliminar,
}: {
  p: PolizaPendiente
  eliminando: boolean
  onAbrir: () => void
  onEliminar: () => void
}) {
  const esPendiente = p.estado === 'pendiente_revision'
  const fecha = fmtFechaHora(aFechaHora(p.fcreado))
  const partes = [p.nombre_archivo?.trim() || null, p.error_msg != null ? `Error: ${p.error_msg}` : null].filter(
    (s): s is string => !!s,
  )
  return (
    <Tarjeta
      className={cn(
        'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-navy-soft/40',
        eliminando && 'pointer-events-none opacity-60',
      )}
    >
      <div
        role="button"
        tabIndex={0}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 outline-none"
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
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5',
            esPendiente ? 'bg-warning-soft text-warning-ink' : 'bg-muted text-ink-soft',
          )}
          title={esPendiente ? 'Pendiente de revisión' : 'Borrador'}
        >
          {esPendiente ? <Sparkles /> : <FileText />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{resumenPendiente(p)}</div>
          <div className={cn('text-[12.5px] text-ink-soft', p.error_msg != null && 'text-danger')}>
            {partes.length ? `${partes.join(' · ')} · ` : 'Guardado el '}
            <span className="num">{fecha}</span>
          </div>
        </div>
      </div>
      <Boton variante="fantasma" tamano="icono" title="Descartar" aria-label="Descartar" onClick={onEliminar} cargando={eliminando}>
        {!eliminando && <Trash2 className="text-danger" />}
      </Boton>
    </Tarjeta>
  )
}
