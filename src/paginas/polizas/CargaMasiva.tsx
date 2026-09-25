import { useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, CircleAlert, Clock, FileUp, Inbox, Loader2, RefreshCw, Sparkles, Trash2, X } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Aviso, Tarjeta, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import {
  agregarArchivos,
  hayFallidos,
  limpiarCargaMasiva,
  procesarTodos,
  quitarArchivo,
  useEstadoCargaMasiva,
  type ItemCargaMasiva,
} from '@/datos/cargaMasiva'
import { EXTENSIONES_CARGA } from '@/datos/cargaMasivaLogica'
import { MAX_BYTES_ARCHIVO } from '@/datos/ia'
import { fmtNum } from '@/lib/numeros'
import { cn } from '@/lib/utils'

const ACEPTA = EXTENSIONES_CARGA.map((e) => '.' + e).join(',')

const tamano = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${fmtNum(bytes / (1024 * 1024), 1)} MB` : `${fmtNum(Math.max(1, Math.round(bytes / 1024)))} KB`

export default function CargaMasiva() {
  const qc = useQueryClient()
  const { items, procesando, procesados } = useEstadoCargaMasiva()
  const input = useRef<HTMLInputElement>(null)
  const [arrastrando, setArrastrando] = useState(false)

  const ok = items.filter((i) => i.estado === 'ok').length
  const errores = items.filter((i) => i.estado === 'error').length
  const terminado = !procesando && items.length > 0 && procesados === items.length
  const sinEmpezar = items.every((i) => i.estado === 'pendiente')

  const recibir = (lista: FileList | null) => {
    if (!lista?.length || procesando) return
    const { rechazados } = agregarArchivos([...lista])
    if (rechazados.length) {
      toast.warning(
        `${rechazados.length === 1 ? 'Se omitió 1 archivo' : `Se omitieron ${rechazados.length} archivos`} que no son PDF ni imagen: ${rechazados.slice(0, 3).join(', ')}${rechazados.length > 3 ? '…' : ''}`,
      )
    }
  }

  const alSoltar = (e: DragEvent) => {
    e.preventDefault()
    setArrastrando(false)
    recibir(e.dataTransfer.files)
  }

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo="Carga masiva de pólizas"
        volver="/polizas"
        acciones={
          <Link to="/polizas/pendientes">
            <Boton variante="secundario" tamano="sm">
              <Inbox />
              Pólizas pendientes
            </Boton>
          </Link>
        }
      />
      <Contenido className="flex max-w-4xl flex-col gap-4">
        <p className="text-[13px] text-ink-soft">
          Seleccione varios PDF o imágenes de pólizas. Cada uno se envía a la IA y queda como “Pendiente de revisión”. Puede
          salir de esta pantalla y seguir usando la aplicación mientras se procesan; no hace falta esperar aquí.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            if (!procesando) setArrastrando(true)
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={alSoltar}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
            arrastrando ? 'border-navy bg-navy-soft/60' : 'border-line-strong bg-surface',
            procesando && 'opacity-60',
          )}
        >
          <FileUp className="size-8 text-navy" />
          <p className="font-semibold">Arrastre aquí los archivos</p>
          <p className="text-[12.5px] text-ink-soft">PDF, JPG, PNG o WEBP · máximo 15 MB por archivo</p>
          <Boton variante="secundario" tamano="sm" className="mt-1" disabled={procesando} onClick={() => input.current?.click()}>
            Seleccionar archivos
          </Boton>
          <input
            ref={input}
            type="file"
            multiple
            accept={ACEPTA}
            className="hidden"
            onChange={(e) => {
              recibir(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Boton
              variante="verde"
              disabled={procesando || terminado}
              cargando={procesando}
              onClick={() => void procesarTodos(qc)}
            >
              {!procesando && <Sparkles />}
              {procesando
                ? `Procesando ${procesados}/${items.length}…`
                : `Procesar ${items.length} ${items.length === 1 ? 'archivo' : 'archivos'}`}
            </Boton>
            {terminado && hayFallidos({ items, procesando, procesados }) && (
              <Boton variante="secundario" onClick={() => void procesarTodos(qc)}>
                <RefreshCw />
                Reintentar {errores} {errores === 1 ? 'fallido' : 'fallidos'}
              </Boton>
            )}
            {!procesando && (
              <Boton variante="fantasma" onClick={limpiarCargaMasiva}>
                <Trash2 />
                Vaciar lista
              </Boton>
            )}
          </div>
        )}

        {procesando && (
          <p className="text-[12.5px] text-ink-soft italic">
            Esto sigue corriendo aunque salga de esta pantalla (no cierre ni recargue la pestaña del navegador).
          </p>
        )}

        {terminado && (
          <Aviso tono="alerta" icono={<CheckCircle2 />}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1">
                {ok} {ok === 1 ? 'predigitada' : 'predigitadas'}, {errores} con error. Revíselas desde “Pólizas pendientes”.
              </span>
              <Link to="/polizas/pendientes" replace>
                <Boton variante="secundario" tamano="sm">
                  Ir a Pendientes
                </Boton>
              </Link>
            </div>
          </Aviso>
        )}

        {items.length === 0 ? (
          <Vacio icono={<FileUp />} titulo="No hay archivos seleccionados todavía." />
        ) : (
          <Tarjeta className="divide-y divide-line">
            {items.map((i) => (
              <FilaArchivo key={i.id} item={i} puedeQuitar={!procesando && sinEmpezar} />
            ))}
          </Tarjeta>
        )}
      </Contenido>
    </div>
  )
}

function FilaArchivo({ item, puedeQuitar }: { item: ItemCargaMasiva; puedeQuitar: boolean }) {
  const pesado = item.archivo.size > MAX_BYTES_ARCHIVO
  const icono = {
    pendiente: <Clock className="text-ink-soft" />,
    procesando: <Loader2 className="animate-spin text-navy" />,
    ok: <CheckCircle2 className="text-green" />,
    error: <CircleAlert className="text-danger" />,
  }[item.estado]
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <span className="mt-0.5 [&_svg]:size-5">{icono}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium" title={item.nombre}>
          {item.nombre}
        </div>
        {item.error ? (
          <div className="text-[12px] text-danger">{item.error}</div>
        ) : item.estado === 'pendiente' && pesado ? (
          <div className="text-[12px] text-warning-ink">Pesa más de 15 MB: la IA no lo podrá leer.</div>
        ) : null}
      </div>
      <span className="num shrink-0 pt-0.5 text-[12px] text-ink-soft">{tamano(item.archivo.size)}</span>
      {puedeQuitar && (
        <button
          type="button"
          title="Quitar de la lista"
          aria-label="Quitar de la lista"
          className="rounded p-1 text-ink-soft hover:bg-muted hover:text-danger"
          onClick={() => quitarArchivo(item.id)}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
