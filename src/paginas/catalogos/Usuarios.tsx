import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Chip, Etiqueta } from '@/components/ui/basicos'
import { Campo, Casilla, Input, SelectorSimple } from '@/components/ui/campos'
import type { Columna } from '@/components/ui/tabla'
import { existeApodoUsuario, guardarUsuario, useCatalogo, useRefrescarCatalogo } from '@/datos/catalogos'
import { fmtNum } from '@/lib/numeros'
import { useSesion } from '@/lib/sesion'
import type { Usuario } from '@/lib/tipos'
import {
  AccionesFila,
  BotonNuevo,
  BotonRecargar,
  DialogoFormulario,
  EtiquetaEstado,
  PaginaLista,
  Seccion,
  coincide,
  columnaId,
  mensajeGuardar,
  useEditor,
  useEliminar,
  useGuardando,
} from './comun'
import { etiquetaRol } from './utilidades'

const MIN_CLAVE = 8

export default function Usuarios() {
  const consulta = useCatalogo('usuarios')
  const refrescar = useRefrescarCatalogo()
  const eliminar = useEliminar()
  const editor = useEditor<Usuario>()
  const miId = useSesion()?.usuario.id
  const [texto, setTexto] = useState('')
  const [soloActivos, setSoloActivos] = useState(true)

  const filas = useMemo(
    () =>
      (consulta.data ?? []).filter(
        (u) => (!soloActivos || u.estado_usuario) && coincide(texto, u.id, u.apodo_usuario, u.nombre_usuario, u.rol, etiquetaRol(u.rol)),
      ),
    [consulta.data, soloActivos, texto],
  )

  const borrar = (u: Usuario) => {
    if (u.id === miId) {
      toast.error('No puede eliminar su propio usuario.')
      return
    }
    void eliminar({
      que: 'usuario',
      nombre: u.apodo_usuario,
      tabla: 'usuarios',
      id: u.id,
      enUso:
        'No puede eliminar este usuario porque tiene pólizas, abonos o reportes registrados a su nombre. Desactívelo en su lugar.',
      despues: () => refrescar('usuarios'),
    })
  }

  const columnas: Columna<Usuario>[] = [
    columnaId<Usuario>(),
    {
      id: 'apodo',
      titulo: 'Usuario',
      ancho: 160,
      celda: (u) => (
        <span className="font-medium">
          {u.apodo_usuario}
          {u.id === miId && <span className="ml-1.5 text-[11px] text-ink-soft">(usted)</span>}
        </span>
      ),
      ordenar: (u) => u.apodo_usuario.toLowerCase(),
    },
    { id: 'nombre', titulo: 'Nombre', ancho: 260, celda: (u) => u.nombre_usuario, ordenar: (u) => u.nombre_usuario.toLowerCase(), titleDe: (u) => u.nombre_usuario },
    { id: 'correo', titulo: 'Correo', ancho: 220, celda: (u) => u.correo_usuario ?? '', ordenar: (u) => u.correo_usuario?.toLowerCase(), titleDe: (u) => u.correo_usuario ?? undefined },
    {
      id: 'rol',
      titulo: 'Rol',
      ancho: 140,
      celda: (u) => <Etiqueta tono={u.rol.toUpperCase() === 'A' ? 'navy' : 'neutro'}>{etiquetaRol(u.rol)}</Etiqueta>,
      ordenar: (u) => etiquetaRol(u.rol),
    },
    { id: 'estado', titulo: 'Estado', ancho: 100, celda: (u) => <EtiquetaEstado activo={u.estado_usuario} />, ordenar: (u) => (u.estado_usuario ? 0 : 1) },
    {
      id: 'acciones',
      titulo: '',
      ancho: 90,
      celda: (u) => <AccionesFila onEditar={() => editor.editar(u)} onEliminar={u.id === miId ? undefined : () => borrar(u)} />,
    },
  ]

  return (
    <PaginaLista
      titulo="Usuarios"
      subtitulo={consulta.isSuccess ? `${fmtNum(filas.length)} de ${fmtNum(consulta.data.length)} usuarios` : undefined}
      acciones={
        <>
          <BotonRecargar onClick={() => refrescar('usuarios')} cargando={consulta.isFetching} />
          <BotonNuevo onClick={editor.nuevo}>Nuevo usuario</BotonNuevo>
        </>
      }
      busqueda={texto}
      onBusqueda={setTexto}
      placeholder="Buscar por código, usuario, nombre o rol"
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
      clave={(u) => u.id}
      alHacerClic={editor.editar}
      ordenInicial={{ columna: 'apodo', asc: true }}
      textoVacio="No hay usuarios."
    >
      {editor.abierto && <FormularioUsuario usuario={editor.fila} esUnoMismo={editor.fila?.id === miId} onCerrar={editor.cerrar} />}
    </PaginaLista>
  )
}

function FormularioUsuario({
  usuario,
  esUnoMismo,
  onCerrar,
}: {
  usuario: Usuario | null
  esUnoMismo: boolean
  onCerrar: () => void
}) {
  const refrescar = useRefrescarCatalogo()
  const [guardando, ejecutar] = useGuardando()
  const [apodo, setApodo] = useState(usuario?.apodo_usuario ?? '')
  const [nombre, setNombre] = useState(usuario?.nombre_usuario ?? '')
  const [correo, setCorreo] = useState(usuario?.correo_usuario ?? '')
  const [clave, setClave] = useState('')
  const [rol, setRol] = useState<string>((usuario?.rol ?? 'D').toUpperCase())
  const [activo, setActivo] = useState(usuario?.estado_usuario ?? true)
  const [errores, setErrores] = useState<Partial<Record<'apodo' | 'nombre' | 'correo' | 'clave' | 'rol', string>>>({})

  // A = Administrador, D = Digitador. Si el usuario ya tiene otro rol (ej.
  // S = Comisiones) se muestra y se conserva en vez de cambiarlo sin avisar.
  const rolOriginal = (usuario?.rol ?? '').toUpperCase()
  const roles = [
    { valor: 'A', etiqueta: 'A — Administrador' },
    { valor: 'D', etiqueta: 'D — Digitador' },
    ...(rolOriginal && rolOriginal !== 'A' && rolOriginal !== 'D'
      ? [{ valor: rolOriginal, etiqueta: `${rolOriginal} — ${etiquetaRol(rolOriginal)} (rol actual)` }]
      : []),
  ]

  const guardar = () => {
    const errs: typeof errores = {}
    if (!apodo.trim()) errs.apodo = 'El usuario es obligatorio.'
    if (!nombre.trim()) errs.nombre = 'El nombre es obligatorio.'
    const c = correo.trim()
    if (c && (!c.includes('@') || !c.includes('.'))) errs.correo = 'Correo no válido.'
    if (!clave && !usuario) errs.clave = 'La contraseña es obligatoria para usuarios nuevos.'
    else if (clave && clave.length < MIN_CLAVE) errs.clave = `Mínimo ${MIN_CLAVE} caracteres.`
    if (esUnoMismo && rol !== 'A') errs.rol = 'No puede quitarse a sí mismo el rol de Administrador.'
    setErrores(errs)
    if (Object.keys(errs).length) return
    if (esUnoMismo && !activo) {
      toast.error('No puede desactivarse ni quitarse el rol de Administrador a sí mismo.')
      return
    }

    void ejecutar(async () => {
      try {
        if (await existeApodoUsuario(apodo, usuario?.id)) {
          setErrores({ apodo: 'Ya existe otro usuario con ese apodo.' })
          toast.error('Ya existe otro usuario con ese apodo.')
          return
        }
        await guardarUsuario(
          usuario?.id ?? null,
          {
            apodo_usuario: apodo.trim(),
            nombre_usuario: nombre.trim(),
            rol,
            asesor_id: usuario?.asesor_id ?? null,
            correo_usuario: c ? c.toLowerCase() : null,
            estado_usuario: activo,
          },
          // Solo se envía si se escribió una nueva (la base la convierte en hash).
          clave || undefined,
        )
        toast.success(usuario ? 'Usuario actualizado.' : 'Usuario creado.')
        void refrescar('usuarios')
        onCerrar()
      } catch (e) {
        toast.error(mensajeGuardar(e, 'Ya existe un usuario con ese apodo.'))
      }
    })
  }

  return (
    <DialogoFormulario
      titulo={usuario ? 'Editar usuario' : 'Nuevo usuario'}
      descripcion={usuario ? `Código ${usuario.id}${esUnoMismo ? ' · es su propio usuario' : ''}` : undefined}
      onCerrar={onCerrar}
      onGuardar={guardar}
      guardando={guardando}
    >
      <Seccion titulo="Identificación">
        <Campo etiqueta="Usuario (apodo)" obligatorio error={errores.apodo} ayuda="Nombre corto para iniciar sesión.">
          <Input autoFocus autoComplete="off" value={apodo} onChange={(e) => setApodo(e.target.value)} />
        </Campo>
        <Campo etiqueta="Nombre completo" obligatorio error={errores.nombre}>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <Campo etiqueta="Correo electrónico" error={errores.correo} className="sm:col-span-2">
          <Input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </Campo>
      </Seccion>
      <Seccion titulo="Acceso">
        <Campo
          etiqueta={usuario ? 'Nueva contraseña' : 'Contraseña'}
          obligatorio={!usuario}
          error={errores.clave}
          ayuda={usuario ? `Déjela vacía para no cambiarla. Mínimo ${MIN_CLAVE} caracteres.` : `Mínimo ${MIN_CLAVE} caracteres.`}
        >
          <Input type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} />
        </Campo>
        <Campo etiqueta="Rol" obligatorio error={errores.rol}>
          <SelectorSimple valor={rol} onCambio={(v) => v && setRol(v)} opciones={roles} />
        </Campo>
        <Casilla marcada={activo} onCambio={setActivo} etiqueta="Usuario activo" disabled={esUnoMismo} />
      </Seccion>
    </DialogoFormulario>
  )
}
