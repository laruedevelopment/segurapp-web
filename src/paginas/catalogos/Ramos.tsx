import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Chip } from '@/components/ui/basicos'
import { AreaTexto, Campo, Casilla, Input, InputNumero } from '@/components/ui/campos'
import type { Columna } from '@/components/ui/tabla'
import { actualizarEnCatalogo, crearEnCatalogo, useCatalogo, useRefrescarCatalogo } from '@/datos/catalogos'
import { fmtNum, fmtPct } from '@/lib/numeros'
import type { Ramo } from '@/lib/tipos'
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
import { limpiar, oNull, porcentajeValido } from './utilidades'

export default function Ramos() {
  const consulta = useCatalogo('ramos')
  const refrescar = useRefrescarCatalogo()
  const eliminar = useEliminar()
  const editor = useEditor<Ramo>()
  const [texto, setTexto] = useState('')
  const [soloActivos, setSoloActivos] = useState(true)

  const filas = useMemo(
    () =>
      (consulta.data ?? []).filter(
        (r) =>
          (!soloActivos || r.estado_ramo) &&
          coincide(texto, r.id, r.nombre_ramo, r.obs_ramo, r.porcom_base_ramo, r.estado_ramo ? 'activo' : 'inactivo'),
      ),
    [consulta.data, soloActivos, texto],
  )

  const columnas: Columna<Ramo>[] = [
    columnaId<Ramo>(),
    { id: 'nombre', titulo: 'Nombre', ancho: 280, celda: (r) => <span className="font-medium">{r.nombre_ramo}</span>, ordenar: (r) => r.nombre_ramo.toLowerCase(), titleDe: (r) => r.nombre_ramo },
    { id: 'porc', titulo: '% Base com.', ancho: 110, alinear: 'der', celda: (r) => <span className="num">{fmtPct(r.porcom_base_ramo ?? 100)}</span>, ordenar: (r) => r.porcom_base_ramo ?? 100 },
    { id: 'obs', titulo: 'Observaciones', ancho: 300, celda: (r) => r.obs_ramo ?? '', ordenar: (r) => r.obs_ramo?.toLowerCase(), titleDe: (r) => r.obs_ramo ?? undefined },
    { id: 'estado', titulo: 'Estado', ancho: 100, celda: (r) => <EtiquetaEstado activo={r.estado_ramo} />, ordenar: (r) => (r.estado_ramo ? 0 : 1) },
    {
      id: 'acciones',
      titulo: '',
      ancho: 90,
      celda: (r) => (
        <AccionesFila
          onEditar={() => editor.editar(r)}
          onEliminar={() =>
            void eliminar({
              que: 'ramo',
              nombre: r.nombre_ramo,
              tabla: 'ramos',
              id: r.id,
              enUso: 'No puede eliminar este ramo porque está relacionado con productos o pólizas.',
              despues: () => refrescar('ramos'),
            })
          }
        />
      ),
    },
  ]

  return (
    <PaginaLista
      titulo="Ramos"
      subtitulo={consulta.isSuccess ? `${fmtNum(filas.length)} de ${fmtNum(consulta.data.length)} ramos` : undefined}
      acciones={
        <>
          <BotonRecargar onClick={() => refrescar('ramos')} cargando={consulta.isFetching} />
          <BotonNuevo onClick={editor.nuevo}>Nuevo ramo</BotonNuevo>
        </>
      }
      busqueda={texto}
      onBusqueda={setTexto}
      placeholder="Buscar por código, nombre, observaciones, % base o estado"
      filtros={
        <Chip activo={soloActivos} onClick={() => setSoloActivos(!soloActivos)}>
          Solo activos
        </Chip>
      }
      cargando={consulta.isPending}
      error={consulta.error}
      onReintentar={() => consulta.refetch()}
      filas={filas}
      columnas={columnas}
      clave={(r) => r.id}
      alHacerClic={editor.editar}
      ordenInicial={{ columna: 'id', asc: true }}
      textoVacio="No hay ramos."
    >
      {editor.abierto && <FormularioRamo ramo={editor.fila} onCerrar={editor.cerrar} />}
    </PaginaLista>
  )
}

function FormularioRamo({ ramo, onCerrar }: { ramo: Ramo | null; onCerrar: () => void }) {
  const refrescar = useRefrescarCatalogo()
  const [guardando, ejecutar] = useGuardando()
  const [nombre, setNombre] = useState(ramo?.nombre_ramo ?? '')
  const [porcom, setPorcom] = useState<number | null>(ramo ? ramo.porcom_base_ramo : 100)
  const [obs, setObs] = useState(ramo?.obs_ramo ?? '')
  const [activo, setActivo] = useState(ramo?.estado_ramo ?? true)
  const [errores, setErrores] = useState<{ nombre?: string; porcom?: string }>({})

  const guardar = () => {
    const errs: typeof errores = {}
    if (!limpiar(nombre)) errs.nombre = 'El nombre es obligatorio.'
    if (!porcentajeValido(porcom)) errs.porcom = 'Debe estar entre 0 y 100.'
    setErrores(errs)
    if (Object.keys(errs).length) return

    void ejecutar(async () => {
      try {
        const fila = {
          nombre_ramo: limpiar(nombre),
          estado_ramo: activo,
          obs_ramo: oNull(obs),
          // Vacío se guarda como 100 (igual que en Flutter).
          porcom_base_ramo: porcom ?? 100,
        }
        if (ramo) {
          await actualizarEnCatalogo('ramos', ramo.id, fila)
          toast.success('Ramo actualizado.')
        } else {
          avisarCreado('Ramo guardado', await crearEnCatalogo('ramos', fila))
        }
        void refrescar('ramos')
        onCerrar()
      } catch (e) {
        toast.error(mensajeGuardar(e, 'Ya existe un ramo con ese nombre.'))
      }
    })
  }

  return (
    <DialogoFormulario
      titulo={ramo ? 'Editar ramo' : 'Nuevo ramo'}
      descripcion={ramo ? `Código ${ramo.id}` : 'El código se asigna al guardar.'}
      ancho="md"
      onCerrar={onCerrar}
      onGuardar={guardar}
      guardando={guardando}
    >
      <Seccion titulo="Identificación">
        <Campo etiqueta="Nombre del ramo" obligatorio error={errores.nombre} className="sm:col-span-2">
          <Input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <Campo etiqueta="% Base de comisión" error={errores.porcom} ayuda="Si lo deja vacío, se guarda como 100.">
          <InputNumero valor={porcom} onCambio={setPorcom} permitirNegativos={false} maxDecimales={5} sufijo="%" />
        </Campo>
      </Seccion>
      <Seccion titulo="Observaciones">
        <Campo etiqueta="Observaciones (opcional)" className="sm:col-span-2">
          <AreaTexto rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
        </Campo>
        <Casilla marcada={activo} onCambio={setActivo} etiqueta="Ramo activo" />
      </Seccion>
    </DialogoFormulario>
  )
}
