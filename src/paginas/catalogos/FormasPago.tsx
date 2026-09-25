import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Chip } from '@/components/ui/basicos'
import { Campo, Casilla, Input } from '@/components/ui/campos'
import type { Columna } from '@/components/ui/tabla'
import { actualizarEnCatalogo, crearEnCatalogo, useCatalogo, useRefrescarCatalogo } from '@/datos/catalogos'
import { fmtNum } from '@/lib/numeros'
import type { FormaPago } from '@/lib/tipos'
import {
  AccionesFila,
  BotonNuevo,
  BotonRecargar,
  DialogoFormulario,
  EtiquetaEstado,
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
import { limpiar } from './utilidades'

export default function FormasPago() {
  const consulta = useCatalogo('formas_pago')
  const refrescar = useRefrescarCatalogo()
  const eliminar = useEliminar()
  const editor = useEditor<FormaPago>()
  const [texto, setTexto] = useState('')
  const [soloActivas, setSoloActivas] = useState(true)

  const filas = useMemo(
    () => (consulta.data ?? []).filter((f) => (!soloActivas || f.estado_forma_pago) && coincide(texto, f.id, f.nombre_forma_pago)),
    [consulta.data, soloActivas, texto],
  )

  const columnas: Columna<FormaPago>[] = [
    columnaId<FormaPago>(),
    { id: 'nombre', titulo: 'Nombre', ancho: 320, celda: (f) => <span className="font-medium">{f.nombre_forma_pago}</span>, ordenar: (f) => f.nombre_forma_pago.toLowerCase(), titleDe: (f) => f.nombre_forma_pago },
    { id: 'estado', titulo: 'Estado', ancho: 110, celda: (f) => <EtiquetaEstado activo={f.estado_forma_pago} femenino />, ordenar: (f) => (f.estado_forma_pago ? 0 : 1) },
    {
      id: 'acciones',
      titulo: '',
      ancho: 90,
      celda: (f) => (
        <AccionesFila
          onEditar={() => editor.editar(f)}
          onEliminar={() =>
            void eliminar({
              que: 'forma de pago',
              nombre: f.nombre_forma_pago,
              tabla: 'formas_pago',
              id: f.id,
              enUso: 'No puede eliminar esta forma de pago porque está en uso en pólizas.',
              despues: () => refrescar('formas_pago'),
            })
          }
        />
      ),
    },
  ]

  return (
    <PaginaLista
      titulo="Formas de pago"
      subtitulo={consulta.isSuccess ? `${fmtNum(filas.length)} de ${fmtNum(consulta.data.length)} formas de pago` : undefined}
      acciones={
        <>
          <BotonRecargar onClick={() => refrescar('formas_pago')} cargando={consulta.isFetching} />
          <BotonNuevo onClick={editor.nuevo}>Nueva forma de pago</BotonNuevo>
        </>
      }
      busqueda={texto}
      onBusqueda={setTexto}
      placeholder="Buscar por código o nombre"
      filtros={
        <Chip activo={soloActivas} onClick={() => setSoloActivas(!soloActivas)}>
          Solo activas
        </Chip>
      }
      cargando={consulta.isPending}
      error={consulta.error}
      onReintentar={() => consulta.refetch()}
      filas={filas}
      columnas={columnas}
      clave={(f) => f.id}
      alHacerClic={editor.editar}
      ordenInicial={{ columna: 'id', asc: true }}
      textoVacio="No hay formas de pago."
    >
      {editor.abierto && <FormularioFormaPago forma={editor.fila} onCerrar={editor.cerrar} />}
    </PaginaLista>
  )
}

function FormularioFormaPago({ forma, onCerrar }: { forma: FormaPago | null; onCerrar: () => void }) {
  const refrescar = useRefrescarCatalogo()
  const [guardando, ejecutar] = useGuardando()
  const [nombre, setNombre] = useState(forma?.nombre_forma_pago ?? '')
  const [activa, setActiva] = useState(forma?.estado_forma_pago ?? true)
  const [error, setError] = useState<string>()

  const guardar = () => {
    if (!limpiar(nombre)) {
      setError('El nombre es obligatorio.')
      return
    }
    setError(undefined)
    void ejecutar(async () => {
      try {
        const fila = { nombre_forma_pago: limpiar(nombre), estado_forma_pago: activa }
        if (forma) {
          await actualizarEnCatalogo('formas_pago', forma.id, fila)
          toast.success('Forma de pago actualizada.')
        } else {
          avisarCreado('Forma de pago guardada', await crearEnCatalogo('formas_pago', fila))
        }
        void refrescar('formas_pago')
        onCerrar()
      } catch (e) {
        toast.error(mensajeGuardar(e, 'Ya existe una forma de pago con ese nombre.'))
      }
    })
  }

  return (
    <DialogoFormulario
      titulo={forma ? 'Editar forma de pago' : 'Nueva forma de pago'}
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
        <Casilla marcada={activa} onCambio={setActiva} etiqueta="Forma de pago activa" />
      </Seccion>
    </DialogoFormulario>
  )
}
