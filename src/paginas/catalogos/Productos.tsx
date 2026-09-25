import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Chip } from '@/components/ui/basicos'
import { Buscador } from '@/components/ui/buscador'
import { AreaTexto, Campo, Casilla, Input, InputNumero } from '@/components/ui/campos'
import { FiltroOpciones } from '@/components/ui/filtro-opciones'
import type { Columna } from '@/components/ui/tabla'
import { actualizarEnCatalogo, crearEnCatalogo, useCatalogo, useRefrescarCatalogo } from '@/datos/catalogos'
import { fmtDinero, fmtNum, fmtPct } from '@/lib/numeros'
import type { Aseguradora, Producto, Ramo } from '@/lib/tipos'
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

export default function Productos() {
  const consulta = useCatalogo('productos')
  const ramos = useCatalogo('ramos')
  const aseguradoras = useCatalogo('aseguradoras')
  const refrescar = useRefrescarCatalogo()
  const eliminar = useEliminar()
  const editor = useEditor<Producto>()
  const [texto, setTexto] = useState('')
  const [soloActivos, setSoloActivos] = useState(false)
  const [fAseg, setFAseg] = useState<string | null>(null)
  const [fRamo, setFRamo] = useState<string | null>(null)

  const nombreRamo = useMemo(() => new Map((ramos.data ?? []).map((r) => [r.id, r.nombre_ramo])), [ramos.data])
  const nombreAseg = useMemo(() => new Map((aseguradoras.data ?? []).map((a) => [a.id, a.nombre_aseg])), [aseguradoras.data])
  const ramoDe = (p: Producto) => nombreRamo.get(p.ramo_id) ?? ''
  const asegDe = (p: Producto) => nombreAseg.get(p.aseguradora_id) ?? ''

  const filas = useMemo(
    () =>
      (consulta.data ?? []).filter((p) => {
        const ramo = nombreRamo.get(p.ramo_id) ?? ''
        const aseg = nombreAseg.get(p.aseguradora_id) ?? ''
        return (
          (!soloActivos || p.estado_prod) &&
          (!fAseg || aseg === fAseg) &&
          (!fRamo || ramo === fRamo) &&
          coincide(
            texto,
            p.id,
            p.nombre_prod,
            ramo,
            aseg,
            p.desc_prod,
            p.obs_prod,
            p.vlrfijocom_prod,
            p.porccom_prod,
            p.porcad_prod,
            p.estado_prod ? 'activo' : 'inactivo',
          )
        )
      }),
    [consulta.data, nombreRamo, nombreAseg, soloActivos, fAseg, fRamo, texto],
  )

  // Opciones de los filtros: solo las que tienen productos.
  const opcionesAseg = useMemo(
    () => [...new Set((consulta.data ?? []).map((p) => nombreAseg.get(p.aseguradora_id)).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b, 'es')),
    [consulta.data, nombreAseg],
  )
  const opcionesRamo = useMemo(
    () =>
      [...new Set((consulta.data ?? []).filter((p) => !fAseg || nombreAseg.get(p.aseguradora_id) === fAseg).map((p) => nombreRamo.get(p.ramo_id)).filter((s): s is string => !!s))].sort((a, b) =>
        a.localeCompare(b, 'es'),
      ),
    [consulta.data, nombreRamo, nombreAseg, fAseg],
  )

  const recargar = () => Promise.all([refrescar('productos'), refrescar('ramos'), refrescar('aseguradoras')])

  const columnas: Columna<Producto>[] = [
    columnaId<Producto>(),
    { id: 'nombre', titulo: 'Producto', ancho: 240, celda: (p) => <span className="font-medium">{p.nombre_prod}</span>, ordenar: (p) => p.nombre_prod.toLowerCase(), titleDe: (p) => p.nombre_prod },
    { id: 'ramo', titulo: 'Ramo', ancho: 170, celda: ramoDe, ordenar: (p) => ramoDe(p).toLowerCase(), titleDe: ramoDe },
    { id: 'aseg', titulo: 'Aseguradora', ancho: 170, celda: asegDe, ordenar: (p) => asegDe(p).toLowerCase(), titleDe: asegDe },
    { id: 'fija', titulo: 'Com. fija', ancho: 110, alinear: 'der', celda: (p) => <span className="num">{fmtDinero(p.vlrfijocom_prod)}</span>, ordenar: (p) => p.vlrfijocom_prod },
    { id: 'porc', titulo: '% Com.', ancho: 85, alinear: 'der', celda: (p) => <span className="num">{fmtPct(p.porccom_prod)}</span>, ordenar: (p) => p.porccom_prod },
    { id: 'porcad', titulo: '% Adic.', ancho: 85, alinear: 'der', celda: (p) => <span className="num">{fmtPct(p.porcad_prod)}</span>, ordenar: (p) => p.porcad_prod },
    { id: 'desc', titulo: 'Descripción', ancho: 200, celda: (p) => p.desc_prod ?? '', ordenar: (p) => p.desc_prod?.toLowerCase(), titleDe: (p) => p.desc_prod ?? undefined },
    { id: 'obs', titulo: 'Observaciones', ancho: 200, celda: (p) => p.obs_prod ?? '', ordenar: (p) => p.obs_prod?.toLowerCase(), titleDe: (p) => p.obs_prod ?? undefined },
    { id: 'estado', titulo: 'Estado', ancho: 100, celda: (p) => <EtiquetaEstado activo={p.estado_prod} />, ordenar: (p) => (p.estado_prod ? 0 : 1) },
    {
      id: 'acciones',
      titulo: '',
      ancho: 90,
      celda: (p) => (
        <AccionesFila
          onEditar={() => editor.editar(p)}
          onEliminar={() =>
            void eliminar({
              que: 'producto',
              nombre: p.nombre_prod,
              tabla: 'productos',
              id: p.id,
              enUso: 'No puede eliminar este producto porque está relacionado con pólizas.',
              despues: () => refrescar('productos'),
            })
          }
        />
      ),
    },
  ]

  const hayFiltros = !!(fAseg || fRamo)

  return (
    <PaginaLista
      titulo="Productos"
      subtitulo={consulta.isSuccess ? `${fmtNum(filas.length)} de ${fmtNum(consulta.data.length)} productos` : undefined}
      acciones={
        <>
          <BotonRecargar onClick={recargar} cargando={consulta.isFetching || ramos.isFetching || aseguradoras.isFetching} />
          <BotonNuevo onClick={editor.nuevo}>Nuevo producto</BotonNuevo>
        </>
      }
      busqueda={texto}
      onBusqueda={setTexto}
      placeholder="Buscar por código, producto, ramo, aseguradora, descripción o estado"
      filtros={
        <>
          <FiltroOpciones etiqueta="Aseguradora" valor={fAseg} opciones={opcionesAseg} onCambio={setFAseg} />
          <FiltroOpciones etiqueta="Ramo" valor={fRamo} opciones={opcionesRamo} onCambio={setFRamo} />
          <Chip activo={soloActivos} onClick={() => setSoloActivos(!soloActivos)}>
            Solo activos
          </Chip>
          {hayFiltros && (
            <Chip
              activo={false}
              onClick={() => {
                setFAseg(null)
                setFRamo(null)
              }}
            >
              Quitar filtros
            </Chip>
          )}
        </>
      }
      cargando={consulta.isPending}
      error={consulta.error}
      onReintentar={() => consulta.refetch()}
      filas={filas}
      columnas={columnas}
      clave={(p) => p.id}
      alHacerClic={editor.editar}
      ordenInicial={{ columna: 'id', asc: true }}
      textoVacio="No hay productos."
    >
      {editor.abierto && (
        <FormularioProducto
          producto={editor.fila}
          ramos={ramos.data ?? []}
          aseguradoras={aseguradoras.data ?? []}
          onCerrar={editor.cerrar}
        />
      )}
    </PaginaLista>
  )
}

function FormularioProducto({
  producto,
  ramos,
  aseguradoras,
  onCerrar,
}: {
  producto: Producto | null
  ramos: Ramo[]
  aseguradoras: Aseguradora[]
  onCerrar: () => void
}) {
  const refrescar = useRefrescarCatalogo()
  const [guardando, ejecutar] = useGuardando()
  const [nombre, setNombre] = useState(producto?.nombre_prod ?? '')
  const [ramoId, setRamoId] = useState<number | null>(producto?.ramo_id ?? null)
  const [asegId, setAsegId] = useState<number | null>(producto?.aseguradora_id ?? null)
  const [fija, setFija] = useState<number | null>(producto?.vlrfijocom_prod ?? null)
  const [porc, setPorc] = useState<number | null>(producto?.porccom_prod ?? null)
  const [porcad, setPorcad] = useState<number | null>(producto?.porcad_prod ?? null)
  const [desc, setDesc] = useState(producto?.desc_prod ?? '')
  const [obs, setObs] = useState(producto?.obs_prod ?? '')
  const [activo, setActivo] = useState(producto?.estado_prod ?? true)
  const [errores, setErrores] = useState<Partial<Record<'nombre' | 'ramo' | 'aseg' | 'porc' | 'porcad', string>>>({})

  const ramo = ramos.find((r) => r.id === ramoId) ?? null
  const aseg = aseguradoras.find((a) => a.id === asegId) ?? null

  const guardar = () => {
    const errs: typeof errores = {}
    if (!limpiar(nombre)) errs.nombre = 'El nombre es obligatorio.'
    if (!ramo) errs.ramo = 'Seleccione un ramo.'
    if (!aseg) errs.aseg = 'Seleccione una aseguradora.'
    if (!porcentajeValido(porc)) errs.porc = 'Debe estar entre 0 y 100.'
    if (!porcentajeValido(porcad)) errs.porcad = 'Debe estar entre 0 y 100.'
    setErrores(errs)
    if (Object.keys(errs).length || !ramo || !aseg) return

    void ejecutar(async () => {
      try {
        const fila = {
          nombre_prod: limpiar(nombre),
          ramo_id: ramo.id,
          aseguradora_id: aseg.id,
          estado_prod: activo,
          vlrfijocom_prod: fija,
          porccom_prod: porc,
          desc_prod: oNull(desc),
          porcad_prod: porcad,
          obs_prod: oNull(obs),
        }
        if (producto) {
          await actualizarEnCatalogo('productos', producto.id, fila)
          toast.success('Producto actualizado.')
        } else {
          avisarCreado('Producto guardado', await crearEnCatalogo('productos', fila))
        }
        void refrescar('productos')
        onCerrar()
      } catch (e) {
        toast.error(mensajeGuardar(e, 'Ya existe un producto con esa información.'))
      }
    })
  }

  return (
    <DialogoFormulario
      titulo={producto ? 'Editar producto' : 'Nuevo producto'}
      descripcion={producto ? `Código ${producto.id}` : 'El código se asigna al guardar.'}
      onCerrar={onCerrar}
      onGuardar={guardar}
      guardando={guardando}
    >
      <Seccion titulo="Identificación">
        <Campo etiqueta="Nombre del producto" obligatorio error={errores.nombre} className="sm:col-span-2">
          <Input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <Campo etiqueta="Ramo" obligatorio error={errores.ramo}>
          <Buscador<Ramo>
            valor={ramo}
            onCambio={(r) => setRamoId(r?.id ?? null)}
            opciones={ramos}
            etiqueta={(r) => r.nombre_ramo}
            clave={(r) => r.id}
            inactivo={(r) => !r.estado_ramo}
            error={!!errores.ramo}
          />
        </Campo>
        <Campo etiqueta="Aseguradora" obligatorio error={errores.aseg}>
          <Buscador<Aseguradora>
            valor={aseg}
            onCambio={(a) => setAsegId(a?.id ?? null)}
            opciones={aseguradoras}
            etiqueta={(a) => a.nombre_aseg}
            clave={(a) => a.id}
            inactivo={(a) => !a.estado_aseg}
            error={!!errores.aseg}
          />
        </Campo>
      </Seccion>
      <Seccion titulo="Comisiones">
        <Campo etiqueta="Comisión fija">
          <InputNumero valor={fija} onCambio={setFija} permitirNegativos={false} prefijo="$" />
        </Campo>
        <Campo etiqueta="% Comisión" error={errores.porc}>
          <InputNumero valor={porc} onCambio={setPorc} permitirNegativos={false} maxDecimales={5} sufijo="%" />
        </Campo>
        <Campo etiqueta="% Comisión adicional" error={errores.porcad}>
          <InputNumero valor={porcad} onCambio={setPorcad} permitirNegativos={false} maxDecimales={5} sufijo="%" />
        </Campo>
      </Seccion>
      <Seccion titulo="Descripción">
        <Campo etiqueta="Descripción" className="sm:col-span-2">
          <AreaTexto rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Campo>
        <Campo etiqueta="Observaciones" className="sm:col-span-2">
          <AreaTexto rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
        </Campo>
        <Casilla marcada={activo} onCambio={setActivo} etiqueta="Producto activo" />
      </Seccion>
    </DialogoFormulario>
  )
}
