import { useCallback, useId, useRef, useState, type ReactNode } from 'react'
import { Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Cargando, Etiqueta, MensajeError, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { Input } from '@/components/ui/campos'
import { Dialogo, useConfirmar } from '@/components/ui/dialogo'
import { Tabla, type Columna, type Orden } from '@/components/ui/tabla'
import { eliminarDeCatalogo } from '@/datos/catalogos'
import { normalizarTexto } from '@/lib/filtros'
import { mensajeError } from '@/lib/utils'

// ── Texto ───────────────────────────────────────────────────────────────────

/** ¿Todas las palabras de la búsqueda aparecen en alguno de los textos? (sin tildes ni mayúsculas) */
export function coincide(busqueda: string, ...textos: (string | number | null | undefined)[]) {
  const q = normalizarTexto(busqueda)
  if (!q) return true
  const t = normalizarTexto(textos.filter((x) => x != null && x !== '').join(' '))
  return q.split(' ').every((p) => t.includes(p))
}

/** Mensaje de un error al guardar; un duplicado (23505) usa el texto propio del catálogo. */
export function mensajeGuardar(e: unknown, duplicado?: string) {
  if (duplicado && typeof e === 'object' && e && (e as { code?: unknown }).code === '23505') return duplicado
  return mensajeError(e)
}

// ── Estado de guardado (evita el doble clic) ────────────────────────────────

/**
 * `const [guardando, ejecutar] = useGuardando()`. Mientras una operación
 * está en curso, las siguientes llamadas se ignoran (el ref se marca antes
 * de cualquier await, así un doble clic no crea dos registros).
 */
export function useGuardando() {
  const enCurso = useRef(false)
  const [guardando, setGuardando] = useState(false)
  const ejecutar = useCallback(async (fn: () => Promise<void>) => {
    if (enCurso.current) return
    enCurso.current = true
    setGuardando(true)
    try {
      await fn()
    } finally {
      enCurso.current = false
      setGuardando(false)
    }
  }, [])
  return [guardando, ejecutar] as const
}

/** Editor abierto: undefined = cerrado, null = registro nuevo, T = editar ese registro. */
export function useEditor<T>() {
  const [fila, setFila] = useState<T | null | undefined>(undefined)
  return {
    abierto: fila !== undefined,
    fila: fila ?? null,
    nuevo: () => setFila(null),
    editar: (f: T) => setFila(f),
    cerrar: () => setFila(undefined),
  }
}

// ── Eliminar con confirmación ───────────────────────────────────────────────

/**
 * Pide confirmación, elimina y avisa. Si el registro está en uso (llave
 * foránea) se muestra [enUso]. Devuelve true si se eliminó.
 */
export function useEliminar() {
  const confirmar = useConfirmar()
  return async (o: {
    que: string
    nombre: string
    tabla: string
    id: number
    enUso: string
    despues: () => unknown
  }) => {
    const ok = await confirmar({
      titulo: `Eliminar ${o.que}`,
      mensaje: (
        <>
          ¿Está seguro de eliminar <b className="text-ink">«{o.nombre}»</b>? Esta acción no se puede deshacer.
        </>
      ),
      confirmar: 'Eliminar',
      peligro: true,
    })
    if (!ok) return false
    try {
      await eliminarDeCatalogo(o.tabla, o.id, o.enUso)
      toast.success(`Se eliminó «${o.nombre}».`)
      await o.despues()
      return true
    } catch (e) {
      toast.error(mensajeError(e))
      return false
    }
  }
}

// ── Piezas visuales ─────────────────────────────────────────────────────────

export function EtiquetaEstado({ activo, femenino }: { activo: boolean; femenino?: boolean }) {
  return activo ? (
    <Etiqueta tono="verde">{femenino ? 'Activa' : 'Activo'}</Etiqueta>
  ) : (
    <Etiqueta>{femenino ? 'Inactiva' : 'Inactivo'}</Etiqueta>
  )
}

export function CampoBusqueda({
  valor,
  onCambio,
  placeholder,
  className,
}: {
  valor: string
  onCambio: (v: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div className={`relative min-w-0 flex-1 ${className ?? ''}`}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
      <Input className="pr-9 pl-9" placeholder={placeholder} value={valor} onChange={(e) => onCambio(e.target.value)} />
      {valor && (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-soft hover:bg-muted hover:text-ink"
          onClick={() => onCambio('')}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

export function BotonRecargar({ onClick, cargando }: { onClick: () => unknown; cargando: boolean }) {
  return (
    <Boton variante="secundario" tamano="sm" title="Traer los datos más recientes" onClick={() => onClick()} disabled={cargando}>
      <RefreshCw className={cargando ? 'animate-spin' : ''} />
      Recargar
    </Boton>
  )
}

export function BotonNuevo({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Boton variante="verde" tamano="sm" onClick={onClick}>
      <Plus />
      {children}
    </Boton>
  )
}

/** Botones de ícono al final de cada fila (Editar / Eliminar y otros). */
export function AccionesFila({
  onEditar,
  onEliminar,
  children,
}: {
  onEditar?: () => void
  onEliminar?: () => void
  children?: ReactNode
}) {
  return (
    <div className="flex gap-0.5">
      {children}
      {onEditar && (
        <button type="button" title="Editar" onClick={onEditar} className="rounded-lg p-2 text-ink-soft hover:bg-muted hover:text-navy">
          <Pencil className="size-4" />
        </button>
      )}
      {onEliminar && (
        <button type="button" title="Eliminar" onClick={onEliminar} className="rounded-lg p-2 text-ink-soft hover:bg-danger-soft hover:text-danger">
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  )
}

/** Estructura común de las listas de catálogos: encabezado, búsqueda, filtros y tabla. */
export function PaginaLista<T>({
  titulo,
  subtitulo,
  acciones,
  busqueda,
  onBusqueda,
  placeholder,
  filtros,
  avisos,
  cargando,
  error,
  onReintentar,
  filas,
  columnas,
  clave,
  alHacerClic,
  ordenInicial,
  textoVacio,
  children,
}: {
  titulo: string
  subtitulo?: ReactNode
  acciones: ReactNode
  busqueda: string
  onBusqueda: (v: string) => void
  placeholder: string
  filtros?: ReactNode
  avisos?: ReactNode
  cargando: boolean
  error: unknown
  onReintentar: () => unknown
  filas: T[]
  columnas: Columna<T>[]
  clave: (f: T) => string | number
  alHacerClic?: (f: T) => void
  ordenInicial?: Orden
  textoVacio: string
  children?: ReactNode
}) {
  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina titulo={titulo} subtitulo={subtitulo} volver="/catalogos" acciones={acciones} />
      <Contenido className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CampoBusqueda valor={busqueda} onCambio={onBusqueda} placeholder={placeholder} className="basis-72" />
          {filtros}
        </div>
        {avisos}
        {error && !filas.length ? (
          <MensajeError
            error={
              <div className="flex items-center gap-3">
                <span className="flex-1">No se pudieron cargar los datos: {mensajeError(error)}</span>
                <Boton tamano="sm" variante="secundario" onClick={() => onReintentar()}>
                  Reintentar
                </Boton>
              </div>
            }
          />
        ) : cargando && !filas.length ? (
          <Cargando />
        ) : (
          <Tabla
            className="min-h-[280px] flex-1"
            filas={filas}
            columnas={columnas}
            clave={clave}
            alHacerClic={alHacerClic}
            ordenInicial={ordenInicial}
            vacio={<Vacio titulo={busqueda ? 'Ningún registro coincide con la búsqueda' : textoVacio} />}
          />
        )}
      </Contenido>
      {children}
    </div>
  )
}

/**
 * Diálogo con un formulario: Enter o el botón Guardar lo envían. El botón
 * queda deshabilitado mientras guarda.
 */
export function DialogoFormulario({
  titulo,
  descripcion,
  onCerrar,
  onGuardar,
  guardando,
  textoGuardar = 'Guardar',
  ancho = 'lg',
  bloqueado,
  children,
}: {
  titulo: ReactNode
  descripcion?: ReactNode
  onCerrar: () => void
  onGuardar: () => unknown
  guardando: boolean
  textoGuardar?: string
  ancho?: 'sm' | 'md' | 'lg' | 'xl'
  /** Deshabilita Guardar (por ejemplo, mientras carga el registro). */
  bloqueado?: boolean
  children: ReactNode
}) {
  const idForm = useId()
  return (
    <Dialogo
      abierto
      onCerrar={() => {
        if (!guardando) onCerrar()
      }}
      titulo={titulo}
      descripcion={descripcion}
      ancho={ancho}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton type="submit" form={idForm} cargando={guardando} disabled={bloqueado}>
            {guardando ? 'Guardando…' : textoGuardar}
          </Boton>
        </>
      }
    >
      <form
        id={idForm}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (!guardando && !bloqueado) onGuardar()
        }}
      >
        {children}
      </form>
    </Dialogo>
  )
}

/** Título de sección dentro de un formulario. */
export function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="mb-5 last:mb-0">
      <legend className="mb-3 text-[12px] font-bold tracking-wide text-navy uppercase">{titulo}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}

/** Columna "Cód." común a todas las listas. */
export function columnaId<T extends { id: number }>(): Columna<T> {
  return { id: 'id', titulo: 'Cód.', ancho: 70, alinear: 'der', celda: (f) => <span className="num">{f.id}</span>, ordenar: (f) => f.id }
}

/** Aviso de éxito al crear, con el código asignado por la base. */
export function avisarCreado(texto: string, id: number) {
  toast.success(`${texto} con código ${id}.`, {
    action: {
      label: 'Copiar código',
      onClick: () => {
        void navigator.clipboard?.writeText(String(id)).catch(() => undefined)
      },
    },
  })
}
