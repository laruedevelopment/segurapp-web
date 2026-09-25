import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Chip } from '@/components/ui/basicos'
import { Campo, Casilla, Input, InputNumero, SelectorSimple } from '@/components/ui/campos'
import type { Columna } from '@/components/ui/tabla'
import { actualizarEnCatalogo, crearEnCatalogo, useCatalogo, useRefrescarCatalogo } from '@/datos/catalogos'
import { fmtNum, fmtPct } from '@/lib/numeros'
import type { Asesor } from '@/lib/tipos'
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
import { TIPOS_DOC, correoValido, limpiar, oNull, porcentajeValido } from './utilidades'

const docTexto = (a: Asesor) => [a.tipodoc_asesor?.trim(), a.doc_asesor].filter(Boolean).join(' ')

export default function Asesores() {
  const consulta = useCatalogo('asesores')
  const refrescar = useRefrescarCatalogo()
  const eliminar = useEliminar()
  const editor = useEditor<Asesor>()
  const [texto, setTexto] = useState('')
  const [soloActivos, setSoloActivos] = useState(true)

  const filas = useMemo(
    () =>
      (consulta.data ?? []).filter(
        (a) =>
          (!soloActivos || a.estado_asesor) &&
          coincide(texto, a.id, a.nombre_asesor, a.doc_asesor, a.tel_asesor, a.correo_asesor, a.estado_asesor ? 'activo' : 'inactivo'),
      ),
    [consulta.data, soloActivos, texto],
  )

  const columnas: Columna<Asesor>[] = [
    columnaId<Asesor>(),
    { id: 'nombre', titulo: 'Nombre', ancho: 260, celda: (a) => <span className="font-medium">{a.nombre_asesor}</span>, ordenar: (a) => a.nombre_asesor.toLowerCase(), titleDe: (a) => a.nombre_asesor },
    { id: 'doc', titulo: 'Documento', ancho: 160, celda: (a) => <span className="num">{docTexto(a)}</span>, ordenar: (a) => a.doc_asesor },
    { id: 'tel', titulo: 'Teléfono', ancho: 130, celda: (a) => a.tel_asesor ?? '', ordenar: (a) => a.tel_asesor },
    { id: 'correo', titulo: 'Correo', ancho: 220, celda: (a) => a.correo_asesor ?? '', ordenar: (a) => a.correo_asesor?.toLowerCase(), titleDe: (a) => a.correo_asesor ?? undefined },
    { id: 'porc', titulo: '% Com.', ancho: 90, alinear: 'der', celda: (a) => <span className="num">{fmtPct(a.porccom_asesor, 5)}</span>, ordenar: (a) => a.porccom_asesor },
    { id: 'estado', titulo: 'Estado', ancho: 100, celda: (a) => <EtiquetaEstado activo={a.estado_asesor} />, ordenar: (a) => (a.estado_asesor ? 0 : 1) },
    {
      id: 'acciones',
      titulo: '',
      ancho: 90,
      celda: (a) => (
        <AccionesFila
          onEditar={() => editor.editar(a)}
          onEliminar={() =>
            void eliminar({
              que: 'asesor',
              nombre: a.nombre_asesor,
              tabla: 'asesores',
              id: a.id,
              enUso: 'No puede eliminar este asesor porque está relacionado con pólizas.',
              despues: () => refrescar('asesores'),
            })
          }
        />
      ),
    },
  ]

  return (
    <PaginaLista
      titulo="Asesores"
      subtitulo={consulta.isSuccess ? `${fmtNum(filas.length)} de ${fmtNum(consulta.data.length)} asesores` : undefined}
      acciones={
        <>
          <BotonRecargar onClick={() => refrescar('asesores')} cargando={consulta.isFetching} />
          <BotonNuevo onClick={editor.nuevo}>Nuevo asesor</BotonNuevo>
        </>
      }
      busqueda={texto}
      onBusqueda={setTexto}
      placeholder="Buscar por código, nombre, documento, teléfono, correo o estado"
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
      clave={(a) => a.id}
      alHacerClic={editor.editar}
      ordenInicial={{ columna: 'id', asc: true }}
      textoVacio="No hay asesores."
    >
      {editor.abierto && <FormularioAsesor asesor={editor.fila} onCerrar={editor.cerrar} />}
    </PaginaLista>
  )
}

function FormularioAsesor({ asesor, onCerrar }: { asesor: Asesor | null; onCerrar: () => void }) {
  const refrescar = useRefrescarCatalogo()
  const [guardando, ejecutar] = useGuardando()
  const [nombre, setNombre] = useState(asesor?.nombre_asesor ?? '')
  const [doc, setDoc] = useState(asesor?.doc_asesor ?? '')
  const [tipodoc, setTipodoc] = useState<string | null>(() => {
    const t = asesor?.tipodoc_asesor?.trim().toUpperCase()
    return t && asesor?.doc_asesor?.trim() && (TIPOS_DOC as readonly string[]).includes(t) ? t : null
  })
  const [tel, setTel] = useState(asesor?.tel_asesor ?? '')
  const [correo, setCorreo] = useState(asesor?.correo_asesor ?? '')
  const [porc, setPorc] = useState<number | null>(asesor?.porccom_asesor ?? null)
  const [activo, setActivo] = useState(asesor?.estado_asesor ?? true)
  const [errores, setErrores] = useState<Partial<Record<'nombre' | 'tipodoc' | 'correo' | 'porc', string>>>({})

  const guardar = () => {
    const errs: typeof errores = {}
    if (!limpiar(nombre)) errs.nombre = 'El nombre es obligatorio.'
    const docG = oNull(doc)
    if (docG && !tipodoc) errs.tipodoc = 'Seleccione el tipo de documento.'
    if (!correoValido(correo)) errs.correo = 'Correo inválido.'
    if (!porcentajeValido(porc)) errs.porc = 'Debe estar entre 0 y 100.'
    setErrores(errs)
    if (Object.keys(errs).length) return

    void ejecutar(async () => {
      try {
        const fila = {
          nombre_asesor: limpiar(nombre),
          tipodoc_asesor: docG ? tipodoc : null,
          doc_asesor: docG,
          tel_asesor: oNull(tel),
          correo_asesor: oNull(correo),
          porccom_asesor: porc,
          estado_asesor: activo,
        }
        if (asesor) {
          await actualizarEnCatalogo('asesores', asesor.id, fila)
          toast.success('Asesor actualizado.')
        } else {
          avisarCreado('Asesor guardado', await crearEnCatalogo('asesores', fila))
        }
        void refrescar('asesores')
        onCerrar()
      } catch (e) {
        toast.error(mensajeGuardar(e, 'Ya existe un asesor con esa información.'))
      }
    })
  }

  return (
    <DialogoFormulario
      titulo={asesor ? 'Editar asesor' : 'Nuevo asesor'}
      descripcion={asesor ? `Código ${asesor.id}` : 'El código se asigna al guardar.'}
      onCerrar={onCerrar}
      onGuardar={guardar}
      guardando={guardando}
    >
      <Seccion titulo="Datos principales">
        <Campo etiqueta="Nombre" obligatorio error={errores.nombre} className="sm:col-span-2">
          <Input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <Campo etiqueta="Tipo de documento" error={errores.tipodoc}>
          <SelectorSimple
            valor={tipodoc}
            onCambio={(v) => {
              setTipodoc(v)
              // Sin tipo no hay documento (igual que en Flutter).
              if (!v) setDoc('')
            }}
            opciones={TIPOS_DOC.map((t) => ({ valor: t as string, etiqueta: t as string }))}
            vacio="— Seleccione —"
          />
        </Campo>
        <Campo etiqueta="Documento">
          <Input
            className="num"
            value={doc}
            onChange={(e) => {
              setDoc(e.target.value)
              if (!e.target.value.trim()) setTipodoc(null)
            }}
          />
        </Campo>
        <Campo etiqueta="% Comisión" error={errores.porc} ayuda="Ejemplo: 70 o 70,5">
          <InputNumero valor={porc} onCambio={setPorc} permitirNegativos={false} maxDecimales={5} sufijo="%" />
        </Campo>
      </Seccion>
      <Seccion titulo="Contacto">
        <Campo etiqueta="Teléfono">
          <Input type="tel" value={tel} onChange={(e) => setTel(e.target.value)} />
        </Campo>
        <Campo etiqueta="Correo" error={errores.correo}>
          <Input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </Campo>
        <Casilla marcada={activo} onCambio={setActivo} etiqueta="Asesor activo" />
      </Seccion>
    </DialogoFormulario>
  )
}
