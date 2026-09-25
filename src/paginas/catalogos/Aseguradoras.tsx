import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Chip } from '@/components/ui/basicos'
import { Campo, Casilla, Input } from '@/components/ui/campos'
import type { Columna } from '@/components/ui/tabla'
import { actualizarEnCatalogo, crearEnCatalogo, useCatalogo, useRefrescarCatalogo } from '@/datos/catalogos'
import { fmtNum } from '@/lib/numeros'
import type { Aseguradora } from '@/lib/tipos'
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
import { limpiar, nitLimpio } from './utilidades'

export default function Aseguradoras() {
  const consulta = useCatalogo('aseguradoras')
  const refrescar = useRefrescarCatalogo()
  const eliminar = useEliminar()
  const editor = useEditor<Aseguradora>()
  const [texto, setTexto] = useState('')
  const [soloActivas, setSoloActivas] = useState(false)

  const filas = useMemo(
    () =>
      (consulta.data ?? []).filter(
        (a) =>
          (!soloActivas || a.estado_aseg) &&
          coincide(texto, a.id, a.nombre_aseg, a.nit_aseg, a.clave, a.estado_aseg ? 'activa' : 'inactiva'),
      ),
    [consulta.data, soloActivas, texto],
  )

  const columnas: Columna<Aseguradora>[] = [
    columnaId<Aseguradora>(),
    { id: 'nombre', titulo: 'Nombre', ancho: 300, celda: (a) => <span className="font-medium">{a.nombre_aseg}</span>, ordenar: (a) => a.nombre_aseg.toLowerCase(), titleDe: (a) => a.nombre_aseg },
    { id: 'clave', titulo: 'Clave', ancho: 100, celda: (a) => <span className="num">{a.clave ?? ''}</span>, ordenar: (a) => a.clave },
    { id: 'nit', titulo: 'NIT', ancho: 150, celda: (a) => <span className="num">{a.nit_aseg ?? ''}</span>, ordenar: (a) => a.nit_aseg },
    { id: 'estado', titulo: 'Estado', ancho: 100, celda: (a) => <EtiquetaEstado activo={a.estado_aseg} femenino />, ordenar: (a) => (a.estado_aseg ? 0 : 1) },
    {
      id: 'acciones',
      titulo: '',
      ancho: 90,
      celda: (a) => (
        <AccionesFila
          onEditar={() => editor.editar(a)}
          onEliminar={() =>
            void eliminar({
              que: 'aseguradora',
              nombre: a.nombre_aseg,
              tabla: 'aseguradoras',
              id: a.id,
              enUso: 'No puede eliminar esta aseguradora porque está relacionada con productos o pólizas.',
              despues: () => refrescar('aseguradoras'),
            })
          }
        />
      ),
    },
  ]

  return (
    <PaginaLista
      titulo="Aseguradoras"
      subtitulo={consulta.isSuccess ? `${fmtNum(filas.length)} de ${fmtNum(consulta.data.length)} aseguradoras` : undefined}
      acciones={
        <>
          <BotonRecargar onClick={() => refrescar('aseguradoras')} cargando={consulta.isFetching} />
          <BotonNuevo onClick={editor.nuevo}>Nueva aseguradora</BotonNuevo>
        </>
      }
      busqueda={texto}
      onBusqueda={setTexto}
      placeholder="Buscar por código, nombre, NIT, clave o estado"
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
      clave={(a) => a.id}
      alHacerClic={editor.editar}
      ordenInicial={{ columna: 'id', asc: true }}
      textoVacio="No hay aseguradoras."
    >
      {editor.abierto && <FormularioAseguradora aseguradora={editor.fila} onCerrar={editor.cerrar} />}
    </PaginaLista>
  )
}

function FormularioAseguradora({ aseguradora, onCerrar }: { aseguradora: Aseguradora | null; onCerrar: () => void }) {
  const refrescar = useRefrescarCatalogo()
  const [guardando, ejecutar] = useGuardando()
  const [nombre, setNombre] = useState(aseguradora?.nombre_aseg ?? '')
  const [nit, setNit] = useState(aseguradora?.nit_aseg ?? '')
  const [clave, setClave] = useState(aseguradora?.clave ?? '')
  const [activa, setActiva] = useState(aseguradora?.estado_aseg ?? true)
  const [errores, setErrores] = useState<{ nombre?: string; nit?: string; clave?: string }>({})

  const guardar = () => {
    const errs: typeof errores = {}
    if (!limpiar(nombre)) errs.nombre = 'El nombre es obligatorio.'
    const nitG = nitLimpio(nit)
    if (nitG && nitG.length < 6) errs.nit = 'NIT inválido.'
    const claveG = clave.trim() || null
    if (claveG && !/^[a-zA-Z0-9]+$/.test(claveG)) errs.clave = 'Clave inválida (solo letras y números).'
    setErrores(errs)
    if (Object.keys(errs).length) return

    void ejecutar(async () => {
      try {
        const fila = { nombre_aseg: limpiar(nombre), nit_aseg: nitG, clave: claveG, estado_aseg: activa }
        if (aseguradora) {
          await actualizarEnCatalogo('aseguradoras', aseguradora.id, fila)
          toast.success('Aseguradora actualizada.')
        } else {
          avisarCreado('Aseguradora guardada', await crearEnCatalogo('aseguradoras', fila))
        }
        void refrescar('aseguradoras')
        onCerrar()
      } catch (e) {
        toast.error(mensajeGuardar(e, 'Ya existe una aseguradora con ese nombre.'))
      }
    })
  }

  return (
    <DialogoFormulario
      titulo={aseguradora ? 'Editar aseguradora' : 'Nueva aseguradora'}
      descripcion={aseguradora ? `Código ${aseguradora.id}` : 'El código se asigna al guardar.'}
      ancho="md"
      onCerrar={onCerrar}
      onGuardar={guardar}
      guardando={guardando}
    >
      <Seccion titulo="Identificación">
        <Campo etiqueta="Nombre" obligatorio error={errores.nombre} className="sm:col-span-2">
          <Input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <Campo etiqueta="NIT (opcional)" error={errores.nit} ayuda="Se guarda sin puntos ni guiones.">
          <Input className="num" value={nit} onChange={(e) => setNit(e.target.value)} />
        </Campo>
        <Campo etiqueta="Clave (opcional)" error={errores.clave} ayuda="Solo letras y números, sin espacios.">
          <Input className="num" value={clave} onChange={(e) => setClave(e.target.value)} />
        </Campo>
        <Casilla marcada={activa} onCambio={setActiva} etiqueta="Aseguradora activa" />
      </Seccion>
    </DialogoFormulario>
  )
}
