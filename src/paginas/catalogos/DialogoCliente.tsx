import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Cargando, MensajeError } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { Buscador } from '@/components/ui/buscador'
import { AreaTexto, Campo, Casilla, Input, SelectorSimple } from '@/components/ui/campos'
import { Dialogo } from '@/components/ui/dialogo'
import { actualizarCliente, crearCliente, existeDocCliente, obtenerCliente, useCatalogo } from '@/datos/catalogos'
import { normalizarAlfanumerico } from '@/lib/filtros'
import { fmtDoc } from '@/lib/numeros'
import type { Asesor, Cliente, Municipio } from '@/lib/tipos'
import { mensajeError } from '@/lib/utils'
import { CLAVE_CLIENTES, claveCliente } from './clientesDatos'
import { DialogoFormulario, Seccion, avisarCreado, mensajeGuardar, useGuardando } from './comun'
import { TIPOS_DOC, correoValido, docEsNumerico, docParaGuardar, formatearDoc, limpiar, oNull } from './utilidades'

/**
 * Crear o editar un cliente en un diálogo (lo usa el formulario de pólizas
 * para editar el cliente sin salir de la pantalla, y el catálogo de clientes).
 *
 * CONTRATO (no cambiar la firma): clienteId null = cliente nuevo;
 * inicial = valores sugeridos para un cliente nuevo (ej. los que leyó la IA);
 * onGuardado recibe el id del cliente creado o editado.
 *
 * Al guardar se llama onGuardado(id) y después onCerrar().
 */
export interface PropsDialogoCliente {
  abierto: boolean
  clienteId: number | null
  inicial?: Partial<{
    nombre_cliente: string
    tipopers_cliente: string
    tipodoc_cliente: string
    doc_cliente: string
    tel_cliente: string
    correo_cliente: string
    dir_cliente: string
  }>
  onCerrar: () => void
  onGuardado: (id: number) => void
}

export function DialogoCliente(props: PropsDialogoCliente) {
  if (!props.abierto) return null
  return props.clienteId == null ? (
    <FormularioCliente cliente={null} {...props} />
  ) : (
    <CargarCliente key={props.clienteId} id={props.clienteId} {...props} />
  )
}

function CargarCliente({ id, ...props }: PropsDialogoCliente & { id: number }) {
  const q = useQuery({ queryKey: claveCliente(id), queryFn: () => obtenerCliente(id), staleTime: 0 })
  if (q.data) return <FormularioCliente cliente={q.data} {...props} />
  return (
    <Dialogo
      abierto
      onCerrar={props.onCerrar}
      titulo="Editar cliente"
      pie={
        <Boton variante="secundario" onClick={props.onCerrar}>
          Cerrar
        </Boton>
      }
    >
      {q.isPending ? (
        <Cargando texto="Cargando cliente…" />
      ) : q.isError ? (
        <MensajeError error={`No se pudo cargar el cliente: ${mensajeError(q.error)}`} />
      ) : (
        <MensajeError error={`No se encontró el cliente con código ${id}.`} />
      )}
    </Dialogo>
  )
}

/** Tipo de documento sugerido (por la IA u otra fuente) llevado a los de la app. */
function tipoDocSugerido(t: string | undefined): string | null {
  const s = (t ?? '').toUpperCase().replace(/[\s.]/g, '')
  if (!s) return null
  if ((TIPOS_DOC as readonly string[]).includes(s)) return s
  if (s === 'PA' || s === 'PP' || s.startsWith('PASAPORTE')) return 'PAS'
  if (s.startsWith('CEDULADEEXTRANJERIA')) return 'CE'
  if (s.startsWith('CEDULA')) return 'CC'
  return null
}

type Errores = Partial<Record<'nombre' | 'tipodoc' | 'doc' | 'correo', string>>

function FormularioCliente({
  cliente,
  inicial,
  onCerrar,
  onGuardado,
}: PropsDialogoCliente & { cliente: Cliente | null }) {
  const qc = useQueryClient()
  const municipios = useCatalogo('municipio')
  const asesores = useCatalogo('asesores')
  const [guardando, ejecutar] = useGuardando()

  const [nombre, setNombre] = useState(cliente?.nombre_cliente ?? inicial?.nombre_cliente ?? '')
  const [tipopers, setTipopers] = useState<string>(() => {
    const t = (cliente?.tipopers_cliente ?? inicial?.tipopers_cliente ?? 'N').toUpperCase()
    return t === 'J' ? 'J' : 'N'
  })
  const [tipodoc, setTipodoc] = useState<string | null>(() =>
    cliente ? (cliente.tipodoc_cliente?.trim() || null) : tipoDocSugerido(inicial?.tipodoc_cliente),
  )
  const [doc, setDoc] = useState(() => {
    const d = cliente?.doc_cliente ?? inicial?.doc_cliente ?? ''
    return cliente ? fmtDoc(d) : formatearDoc(d, docEsNumerico(tipodoc))
  })
  const [tel, setTel] = useState(cliente?.tel_cliente ?? inicial?.tel_cliente ?? '')
  const [correo, setCorreo] = useState(cliente?.correo_cliente ?? inicial?.correo_cliente ?? '')
  const [dir, setDir] = useState(cliente?.dir_cliente ?? inicial?.dir_cliente ?? '')
  const [municId, setMunicId] = useState<number | null>(cliente?.munic_id ?? null)
  const [asesorId, setAsesorId] = useState<number | null>(cliente?.asesor_id ?? null)
  const [notas, setNotas] = useState(cliente?.notas_cliente ?? '')
  const [contacto, setContacto] = useState(cliente?.contacto_cliente ?? '')
  const [cargo, setCargo] = useState(cliente?.cargocont_cliente ?? '')
  const [activo, setActivo] = useState(cliente?.estado_cliente ?? true)
  const [recordar, setRecordar] = useState(cliente?.recordar_cliente ?? false)
  const [errores, setErrores] = useState<Errores>({})

  const numerico = docEsNumerico(tipodoc)

  // Un tipo de documento antiguo que no está en la lista se muestra y se conserva.
  const opcionesTipo = useMemo(() => {
    const base = TIPOS_DOC.map((t) => ({ valor: t as string, etiqueta: t as string }))
    if (tipodoc && !base.some((o) => o.valor === tipodoc)) base.push({ valor: tipodoc, etiqueta: tipodoc })
    return base
  }, [tipodoc])

  const municipio: Municipio | null = useMemo(() => {
    if (municId == null) return null
    return (
      municipios.data?.find((m) => m.id === municId) ??
      (cliente?.municipio?.id === municId ? cliente.municipio : null) ?? { id: municId, nombre_munic: `Municipio ${municId}` }
    )
  }, [municId, municipios.data, cliente])

  // Asesores activos, más el asignado aunque esté inactivo.
  const opcionesAsesor = useMemo(
    () => (asesores.data ?? []).filter((a) => a.estado_asesor || a.id === asesorId),
    [asesores.data, asesorId],
  )
  const asesor: Asesor | null = asesores.data?.find((a) => a.id === asesorId) ?? null

  const cambiarTipo = (t: string | null) => {
    setTipodoc(t)
    setErrores((e) => ({ ...e, tipodoc: undefined, doc: undefined }))
    // Se reformatea solo si no se pierde ningún carácter (una letra de un
    // pasaporte no se borra al pasar a CC sin avisar).
    const nuevo = formatearDoc(doc, docEsNumerico(t))
    if (normalizarAlfanumerico(nuevo) === normalizarAlfanumerico(doc)) setDoc(nuevo)
  }

  const guardar = () => {
    const errs: Errores = {}
    if (!limpiar(nombre)) errs.nombre = 'El nombre es obligatorio.'
    if (!correoValido(correo)) errs.correo = 'Correo inválido.'
    const docGuardar = docParaGuardar(doc)
    const tipo = oNull(tipodoc)
    if (docGuardar && !tipo) errs.tipodoc = 'Seleccione el tipo de documento.'
    setErrores(errs)
    if (Object.keys(errs).length) {
      toast.error(Object.values(errs)[0])
      return
    }

    void ejecutar(async () => {
      try {
        if (docGuardar && (await existeDocCliente(tipo, docGuardar, cliente?.id))) {
          const msg = 'Ya existe un cliente con ese tipo y número de documento.'
          setErrores({ doc: msg })
          toast.error(msg)
          return
        }
        const fila: Omit<Cliente, 'id' | 'municipio'> = {
          nombre_cliente: limpiar(nombre),
          tipopers_cliente: tipopers,
          tipodoc_cliente: tipo,
          doc_cliente: docGuardar,
          tel_cliente: oNull(tel),
          correo_cliente: oNull(correo),
          dir_cliente: oNull(dir),
          munic_id: municId,
          notas_cliente: notas.trim() || null,
          contacto_cliente: oNull(contacto),
          cargocont_cliente: oNull(cargo),
          asesor_id: asesorId,
          estado_cliente: activo,
          recordar_cliente: recordar,
        }
        let id: number
        if (cliente) {
          await actualizarCliente(cliente.id, fila)
          id = cliente.id
          toast.success('Cliente actualizado.')
        } else {
          id = await crearCliente(fila)
          avisarCreado('Cliente guardado', id)
        }
        void qc.invalidateQueries({ queryKey: CLAVE_CLIENTES })
        onGuardado(id)
        onCerrar()
      } catch (e) {
        toast.error(mensajeGuardar(e, 'Ya existe un cliente con esa información.'))
      }
    })
  }

  return (
    <DialogoFormulario
      titulo={cliente ? 'Editar cliente' : 'Nuevo cliente'}
      descripcion={cliente ? `Código ${cliente.id}` : 'El código se asigna al guardar.'}
      onCerrar={onCerrar}
      onGuardar={guardar}
      guardando={guardando}
      textoGuardar="Guardar cliente"
    >
      <Seccion titulo="Datos principales">
        <Campo etiqueta="Nombre" obligatorio error={errores.nombre} className="sm:col-span-2">
          <Input
            autoFocus
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value)
              setErrores((x) => ({ ...x, nombre: undefined }))
            }}
          />
        </Campo>
        <Campo etiqueta="Tipo de persona">
          <SelectorSimple
            valor={tipopers}
            onCambio={(v) => setTipopers(v ?? 'N')}
            opciones={[
              { valor: 'N', etiqueta: 'Natural' },
              { valor: 'J', etiqueta: 'Jurídica' },
            ]}
          />
        </Campo>
        <Campo etiqueta="Tipo de documento" error={errores.tipodoc}>
          <SelectorSimple valor={tipodoc} onCambio={cambiarTipo} opciones={opcionesTipo} vacio="— Seleccione —" />
        </Campo>
        <Campo
          etiqueta="Documento"
          error={errores.doc}
          ayuda={numerico ? 'Los puntos se agregan solos.' : 'Acepta letras y números.'}
        >
          <Input
            className="num"
            inputMode={numerico ? 'numeric' : 'text'}
            autoComplete="off"
            value={doc}
            onChange={(e) => {
              setDoc(formatearDoc(e.target.value, numerico))
              setErrores((x) => ({ ...x, doc: undefined, tipodoc: undefined }))
            }}
          />
        </Campo>
        <Campo etiqueta="Municipio">
          <Buscador<Municipio>
            valor={municipio}
            onCambio={(m) => setMunicId(m?.id ?? null)}
            opciones={municipios.data ?? []}
            etiqueta={(m) => m.nombre_munic}
            clave={(m) => m.id}
            placeholder={municipios.isPending ? 'Cargando municipios…' : 'Seleccione…'}
          />
        </Campo>
        <Campo etiqueta="Asesor asignado" className="sm:col-span-2">
          <Buscador<Asesor>
            valor={asesor}
            onCambio={(a) => setAsesorId(a?.id ?? null)}
            opciones={opcionesAsesor}
            etiqueta={(a) => a.nombre_asesor}
            clave={(a) => a.id}
            inactivo={(a) => !a.estado_asesor}
            placeholder={asesores.isPending ? 'Cargando asesores…' : '— Sin asesor —'}
          />
        </Campo>
      </Seccion>

      <Seccion titulo="Contacto">
        <Campo etiqueta="Teléfono">
          <Input type="tel" value={tel} onChange={(e) => setTel(e.target.value)} />
        </Campo>
        <Campo etiqueta="Correo" error={errores.correo}>
          <Input
            type="email"
            value={correo}
            onChange={(e) => {
              setCorreo(e.target.value)
              setErrores((x) => ({ ...x, correo: undefined }))
            }}
          />
        </Campo>
        <Campo etiqueta="Dirección" className="sm:col-span-2">
          <Input value={dir} onChange={(e) => setDir(e.target.value)} />
        </Campo>
        <Campo etiqueta="Persona de contacto">
          <Input value={contacto} onChange={(e) => setContacto(e.target.value)} />
        </Campo>
        <Campo etiqueta="Cargo del contacto">
          <Input value={cargo} onChange={(e) => setCargo(e.target.value)} />
        </Campo>
      </Seccion>

      <Seccion titulo="Notas y estado">
        <Campo etiqueta="Notas / observaciones" className="sm:col-span-2">
          <AreaTexto rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </Campo>
        <Casilla marcada={activo} onCambio={setActivo} etiqueta="Cliente activo" />
        <Casilla
          marcada={recordar}
          onCambio={setRecordar}
          etiqueta={
            <>
              Recordar cliente <span className="text-ink-soft">(seguimiento especial)</span>
            </>
          }
        />
      </Seccion>
    </DialogoFormulario>
  )
}
