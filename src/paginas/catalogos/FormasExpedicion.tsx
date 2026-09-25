import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AreaTexto, Campo, Input } from '@/components/ui/campos'
import type { Columna } from '@/components/ui/tabla'
import { actualizarEnCatalogo, crearEnCatalogo, useCatalogo, useRefrescarCatalogo } from '@/datos/catalogos'
import { fmtNum } from '@/lib/numeros'
import type { FormaExpedicion } from '@/lib/tipos'
import {
  AccionesFila,
  BotonNuevo,
  BotonRecargar,
  DialogoFormulario,
  PaginaLista,
  Seccion,
  avisarCreado,
  coincide,
  columnaId,
  mensajeGuardar,
  useEditor,
  useEliminar,
  useGuardando,
} from './comun'
import { limpiar, oNull } from './utilidades'

export default function FormasExpedicion() {
  const consulta = useCatalogo('formaexp')
  const refrescar = useRefrescarCatalogo()
  const eliminar = useEliminar()
  const editor = useEditor<FormaExpedicion>()
  const [texto, setTexto] = useState('')

  const filas = useMemo(
    () => (consulta.data ?? []).filter((f) => coincide(texto, f.id, f.nombre_formaexp, f.desc_formaexp)),
    [consulta.data, texto],
  )

  const columnas: Columna<FormaExpedicion>[] = [
    columnaId<FormaExpedicion>(),
    { id: 'nombre', titulo: 'Nombre', ancho: 280, celda: (f) => <span className="font-medium">{f.nombre_formaexp}</span>, ordenar: (f) => f.nombre_formaexp.toLowerCase(), titleDe: (f) => f.nombre_formaexp },
    { id: 'desc', titulo: 'Descripción', ancho: 360, celda: (f) => f.desc_formaexp ?? '', ordenar: (f) => f.desc_formaexp?.toLowerCase(), titleDe: (f) => f.desc_formaexp ?? undefined },
    {
      id: 'acciones',
      titulo: '',
      ancho: 90,
      celda: (f) => (
        <AccionesFila
          onEditar={() => editor.editar(f)}
          onEliminar={() =>
            void eliminar({
              que: 'forma de expedición',
              nombre: f.nombre_formaexp,
              tabla: 'formaexp',
              id: f.id,
              enUso: 'No puede eliminar esta forma de expedición porque está en uso en pólizas.',
              despues: () => refrescar('formaexp'),
            })
          }
        />
      ),
    },
  ]

  return (
    <PaginaLista
      titulo="Formas de expedición"
      subtitulo={consulta.isSuccess ? `${fmtNum(filas.length)} de ${fmtNum(consulta.data.length)} formas de expedición` : undefined}
      acciones={
        <>
          <BotonRecargar onClick={() => refrescar('formaexp')} cargando={consulta.isFetching} />
          <BotonNuevo onClick={editor.nuevo}>Nueva forma de expedición</BotonNuevo>
        </>
      }
      busqueda={texto}
      onBusqueda={setTexto}
      placeholder="Buscar por código, nombre o descripción"
      cargando={consulta.isPending}
      error={consulta.error}
      onReintentar={() => consulta.refetch()}
      filas={filas}
      columnas={columnas}
      clave={(f) => f.id}
      alHacerClic={editor.editar}
      ordenInicial={{ columna: 'id', asc: true }}
      textoVacio="No hay formas de expedición."
    >
      {editor.abierto && <FormularioFormaExp forma={editor.fila} onCerrar={editor.cerrar} />}
    </PaginaLista>
  )
}

function FormularioFormaExp({ forma, onCerrar }: { forma: FormaExpedicion | null; onCerrar: () => void }) {
  const refrescar = useRefrescarCatalogo()
  const [guardando, ejecutar] = useGuardando()
  const [nombre, setNombre] = useState(forma?.nombre_formaexp ?? '')
  const [desc, setDesc] = useState(forma?.desc_formaexp ?? '')
  const [error, setError] = useState<string>()

  const guardar = () => {
    if (!limpiar(nombre)) {
      setError('El nombre es obligatorio.')
      return
    }
    setError(undefined)
    void ejecutar(async () => {
      try {
        const fila = { nombre_formaexp: limpiar(nombre), desc_formaexp: oNull(desc) }
        if (forma) {
          await actualizarEnCatalogo('formaexp', forma.id, fila)
          toast.success('Forma de expedición actualizada.')
        } else {
          avisarCreado('Forma de expedición guardada', await crearEnCatalogo('formaexp', fila))
        }
        void refrescar('formaexp')
        onCerrar()
      } catch (e) {
        toast.error(mensajeGuardar(e, 'Ya existe una forma de expedición con ese nombre.'))
      }
    })
  }

  return (
    <DialogoFormulario
      titulo={forma ? 'Editar forma de expedición' : 'Nueva forma de expedición'}
      descripcion={forma ? `Código ${forma.id}` : 'El código se asigna al guardar.'}
      ancho="md"
      onCerrar={onCerrar}
      onGuardar={guardar}
      guardando={guardando}
    >
      <Seccion titulo="Datos">
        <Campo etiqueta="Nombre" obligatorio error={error} className="sm:col-span-2">
          <Input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <Campo etiqueta="Descripción" className="sm:col-span-2">
          <AreaTexto rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Campo>
      </Seccion>
    </DialogoFormulario>
  )
}
