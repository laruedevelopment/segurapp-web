import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CopyCheck, Download, FileText } from 'lucide-react'
import { Aviso } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import type { Columna } from '@/components/ui/tabla'
import { MAX_RESULTADOS_CLIENTES, buscarClientes, useCatalogo } from '@/datos/catalogos'
import { fmtDoc, fmtNum } from '@/lib/numeros'
import type { Cliente } from '@/lib/tipos'
import { CLAVE_CLIENTES, listarTodosClientes } from './clientesDatos'
import { AccionesFila, BotonNuevo, BotonRecargar, EtiquetaEstado, PaginaLista, columnaId, useEditor, useEliminar } from './comun'
import { DialogoCliente } from './DialogoCliente'

const docTexto = (c: Cliente) =>
  c.doc_cliente ? `${c.tipodoc_cliente ? c.tipodoc_cliente.trim() + ' ' : ''}${fmtDoc(c.doc_cliente)}` : ''

export default function Clientes() {
  const qc = useQueryClient()
  const eliminar = useEliminar()
  const editor = useEditor<Cliente>()
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [todos, setTodos] = useState(false)

  // Búsqueda en el servidor 400 ms después de la última tecla.
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto.trim()), 400)
    return () => clearTimeout(t)
  }, [texto])

  const modoTodos = todos && !busqueda
  // Cada búsqueda tiene su propia clave: si una respuesta vieja llega tarde
  // no reemplaza la lista (se muestra siempre la de la búsqueda actual).
  const consulta = useQuery({
    queryKey: modoTodos ? [...CLAVE_CLIENTES, 'todos'] : [...CLAVE_CLIENTES, 'busqueda', busqueda],
    queryFn: () => (modoTodos ? listarTodosClientes() : buscarClientes(busqueda)),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
  const municipios = useCatalogo('municipio')
  const nombreMunic = useMemo(() => new Map((municipios.data ?? []).map((m) => [m.id, m.nombre_munic])), [municipios.data])

  const clientes = consulta.data ?? []
  const vigente = !consulta.isPlaceholderData
  const enTope = vigente && !modoTodos && clientes.length >= MAX_RESULTADOS_CLIENTES

  const recargar = () => {
    void qc.invalidateQueries({ queryKey: CLAVE_CLIENTES })
    void municipios.refetch()
  }

  const borrar = (c: Cliente) =>
    eliminar({
      que: 'cliente',
      nombre: c.nombre_cliente,
      tabla: 'clientes',
      id: c.id,
      enUso: 'No puede eliminar este cliente porque está relacionado con pólizas.',
      despues: () => qc.invalidateQueries({ queryKey: CLAVE_CLIENTES }),
    })

  const columnas: Columna<Cliente>[] = [
    columnaId<Cliente>(),
    {
      id: 'nombre',
      titulo: 'Nombre',
      ancho: 260,
      celda: (c) => <span className="font-medium">{c.nombre_cliente}</span>,
      ordenar: (c) => c.nombre_cliente.toLowerCase(),
      titleDe: (c) => c.nombre_cliente,
    },
    { id: 'doc', titulo: 'Documento', ancho: 170, celda: (c) => <span className="num">{docTexto(c)}</span>, ordenar: (c) => c.doc_cliente },
    { id: 'tel', titulo: 'Teléfono', ancho: 130, celda: (c) => c.tel_cliente ?? '', ordenar: (c) => c.tel_cliente },
    {
      id: 'correo',
      titulo: 'Correo',
      ancho: 220,
      celda: (c) => c.correo_cliente ?? '',
      ordenar: (c) => c.correo_cliente?.toLowerCase(),
      titleDe: (c) => c.correo_cliente ?? undefined,
    },
    {
      id: 'munic',
      titulo: 'Municipio',
      ancho: 170,
      celda: (c) => (c.munic_id != null ? nombreMunic.get(c.munic_id) ?? '' : ''),
      ordenar: (c) => (c.munic_id != null ? nombreMunic.get(c.munic_id)?.toLowerCase() : null),
    },
    { id: 'estado', titulo: 'Estado', ancho: 95, celda: (c) => <EtiquetaEstado activo={c.estado_cliente} />, ordenar: (c) => (c.estado_cliente ? 0 : 1) },
    {
      id: 'acciones',
      titulo: '',
      ancho: 120,
      celda: (c) => (
        <AccionesFila onEditar={() => editor.editar(c)} onEliminar={() => void borrar(c)}>
          <Link
            to={`/catalogos/clientes/${c.id}/polizas`}
            title="Ver pólizas"
            className="rounded-lg p-2 text-ink-soft hover:bg-muted hover:text-green"
          >
            <FileText className="size-4" />
          </Link>
        </AccionesFila>
      ),
    },
  ]

  return (
    <PaginaLista
      titulo="Clientes"
      subtitulo={consulta.isSuccess ? `${fmtNum(clientes.length)} clientes${modoTodos ? '' : busqueda ? ' encontrados' : ''}` : undefined}
      acciones={
        <>
          <Link to="/catalogos/clientes/duplicados">
            <Boton variante="secundario" tamano="sm" title="Clientes con el mismo tipo y número de documento">
              <CopyCheck />
              Duplicados
            </Boton>
          </Link>
          <BotonRecargar onClick={recargar} cargando={consulta.isFetching} />
          <BotonNuevo onClick={editor.nuevo}>Nuevo cliente</BotonNuevo>
        </>
      }
      busqueda={texto}
      onBusqueda={setTexto}
      placeholder="Buscar por nombre, documento, teléfono o correo"
      avisos={
        <>
          {enTope && busqueda && (
            <Aviso icono={<AlertCircle />}>
              Hay más de {fmtNum(MAX_RESULTADOS_CLIENTES)} coincidencias: se muestran las primeras {fmtNum(MAX_RESULTADOS_CLIENTES)}.
              Escriba más letras para afinar la búsqueda.
            </Aviso>
          )}
          {enTope && !busqueda && (
            <Aviso tono="navy" icono={<AlertCircle />}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1">Mostrando los primeros {fmtNum(clientes.length)} clientes (A–Z).</span>
                <Boton tamano="sm" variante="secundario" onClick={() => setTodos(true)}>
                  <Download />
                  Cargar todos
                </Boton>
              </div>
            </Aviso>
          )}
          {todos && !busqueda && consulta.isFetching && consulta.isPlaceholderData && (
            <Aviso tono="navy" icono={<Download />}>
              Cargando todos los clientes…
            </Aviso>
          )}
        </>
      }
      cargando={consulta.isPending || (consulta.isFetching && consulta.isPlaceholderData && !clientes.length)}
      error={consulta.error}
      onReintentar={() => consulta.refetch()}
      filas={clientes}
      columnas={columnas}
      clave={(c) => c.id}
      alHacerClic={(c) => editor.editar(c)}
      ordenInicial={{ columna: 'nombre', asc: true }}
      textoVacio="No hay clientes."
    >
      <DialogoCliente
        abierto={editor.abierto}
        clienteId={editor.fila?.id ?? null}
        onCerrar={editor.cerrar}
        onGuardado={() => undefined}
      />
    </PaginaLista>
  )
}
