// Crear / editar una póliza (réplica de lib/ui/pagina_formulario_polizas.dart).
//   /polizas/nueva               póliza nueva
//   /polizas/nueva?pendiente=ID  retomar un borrador o una póliza de la carga masiva
//   /polizas/:id                 editar
// La lógica pura (cálculos, validación, matching de la IA) está en
// ./formulario/logica.ts y ./formulario/extraccion.ts, con sus pruebas.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useBlocker, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  FilePen,
  FileText,
  Hash,
  Info,
  Landmark,
  Pencil,
  PieChart,
  Save,
  Sparkles,
  StickyNote,
  Trash2,
  UserPlus,
  UserRound,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Aviso, Cargando, Chip, MensajeError, SeccionTarjeta } from '@/components/ui/basicos'
import { Buscador } from '@/components/ui/buscador'
import { Boton } from '@/components/ui/button'
import { AreaTexto, Campo, Input, InputNumero } from '@/components/ui/campos'
import { Dialogo, useConfirmar } from '@/components/ui/dialogo'
import { InputFecha } from '@/components/ui/fecha'
import {
  buscarClientePorDoc,
  buscarClientes,
  buscarProductoAprendido,
  obtenerCliente,
  reforzarAprendizajeRolCliente,
  registrarAprendizajeProducto,
  rolClientePreferido,
  useCatalogo,
} from '@/datos/catalogos'
import { extraerPoliza } from '@/datos/ia'
import {
  actualizarPendiente,
  crearPendiente,
  eliminarPendiente,
  obtenerPendiente,
  type PolizaPendiente,
} from '@/datos/pendientes'
import {
  actualizarPoliza,
  PolizaNoDisponibleError,
  crearPoliza,
  existeNroPoliza,
  listarPolizasPorIds,
  obtenerPoliza,
} from '@/datos/polizas'
import { quitarPolizasDeCache, refrescarPolizas } from '@/datos/usePolizas'
import { normalizarAlfanumerico } from '@/lib/filtros'
import { fmtDoc, fmtNum } from '@/lib/numeros'
import { usuarioId } from '@/lib/sesion'
import type { Aseguradora, EstadoPoliza, FormaExpedicion, FormaPago, Intermediario, PolizaLista, Producto, Ramo } from '@/lib/tipos'
import { mensajeAmigable } from '@/lib/errores'
import DialogoEliminar from './DialogoEliminar'
import { DialogoCliente, type PropsDialogoCliente } from '@/paginas/catalogos/DialogoCliente'
import {
  aplicarExtraccion,
  aprendizajeAlGuardar,
  avisoExtraccion,
  clienteExtraidoPorRol,
  requiereConfirmarSeriedad,
  sugerenciaVacia,
  type CatalogosExtraccion,
  type DepsExtraccion,
  type SugerenciaIA,
} from './formulario/extraccion'
import {
  activosMasSeleccionados,
  aplicarDefaultsProducto,
  aplicarDefaultsRamo,
  cambiarAseguradora,
  conPrima,
  datosParaActualizar,
  debeVerificarNro,
  DECIMALES_PORC,
  desdeBorrador,
  desdePoliza,
  formatearNroPoliza,
  formVacio,
  mapaActual,
  nombreArchivoSugerido,
  productosDisponibles,
  ramosDisponibles,
  recalcularComision,
  rotulosCliente,
  sugerirComDistrib,
  sugerirFin,
  sumaPorcAdicional,
  sumaPorcPrincipal,
  validar,
  type CampoForm,
  type ClienteSel,
  type EstadoForm,
} from './formulario/logica'
import { DialogoGuardada, FilaAsesor, TotalPorcentaje, ValorFijo } from './formulario/piezas'

const EXTENSIONES = ['pdf', 'jpg', 'jpeg', 'png', 'webp']

const avisoSinSeriedad = (aseguradora: string | undefined) =>
  `El documento parece de seriedad de la oferta, pero ${aseguradora ?? 'la aseguradora'} no tiene un producto de seriedad en el catálogo. Revise el producto antes de guardar.`

type EstadoConActivo =EstadoPoliza & { estado_activo?: boolean | null }

export default function Pagina() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const location = useLocation()
  const polizaId = id != null ? Number(id) : null
  const pendienteId = params.get('pendiente') ? Number(params.get('pendiente')) : null

  if (id != null && (!Number.isInteger(polizaId) || (polizaId ?? 0) <= 0)) {
    return (
      <Contenido>
        <MensajeError error={`"${id}" no es un código de póliza válido.`} />
      </Contenido>
    )
  }
  // Cambiar de póliza (o de pendiente) arranca un formulario limpio.
  return (
    <FormularioPoliza
      key={location.pathname + location.search}
      polizaId={polizaId}
      pendienteId={pendienteId != null && Number.isInteger(pendienteId) ? pendienteId : null}
    />
  )
}

interface Original {
  nro: string
  asegId: number | null
  estadoId: string | null
  primaPagada: number | null
}

const depsIA: DepsExtraccion = {
  buscarClientePorDoc: (doc) => buscarClientePorDoc(doc),
  buscarClientes: (texto, limite) => buscarClientes(texto, limite),
  buscarProductoAprendido: (asegId, texto) => buscarProductoAprendido(asegId, texto),
}

function FormularioPoliza({ polizaId, pendienteId }: { polizaId: number | null; pendienteId: number | null }) {
  const esEdicion = polizaId != null
  const navigate = useNavigate()
  const qc = useQueryClient()
  const confirmar = useConfirmar()

  const cAseg = useCatalogo('aseguradoras')
  const cRamos = useCatalogo('ramos')
  const cProd = useCatalogo('productos')
  const cAsesores = useCatalogo('asesores')
  const cInterm = useCatalogo('intermediarios')
  const cFormasPago = useCatalogo('formas_pago')
  const cFormaExp = useCatalogo('formaexp')
  const cEstados = useCatalogo('estados_poliza')
  const catalogos = [cAseg, cRamos, cProd, cAsesores, cInterm, cFormasPago, cFormaExp, cEstados]
  const catalogosListos = catalogos.every((c) => c.data)
  const errorCatalogo = catalogos.find((c) => c.error)?.error

  const [form, setForm] = useState<EstadoForm | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [original, setOriginal] = useState<Original | null>(null)
  const [pendiente, setPendiente] = useState<PolizaPendiente | null>(null)
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null)
  const [clienteExtraido, setClienteExtraido] = useState<{ nombre: string | null; doc: string | null; garantia: boolean } | null>(null)
  const [intento, setIntento] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [guardandoBorrador, setGuardandoBorrador] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [paraEliminar, setParaEliminar] = useState<PolizaLista | null>(null)
  const [importando, setImportando] = useState(false)
  const [nroRepetido, setNroRepetido] = useState<{ norm: string; asegId: number } | null>(null)
  const [dlgCliente, setDlgCliente] = useState<Pick<PropsDialogoCliente, 'clienteId' | 'inicial'> | null>(null)
  const [guardada, setGuardada] = useState<Parameters<typeof DialogoGuardada>[0]['datos']>(null)

  // Refs para leer el valor más reciente desde atajos y funciones asíncronas.
  const formRef = useRef(form)
  formRef.current = form
  const sugerenciaRef = useRef<SugerenciaIA>(sugerenciaVacia())
  const sucioRef = useRef(false)
  const permitirSalidaRef = useRef(false)
  const vivoRef = useRef(true)
  const iniciadoRef = useRef(false)
  const archivoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    vivoRef.current = true
    return () => {
      vivoRef.current = false
    }
  }, [])

  // ── Catálogos para los selectores ─────────────────────────────────────────
  const aseguradoras = useMemo(() => cAseg.data ?? [], [cAseg.data])
  const ramos = useMemo(() => cRamos.data ?? [], [cRamos.data])
  const productos = useMemo(() => cProd.data ?? [], [cProd.data])
  const asesores = useMemo(() => cAsesores.data ?? [], [cAsesores.data])
  const productosActivos = useMemo(() => productos.filter((p) => p.estado_prod), [productos])
  const ramosActivos = useMemo(() => ramos.filter((r) => r.estado_ramo), [ramos])
  const aseguradorasActivas = useMemo(() => aseguradoras.filter((a) => a.estado_aseg), [aseguradoras])
  const estadosTodos = useMemo(
    () =>
      [...((cEstados.data ?? []) as EstadoConActivo[])].sort((a, b) => a.nombre_estado.localeCompare(b.nombre_estado, 'es')),
    [cEstados.data],
  )

  const catIA: CatalogosExtraccion = useMemo(
    () => ({ aseguradoras: aseguradorasActivas, ramos: ramosActivos, productos }),
    [aseguradorasActivas, ramosActivos, productos],
  )

  const f = form ?? formVacio()
  const listas = useMemo(() => {
    const ramosBase = activosMasSeleccionados(ramos, (r) => r.estado_ramo, [f.ramoId])
    return {
      aseguradoras: activosMasSeleccionados(aseguradoras, (a) => a.estado_aseg, [f.asegId]),
      ramosBase,
      ramos: ramosDisponibles(ramosBase, productosActivos, f.asegId, f.ramoId),
      productos: productosDisponibles(productos, f.ramoId, f.asegId, f.productoId),
      asesores: activosMasSeleccionados(asesores, (a) => a.estado_asesor, [
        f.asesor1Id, f.asesor2Id, f.asesor3Id, f.agenciaId, f.asesorAdId, f.agenciaAdId,
      ]),
      formasPago: activosMasSeleccionados(cFormasPago.data ?? [], (x) => x.estado_forma_pago !== false, [f.formaPagoId]),
      intermediarios: activosMasSeleccionados(cInterm.data ?? [], (x) => x.estado_interm !== false, [f.intermediarioId]),
      estados: activosMasSeleccionados(estadosTodos, (x) => x.estado_activo !== false, [f.estadoId]),
      formasExp: cFormaExp.data ?? [],
    }
  }, [
    ramos, aseguradoras, productos, productosActivos, asesores, cFormasPago.data, cInterm.data, cFormaExp.data, estadosTodos,
    f.ramoId, f.asegId, f.productoId, f.asesor1Id, f.asesor2Id, f.asesor3Id, f.agenciaId, f.asesorAdId, f.agenciaAdId,
    f.formaPagoId, f.intermediarioId, f.estadoId,
  ])

  const aseguradora = aseguradoras.find((a) => a.id === f.asegId) ?? null
  const ramo = ramos.find((r) => r.id === f.ramoId) ?? null
  const producto = listas.productos.find((p) => p.id === f.productoId) ?? null


  // ── Carga inicial ─────────────────────────────────────────────────────────
  /** Cliente que leyó la IA y no está en la base: se ofrece crearlo. */
  const avisarClienteNoEncontrado = async (datos: Record<string, unknown>, asegId: number | null, garantia = false) => {
    // Garantía: el cliente es siempre el tomador (por su NIT), sin rol aprendido.
    let rol: string | null = 'tomador'
    if (asegId != null && !garantia) {
      try {
        rol = (await rolClientePreferido(asegId)) ?? 'tomador'
      } catch {
        /* sin preferencia */
      }
    }
    const c = clienteExtraidoPorRol(datos, rol)
    if (vivoRef.current) setClienteExtraido(c.nombre || c.doc ? { ...c, garantia } : null)
    return c
  }

  useEffect(() => {
    if (!catalogosListos || iniciadoRef.current) return
    iniciadoRef.current = true
    ;(async () => {
      try {
        let nuevo: EstadoForm
        if (polizaId != null) {
          const p = await obtenerPoliza(polizaId)
          if (!p) throw new Error(`No se encontró la póliza con código ${polizaId}. Puede que la hayan eliminado.`)
          nuevo = desdePoliza(p)
          if (nuevo.asegId == null && nuevo.productoId != null)
            nuevo.asegId = productos.find((x) => x.id === nuevo.productoId)?.aseguradora_id ?? null
          setOriginal({ nro: p.nro_poliza ?? '', asegId: p.aseg_id, estadoId: p.estado_poliza_id, primaPagada: p.vlrprimapagada_poliza })
        } else {
          nuevo = valoresPorDefecto()
          if (pendienteId != null) {
            const pend = await obtenerPendiente(pendienteId)
            if (!pend) throw new Error('No se encontró esta póliza pendiente. Puede que ya la hayan guardado o eliminado.')
            if (!vivoRef.current) return
            setPendiente(pend)
            if (pend.estado === 'borrador') {
              const r = desdeBorrador(nuevo, pend.datos, productos)
              nuevo = r.form
              if (r.clienteId != null) {
                const c = await obtenerCliente(r.clienteId)
                if (c) nuevo.cliente = c
              }
            } else {
              // Resultado crudo de la IA que dejó la carga masiva.
              const r = await aplicarExtraccion(nuevo, pend.datos, catIA, depsIA)
              nuevo = r.form
              sugerenciaRef.current = r.sugerencia
              if (r.completados > 0)
                toast.info(`Póliza predigitada: revise los ${r.completados} campo(s) antes de guardar.${avisoExtraccion(pend.datos)}`, { duration: 10000 })
              else toast.warning('No se pudo aplicar la información predigitada; complétela a mano.')
              if (r.seriedadSinProducto) toast.warning(avisoSinSeriedad(aseguradoras.find((a) => a.id === r.form.asegId)?.nombre_aseg))
              if (!nuevo.cliente && Object.keys(pend.datos).length) await avisarClienteNoEncontrado(pend.datos, nuevo.asegId, r.esGarantia)
            }
          }
        }
        // Un producto que no pertenece al ramo y la aseguradora de la póliza
        // no se muestra (igual que Flutter): hay que escogerlo de nuevo.
        if (nuevo.productoId != null && !productosDisponibles(productos, nuevo.ramoId, nuevo.asegId, nuevo.productoId).some((x) => x.id === nuevo.productoId))
          nuevo.productoId = null
        if (vivoRef.current) setForm(nuevo)
      } catch (e) {
        if (vivoRef.current) setErrorCarga(mensajeAmigable(e, 'No se pudo abrir el formulario'))
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogosListos])

  /** Póliza nueva: estado inicial, contado, Luz Stella con el 100%. */
  function valoresPorDefecto(): EstadoForm {
    const contiene = (s: string, t: string) => s.toUpperCase().includes(t)
    const estadosActivos = estadosTodos.filter((e) => e.estado_activo !== false)
    const asesor1 = asesores.find((a) => a.estado_asesor && contiene(a.nombre_asesor, 'LUZ STELLA SERRANO'))
    return {
      ...formVacio(),
      estadoId: estadosActivos.find((e) => e.id === 'I')?.id ?? null,
      formaPagoId: (cFormasPago.data ?? []).find((x) => x.estado_forma_pago !== false && contiene(x.nombre_forma_pago, 'CONTADO'))?.id ?? null,
      formaExpId: (cFormaExp.data ?? []).find((x) => contiene(x.nombre_formaexp, 'STELLA'))?.id ?? null,
      intermediarioId: (cInterm.data ?? []).find((x) => x.estado_interm !== false && contiene(x.nombre_interm, 'STELLA'))?.id ?? null,
      asesor1Id: asesor1?.id ?? null,
      porcAsesor1: asesor1 ? 100 : null,
    }
  }

  // ── Cambios ───────────────────────────────────────────────────────────────
  const upd = (fn: (f: EstadoForm) => EstadoForm) => {
    sucioRef.current = true
    setForm((prev) => (prev ? fn(prev) : prev))
  }
  const set = <K extends keyof EstadoForm>(k: K, v: EstadoForm[K]) => upd((x) => ({ ...x, [k]: v }))

  // ── Número de póliza repetido (en la misma aseguradora) ───────────────────
  useEffect(() => {
    if (!form) return
    const { nro, asegId } = form
    if (asegId == null || !debeVerificarNro(nro, asegId, original)) {
      setNroRepetido(null)
      return
    }
    let vigente = true
    const t = setTimeout(async () => {
      try {
        const existe = await existeNroPoliza(nro, asegId, polizaId)
        if (vigente) setNroRepetido(existe ? { norm: normalizarAlfanumerico(nro), asegId } : null)
      } catch {
        /* se vuelve a verificar al guardar */
      }
    }, 500)
    return () => {
      vigente = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.nro, form?.asegId, original])

  const mensajeRepetido = (nro: string) =>
    `Ya existe una póliza de ${aseguradora?.nombre_aseg ?? 'esta aseguradora'} con el número "${formatearNroPoliza(nro)}".`
  const errorNro =
    form && nroRepetido && nroRepetido.asegId === form.asegId && nroRepetido.norm === normalizarAlfanumerico(form.nro)
      ? mensajeRepetido(form.nro)
      : null

  // ── Validación ────────────────────────────────────────────────────────────
  const errores = useMemo(() => (intento && form ? validar(form) : []), [intento, form])
  const errorDe = (c: CampoForm) => errores.find((e) => e.campo === c)?.mensaje ?? null

  const irACampo = (campo: CampoForm) => {
    const el = document.getElementById(`campo-${campo}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.querySelector<HTMLElement>('input, button, textarea, select')?.focus({ preventScroll: true })
  }

  /** Espera a que un campo con foco (fecha escrita a mano) confirme su valor. */
  const confirmarCampoActivo = async () => {
    const activo = document.activeElement as HTMLElement | null
    if (activo && activo !== document.body) activo.blur()
    await new Promise((r) => setTimeout(r, 0))
  }

  const invalidarListas = () => {
    qc.invalidateQueries({ queryKey: ['pendientes'] })
    qc.invalidateQueries({ queryKey: ['polizas'], predicate: (q) => q.queryKey[1] !== 'todas' })
  }

  const volver = () => {
    permitirSalidaRef.current = true
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/polizas')
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  const guardar = async () => {
    if (guardando || guardandoBorrador || importando || !formRef.current) return
    await confirmarCampoActivo()
    const actual = formRef.current
    if (!actual) return
    setIntento(true)
    const errs = validar(actual)
    if (errs.length) {
      toast.error(errs[0].detalle + (errs.length > 1 ? ` Hay ${errs.length} campos por revisar.` : ''))
      irACampo(errs[0].campo)
      return
    }
    const uid = usuarioId()
    if (uid == null) {
      toast.error('No hay un usuario activo en sesión.')
      return
    }

    // Una póliza de cumplimiento cuyo texto habla de "seriedad" (de la oferta)
    // es de seriedad: se pide confirmar antes de guardarla con otro producto.
    if (requiereConfirmarSeriedad({ ramo: ramo?.nombre_ramo, producto, bien: actual.bien, obs: actual.obs })) {
      const seguir = await confirmar({
        titulo: '¿Es una póliza de seriedad?',
        mensaje: (
          <>
            El bien asegurado o la observación mencionan «seriedad», pero el producto elegido es «{producto?.nombre_prod ?? '—'}». Una
            póliza de seriedad de la oferta no se clasifica como cumplimiento.
            <br />
            <br />
            ¿Guardar con este producto de todas formas?
          </>
        ),
        confirmar: 'Guardar igual',
        cancelar: 'Revisar',
      })
      if (!seguir || !vivoRef.current) return
    }

    setGuardando(true)
    try {
      if (debeVerificarNro(actual.nro, actual.asegId, original)) {
        const existe = await existeNroPoliza(actual.nro, actual.asegId, polizaId)
        if (existe) {
          setNroRepetido({ norm: normalizarAlfanumerico(actual.nro), asegId: actual.asegId! })
          toast.error(mensajeRepetido(actual.nro))
          irACampo('nro')
          return
        }
      }

      const mapa = mapaActual(actual, uid)
      let idReal: number
      if (polizaId != null && original) {
        await actualizarPoliza(polizaId, datosParaActualizar(mapa, original))
        idReal = polizaId
      } else {
        idReal = await crearPoliza(mapa)
      }

      // Aprendizaje de la IA: solo con la póliza ya guardada.
      const apr = aprendizajeAlGuardar(sugerenciaRef.current, {
        productoId: actual.productoId,
        clienteId: actual.cliente?.id ?? null,
        asegId: actual.asegId,
      })
      if (apr.producto)
        registrarAprendizajeProducto(apr.producto.asegId, apr.producto.texto, apr.producto.productoId).catch(() => {})
      if (apr.rol) reforzarAprendizajeRolCliente(apr.rol.asegId, apr.rol.rol).catch(() => {})
      sugerenciaRef.current = sugerenciaVacia()

      // Ya es una póliza real: el pendiente sobra.
      if (pendiente) {
        try {
          await eliminarPendiente(pendiente.id)
        } catch {
          /* queda en Pendientes y se puede borrar a mano */
        }
      }

      void refrescarPolizas(qc, [idReal])
      invalidarListas()
      sucioRef.current = false
      permitirSalidaRef.current = true

      if (!esEdicion) {
        setGuardada({
          id: idReal,
          nro: actual.nro,
          cliente: actual.cliente?.nombre_cliente ?? null,
          aseguradora: aseguradora?.nombre_aseg ?? null,
          prima: actual.prima,
          nombreArchivo: nombreArchivoSugerido(idReal, nombreArchivo ?? pendiente?.nombre_archivo),
        })
      } else {
        toast.success('Póliza actualizada.')
        volver()
      }
    } catch (e) {
      if (e instanceof PolizaNoDisponibleError) {
        // La marcaron para eliminar mientras se editaba: sale de las listas.
        quitarPolizasDeCache(qc, [e.polizaId])
        invalidarListas()
        toast.error(e.message)
      } else {
        toast.error(mensajeAmigable(e, 'No se pudo guardar la póliza'))
      }
    } finally {
      if (vivoRef.current) setGuardando(false)
    }
  }

  // ── Borrador (no exige ningún campo) ──────────────────────────────────────
  /** [salida]: si se guarda desde el aviso de salida, devuelve true y no navega (lo hace el bloqueo). */
  const guardarBorrador = async (salida = false): Promise<boolean> => {
    if (esEdicion || guardando || guardandoBorrador || importando || !formRef.current) return false
    await confirmarCampoActivo()
    const actual = formRef.current
    if (!actual) return false
    setGuardandoBorrador(true)
    try {
      // nombre_cliente solo sirve para identificarlo en la lista de Pendientes.
      const datos = { ...mapaActual(actual, usuarioId()), nombre_cliente: actual.cliente?.nombre_cliente ?? null }
      if (pendiente) await actualizarPendiente(pendiente.id, { estado: 'borrador', datos })
      else await crearPendiente({ estado: 'borrador', datos, origen: 'manual', nombre_archivo: nombreArchivo })
      toast.success('Guardado como borrador.')
      invalidarListas()
      sucioRef.current = false
      if (salida) permitirSalidaRef.current = true
      else volver()
      return true
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudo guardar el borrador'))
      return false
    } finally {
      if (vivoRef.current) setGuardandoBorrador(false)
    }
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────
  const eliminar = async () => {
    if (polizaId == null || eliminando) return
    setEliminando(true)
    try {
      // Se muestra con los datos de la lista (nro., cliente, aseguradora, prima).
      const [fila] = await listarPolizasPorIds([polizaId])
      if (!fila) throw new PolizaNoDisponibleError(polizaId)
      setParaEliminar(fila)
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudo preparar la eliminación'))
    } finally {
      if (vivoRef.current) setEliminando(false)
    }
  }

  /** Quedó marcada: ya no está en las listas, así que se sale del formulario. */
  const alMarcarEliminada = () => {
    setParaEliminar(null)
    invalidarListas()
    permitirSalidaRef.current = true
    navigate('/polizas', { replace: true })
  }

  // ── Importar desde PDF/imagen con IA ──────────────────────────────────────
  const importar = async (archivo: File) => {
    const ext = archivo.name.split('.').pop()?.toLowerCase() ?? ''
    if (!EXTENSIONES.includes(ext)) {
      toast.error('No se pudo leer el archivo. Use PDF, JPG, PNG o WEBP.')
      return
    }
    setImportando(true)
    try {
      const asegNombre = new Map(aseguradorasActivas.map((a) => [a.id, a.nombre_aseg]))
      const ramoNombre = new Map(ramosActivos.map((r) => [r.id, r.nombre_ramo]))
      const catalogo = productosActivos
        .map((p) => ({ aseguradora: asegNombre.get(p.aseguradora_id) ?? '', ramo: ramoNombre.get(p.ramo_id) ?? '', producto: p.nombre_prod }))
        .filter((x) => x.aseguradora && x.ramo)
      const datos = await extraerPoliza(archivo, catalogo)
      const base = formRef.current
      if (!base || !vivoRef.current) return
      const r = await aplicarExtraccion(base, datos, catIA, depsIA)
      if (!vivoRef.current) return
      sucioRef.current = true
      setForm(r.form)
      sugerenciaRef.current = r.sugerencia
      setNombreArchivo(archivo.name)
      setIntento(false)
      let aviso = ''
      if (!r.form.cliente) {
        const c = await avisarClienteNoEncontrado(datos, r.form.asegId, r.esGarantia)
        aviso = r.esGarantia
          ? // Garantía: el cliente es el tomador/afianzado/garantizado y solo se busca por su NIT.
            ` No existe en la base el cliente con NIT "${c.doc ?? '—'}" (${c.nombre ?? '—'}), que es el tomador/afianzado/garantizado: selecciónelo o créelo antes de guardar.`
          : ` Cliente extraído: "${c.nombre ?? '—'}" (doc. "${c.doc ?? '—'}"); no se encontró en la base, búsquelo o créelo.`
      } else {
        setClienteExtraido(null)
      }
      if (r.completados > 0)
        toast.success(`Se completaron ${r.completados} campo(s) automáticamente. Revise antes de guardar.${aviso}${avisoExtraccion(datos)}`, {
          duration: 12000,
        })
      else toast.warning('No se pudo identificar ningún dato en el documento.')
      if (r.seriedadSinProducto) toast.warning(avisoSinSeriedad(aseguradoras.find((a) => a.id === r.form.asegId)?.nombre_aseg))
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudo importar el documento'))
    } finally {
      if (vivoRef.current) setImportando(false)
    }
  }

  // ── Atajos de teclado ─────────────────────────────────────────────────────
  const accionesRef = useRef({ guardar, guardarBorrador })
  accionesRef.current = { guardar, guardarBorrador }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return
      const k = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (k === 's' || k === 'enter')) {
        e.preventDefault()
        void accionesRef.current.guardar()
      } else if (e.altKey && !e.ctrlKey && k === 'b' && !esEdicion) {
        e.preventDefault()
        void accionesRef.current.guardarBorrador()
      } else if (e.altKey && !e.ctrlKey && k === 'i' && !esEdicion) {
        e.preventDefault()
        archivoRef.current?.click()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [esEdicion])

  // ── Salir sin guardar ─────────────────────────────────────────────────────
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      sucioRef.current &&
      !permitirSalidaRef.current &&
      currentLocation.pathname + currentLocation.search !== nextLocation.pathname + nextLocation.search,
  )
  // Al intentar salir con cambios: seguir editando, guardar como borrador
  // (solo en pólizas nuevas) o salir sin guardar.
  const seguirEditando = () => {
    if (blocker.state === 'blocked') blocker.reset()
  }
  const salirSinGuardar = () => {
    if (blocker.state === 'blocked') blocker.proceed()
  }
  const salirGuardandoBorrador = async () => {
    const ok = await guardarBorrador(true)
    if (!ok) return // el error ya se avisó; el aviso de salida sigue abierto
    if (blocker.state === 'blocked') blocker.proceed()
  }
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (sucioRef.current && !permitirSalidaRef.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [])

  // ── Cliente ───────────────────────────────────────────────────────────────
  const alGuardarCliente = async (id: number) => {
    setDlgCliente(null)
    try {
      const c = await obtenerCliente(id)
      if (c && vivoRef.current) {
        set('cliente', c)
        setClienteExtraido(null)
      }
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudo cargar el cliente'))
    }
  }

  const inicialClienteExtraido = (): PropsDialogoCliente['inicial'] => {
    if (!clienteExtraido) return undefined
    const doc = (clienteExtraido.doc ?? '').trim()
    // NIT con dígito de verificación (900123456-7): persona jurídica.
    const esNit = /^\d{6,}-\d$/.test(doc.replace(/[.\s]/g, ''))
    return {
      ...(clienteExtraido.nombre ? { nombre_cliente: clienteExtraido.nombre } : {}),
      ...(doc ? { doc_cliente: doc.replace(/[.\s]/g, '') } : {}),
      ...(esNit ? { tipopers_cliente: 'J', tipodoc_cliente: 'NIT' } : {}),
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const titulo = esEdicion ? 'Editar póliza' : 'Nueva póliza'
  if (errorCatalogo || errorCarga) {
    return (
      <div>
        <EncabezadoPagina titulo={titulo} volver="/polizas" />
        <Contenido className="max-w-[1100px]">
          <MensajeError error={errorCarga ?? mensajeAmigable(errorCatalogo, 'No se pudieron cargar los catálogos')} />
        </Contenido>
      </div>
    )
  }
  if (!form) {
    return (
      <div>
        <EncabezadoPagina titulo={titulo} volver="/polizas" />
        <Cargando texto={esEdicion ? 'Cargando póliza…' : 'Preparando el formulario…'} />
      </div>
    )
  }

  const ocupado = guardando || guardandoBorrador || importando || eliminando
  const archivoOrigen = nombreArchivo ?? pendiente?.nombre_archivo ?? null
  const subtitulo = esEdicion ? (
    <span>
      Código <b className="num">{polizaId}</b>
      {f.nro.trim() && (
        <>
          {' · '}Nro. <span className="num">{f.nro}</span>
        </>
      )}
    </span>
  ) : pendiente ? (
    <span>
      {pendiente.estado === 'borrador' ? 'Retomando un borrador' : 'Predigitada por IA (carga masiva)'}
      {archivoOrigen && <> · {archivoOrigen}</>}
    </span>
  ) : archivoOrigen ? (
    <span>Importada de {archivoOrigen}</span>
  ) : undefined

  const totalPrincipal = sumaPorcPrincipal(f)
  const totalAdicional = sumaPorcAdicional(f)
  const porId = <T extends { id: number }>(lista: T[], id: number | null) => lista.find((x) => x.id === id) ?? null

  return (
    <div className="flex min-h-full flex-col">
      <EncabezadoPagina
        titulo={titulo}
        subtitulo={subtitulo}
        volver="/polizas"
        acciones={
          <>
            {!esEdicion && (
              <>
                <input
                  ref={archivoRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const a = e.target.files?.[0]
                    e.target.value = ''
                    if (a) void importar(a)
                  }}
                />
                <Boton
                  variante="secundario"
                  tamano="sm"
                  cargando={importando}
                  disabled={ocupado}
                  onClick={() => archivoRef.current?.click()}
                  title="Leer los datos de la póliza desde un PDF o una imagen (Alt+I)"
                >
                  {!importando && <Sparkles />}
                  Importar desde PDF/imagen
                </Boton>
                <Boton
                  variante="secundario"
                  tamano="sm"
                  cargando={guardandoBorrador}
                  disabled={ocupado}
                  onClick={() => void guardarBorrador()}
                  title="Guardar lo digitado para terminarlo después, sin exigir campos (Alt+B)"
                >
                  {!guardandoBorrador && <FileText />}
                  Guardar borrador
                </Boton>
              </>
            )}
            {esEdicion && (
              <>
                <Link to={`/polizas/${polizaId}/pagos`}>
                  <Boton variante="secundario" tamano="sm" title="Estado de cuenta y abonos de la póliza">
                    <Wallet />
                    Ver pagos
                  </Boton>
                </Link>
                <Boton variante="fantasma" tamano="sm" className="text-danger hover:text-danger" cargando={eliminando} disabled={ocupado} onClick={eliminar}>
                  {!eliminando && <Trash2 />}
                  Eliminar
                </Boton>
                <DialogoEliminar
                  polizas={paraEliminar ? [paraEliminar] : []}
                  abierto={!!paraEliminar}
                  onCerrar={() => setParaEliminar(null)}
                  onHecho={alMarcarEliminada}
                />
              </>
            )}
            <Boton variante="verde" tamano="sm" cargando={guardando} disabled={ocupado} onClick={guardar} title="Guardar (Ctrl+S)">
              {!guardando && <Save />}
              Guardar
            </Boton>
          </>
        }
      />

      <Contenido className="max-w-[1100px] flex-1 space-y-4">
        {importando && (
          <Aviso tono="navy" icono={<Sparkles />}>
            Leyendo el documento con IA… puede tardar hasta un minuto. No cierre esta pantalla.
          </Aviso>
        )}
        {pendiente?.error_msg && (
          <Aviso icono={<Info />}>
            La lectura con IA de este archivo falló: <b>{pendiente.error_msg}</b>. Complete la póliza a mano.
          </Aviso>
        )}

        {/* ── Identificación y vigencia ─────────────────────────────── */}
        <SeccionTarjeta titulo="Identificación y vigencia" icono={<Hash />}>
          {/* Letra más chica (13 px) en esta sección, como en la app de escritorio. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[140px_minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] [&_input]:text-[13px]">
            {/* El código real se asigna al guardar: mostrar un "siguiente" hacía
                que dos personas digitando a la vez anotaran un código equivocado. */}
            <Campo etiqueta="Código" ayuda={esEdicion ? 'Automático' : 'Se asigna al guardar'}>
              <ValorFijo className="justify-start" destacado={esEdicion}>
                {esEdicion ? polizaId : '—'}
              </ValorFijo>
            </Campo>
            <div id="campo-nro">
              <Campo
                etiqueta="Número de póliza"
                error={errorNro}
                ayuda="Único por aseguradora. Los espacios se cambian por guiones."
              >
                <Input
                  className="num"
                  value={f.nro}
                  autoFocus={!esEdicion}
                  onChange={(e) => set('nro', e.target.value)}
                  onBlur={() => {
                    const g = formatearNroPoliza(f.nro)
                    if (g !== f.nro) set('nro', g)
                  }}
                  aria-invalid={!!errorNro}
                />
              </Campo>
            </div>
            <div id="campo-fIni">
              <Campo etiqueta="F. inicio" ayuda="La fecha fin se calcula sola (+1 año)">
                <InputFecha valor={f.fIni} onCambio={(d) => upd((x) => sugerirFin({ ...x, fIni: d }, d))} />
              </Campo>
            </div>
            <div id="campo-fFin">
              <Campo
                etiqueta="F. fin"
                obligatorio
                error={errorDe('fFin')}
                ayuda={f.finAutomatica && f.fFin ? 'Calculada: inicio + 1 año' : undefined}
              >
                <InputFecha
                  valor={f.fFin}
                  error={!!errorDe('fFin')}
                  onCambio={(d) => upd((x) => ({ ...x, fFin: d, finAutomatica: false }))}
                />
              </Campo>
            </div>
            <div id="campo-fExp">
              <Campo etiqueta="F. expedición">
                <InputFecha valor={f.fExp} onCambio={(d) => set('fExp', d)} />
              </Campo>
            </div>
          </div>
        </SeccionTarjeta>

        {/* ── Aseguradora y producto ────────────────────────────────── */}
        <SeccionTarjeta titulo="Aseguradora, ramo y producto" icono={<Building2 />}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,3fr)_minmax(0,3fr)_130px]">
            <div id="campo-aseg">
              <Campo etiqueta="Aseguradora" obligatorio error={errorDe('aseg')}>
                <Buscador<Aseguradora>
                  valor={aseguradora}
                  onCambio={(a) => upd((x) => cambiarAseguradora(x, a?.id ?? null, listas.ramosBase, productosActivos))}
                  opciones={listas.aseguradoras}
                  etiqueta={(a) => a.nombre_aseg}
                  clave={(a) => a.id}
                  inactivo={(a) => !a.estado_aseg}
                  placeholder="Seleccione la aseguradora…"
                  error={!!errorDe('aseg')}
                />
              </Campo>
            </div>
            <div id="campo-ramo">
              <Campo etiqueta="Ramo" obligatorio error={errorDe('ramo')}>
                <Buscador<Ramo>
                  valor={ramo}
                  onCambio={(r) =>
                    upd((x) => (r ? aplicarDefaultsRamo({ ...x, ramoId: r.id, productoId: null }) : { ...x, ramoId: null, productoId: null }))
                  }
                  opciones={listas.ramos}
                  etiqueta={(r) => r.nombre_ramo}
                  clave={(r) => r.id}
                  inactivo={(r) => !r.estado_ramo}
                  placeholder="Seleccione el ramo…"
                  error={!!errorDe('ramo')}
                />
              </Campo>
            </div>
            <Campo etiqueta="% Base com." className="col-span-full lg:col-span-1">
              <ValorFijo>{ramo?.porcom_base_ramo != null ? `${fmtNum(ramo.porcom_base_ramo, 2)}%` : '—'}</ValorFijo>
            </Campo>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,3fr)_minmax(0,3fr)_minmax(0,2fr)]">
            <div id="campo-producto">
              <Campo
                etiqueta="Producto"
                obligatorio
                error={errorDe('producto')}
                ayuda={
                  f.ramoId == null || f.asegId == null
                    ? 'Seleccione primero la aseguradora y el ramo'
                    : listas.productos.length === 0
                      ? 'Esta aseguradora no tiene productos activos en este ramo'
                      : undefined
                }
              >
                <Buscador<Producto>
                  valor={producto}
                  onCambio={(p) => upd((x) => (p ? aplicarDefaultsProducto({ ...x, productoId: p.id }, p) : { ...x, productoId: null }))}
                  opciones={listas.productos}
                  etiqueta={(p) => p.nombre_prod}
                  clave={(p) => p.id}
                  inactivo={(p) => !p.estado_prod}
                  disabled={f.ramoId == null || f.asegId == null}
                  placeholder="Seleccione el producto…"
                  error={!!errorDe('producto')}
                />
              </Campo>
            </div>
            <div id="campo-formaPago">
              <Campo etiqueta="Forma de pago" obligatorio error={errorDe('formaPago')}>
                <Buscador<FormaPago>
                  valor={porId(listas.formasPago, f.formaPagoId)}
                  onCambio={(x) => set('formaPagoId', x?.id ?? null)}
                  opciones={listas.formasPago}
                  etiqueta={(x) => x.nombre_forma_pago}
                  clave={(x) => x.id}
                  inactivo={(x) => x.estado_forma_pago === false}
                  error={!!errorDe('formaPago')}
                />
              </Campo>
            </div>
            <Campo etiqueta="Forma de expedición">
              <Buscador<FormaExpedicion>
                valor={porId(listas.formasExp, f.formaExpId)}
                onCambio={(x) => set('formaExpId', x?.id ?? null)}
                opciones={listas.formasExp}
                etiqueta={(x) => x.nombre_formaexp}
                clave={(x) => x.id}
              />
            </Campo>
          </div>
        </SeccionTarjeta>

        {/* ── Cliente ───────────────────────────────────────────────── */}
        <SeccionTarjeta titulo="Cliente y bien asegurado" icono={<UserRound />}>
          <div id="campo-cliente" className="flex items-end gap-2">
            <Campo etiqueta="Cliente" obligatorio error={errorDe('cliente')} className="flex-1">
              <Buscador<ClienteSel>
                valor={f.cliente}
                onCambio={(c) => set('cliente', c)}
                buscar={(t) => buscarClientes(t, 50)}
                etiqueta={(c) => c.nombre_cliente}
                detalle={(c) => [c.tipodoc_cliente, fmtDoc(c.doc_cliente)].filter(Boolean).join(' ') || 'Sin documento'}
                clave={(c) => c.id}
                placeholder="Busque por nombre, documento, teléfono o correo…"
                error={!!errorDe('cliente')}
              />
            </Campo>
            <div className={errorDe('cliente') ? 'mb-[22px] flex gap-2' : 'flex gap-2'}>
              {f.cliente && (
                <Boton variante="secundario" tamano="icono" className="h-10 w-10" title="Editar los datos de este cliente" onClick={() => setDlgCliente({ clienteId: f.cliente!.id })}>
                  <Pencil />
                </Boton>
              )}
              <Boton variante="secundario" className="h-10" title="Crear un cliente nuevo" onClick={() => setDlgCliente({ clienteId: null, inicial: inicialClienteExtraido() })}>
                <UserPlus />
                <span className="hidden sm:inline">Nuevo</span>
              </Boton>
            </div>
          </div>
          {/* Vista previa para cotejar contra la póliza física: NIT o documento
              y nombre / razón social del cliente elegido. */}
          {f.cliente && (
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-navy/15 bg-navy-soft/40 px-3 py-2.5 text-[13px]">
              <span>
                <b className="font-semibold">{rotulosCliente(f.cliente).documento}:</b>{' '}
                {f.cliente.doc_cliente ? (
                  <span className="num">{fmtDoc(f.cliente.doc_cliente)}</span>
                ) : (
                  <span className="text-danger">sin documento registrado</span>
                )}
              </span>
              <span className="min-w-0">
                <b className="font-semibold">{rotulosCliente(f.cliente).nombre}:</b> {f.cliente.nombre_cliente}
              </span>
              <span className="text-ink-soft">
                Cliente <span className="num">#{f.cliente.id}</span>
              </span>
            </div>
          )}
          {clienteExtraido && !f.cliente && (
            <Aviso className="mt-3" icono={<Info />}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1">
                  {clienteExtraido.garantia ? (
                    <>
                      El cliente de una póliza de cumplimiento o seriedad es el tomador (afianzado o garantizado), y se busca solo por su NIT.
                      No existe en la base el cliente con NIT <span className="num">{clienteExtraido.doc ?? '—'}</span> (
                      <b>{clienteExtraido.nombre ?? '—'}</b>): selecciónelo arriba o créelo antes de guardar.
                    </>
                  ) : (
                    <>
                      El documento trae el cliente <b>{clienteExtraido.nombre ?? '—'}</b>
                      {clienteExtraido.doc && (
                        <>
                          {' '}(doc. <span className="num">{clienteExtraido.doc}</span>)
                        </>
                      )}
                      , pero no se encontró en la base. Búsquelo arriba o créelo.
                    </>
                  )}
                </span>
                <Boton tamano="sm" variante="secundario" onClick={() => setDlgCliente({ clienteId: null, inicial: inicialClienteExtraido() })}>
                  <UserPlus />
                  Crear con estos datos
                </Boton>
              </div>
            </Aviso>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div id="campo-bien" className="sm:col-span-2 lg:col-span-1">
              <Campo etiqueta="Bien asegurado / identificación" obligatorio error={errorDe('bien')}>
                <Input value={f.bien} onChange={(e) => set('bien', e.target.value)} aria-invalid={!!errorDe('bien')} className={errorDe('bien') ? 'border-danger' : undefined} />
              </Campo>
            </div>
            <Campo etiqueta="Vlr. asegurado">
              <InputNumero valor={f.vlrAseg} onCambio={(v) => set('vlrAseg', v)} prefijo="$" />
            </Campo>
            <Campo etiqueta="Intermediario">
              <Buscador<Intermediario>
                valor={porId(listas.intermediarios, f.intermediarioId)}
                onCambio={(x) => set('intermediarioId', x?.id ?? null)}
                opciones={listas.intermediarios}
                etiqueta={(x) => x.nombre_interm}
                clave={(x) => x.id}
                inactivo={(x) => x.estado_interm === false}
              />
            </Campo>
          </div>
        </SeccionTarjeta>

        {/* ── Valores ───────────────────────────────────────────────── */}
        <SeccionTarjeta titulo="Valores" icono={<Landmark />}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo etiqueta="Vlr. prima" ayuda="Ej.: 1.500.000,00">
              <InputNumero valor={f.prima} onCambio={(v) => upd((x) => conPrima(x, v))} prefijo="$" />
            </Campo>
            <Campo etiqueta="Vlr. total">
              <InputNumero valor={f.valorPoliza} onCambio={(v) => set('valorPoliza', v)} prefijo="$" />
            </Campo>
            <Campo etiqueta="Vlr. base com." ayuda="Automático (la prima), editable">
              <InputNumero valor={f.vlrBaseCom} onCambio={(v) => upd((x) => recalcularComision({ ...x, vlrBaseCom: v }))} prefijo="$" />
            </Campo>
          </div>
        </SeccionTarjeta>

        {/* ── Comisiones ────────────────────────────────────────────── */}
        <SeccionTarjeta titulo="Comisiones" icono={<Wallet />}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Campo etiqueta="% Com." ayuda="Desde el producto">
              <InputNumero
                valor={f.porcCom}
                onCambio={(v) => upd((x) => recalcularComision({ ...x, porcCom: v }))}
                maxDecimales={DECIMALES_PORC}
                sufijo="%"
              />
            </Campo>
            <Campo etiqueta="Vlr. com." ayuda="Automático, editable">
              <InputNumero valor={f.vlrCom} onCambio={(v) => upd((x) => sugerirComDistrib({ ...x, vlrCom: v }))} prefijo="$" />
            </Campo>
            <Campo etiqueta="+ Com. fija">
              <InputNumero valor={f.vlrComFija} onCambio={(v) => upd((x) => sugerirComDistrib({ ...x, vlrComFija: v }))} prefijo="$" />
            </Campo>
            <Campo etiqueta="% Com. adicional">
              <InputNumero valor={f.porcomAdic} onCambio={(v) => set('porcomAdic', v)} maxDecimales={DECIMALES_PORC} sufijo="%" />
            </Campo>
            <Campo etiqueta="Vlr. com. adicional">
              <InputNumero valor={f.vlrComAdic} onCambio={(v) => upd((x) => ({ ...x, vlrComAdic: v, comAdicDistrib: v }))} prefijo="$" />
            </Campo>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div id="campo-comDistrib">
              <Campo etiqueta="Com. a distribuir" error={errorDe('comDistrib')} ayuda="Base para repartir entre asesores (máx. Vlr. com. + Com. fija)">
                <InputNumero valor={f.comDistrib} onCambio={(v) => set('comDistrib', v)} prefijo="$" />
              </Campo>
            </div>
            <Campo etiqueta="Com. adic. a distribuir" ayuda="Base para repartir la comisión adicional">
              <InputNumero valor={f.comAdicDistrib} onCambio={(v) => set('comAdicDistrib', v)} prefijo="$" />
            </Campo>
          </div>
        </SeccionTarjeta>

        {/* ── Distribución ──────────────────────────────────────────── */}
        <SeccionTarjeta titulo="Distribución de comisiones" icono={<PieChart />}>
          <div className="space-y-3">
            <FilaAsesor
              id="campo-asesor1"
              etiqueta="Asesor 1"
              obligatorio
              error={errorDe('asesor1')}
              asesores={listas.asesores}
              asesorId={f.asesor1Id}
              onAsesor={(v) => set('asesor1Id', v)}
              porc={f.porcAsesor1}
              onPorc={(v) => set('porcAsesor1', v)}
              base={f.comDistrib}
            />
            <FilaAsesor id="campo-asesor2" etiqueta="Asesor 2" asesores={listas.asesores} asesorId={f.asesor2Id} onAsesor={(v) => set('asesor2Id', v)} porc={f.porcAsesor2} onPorc={(v) => set('porcAsesor2', v)} base={f.comDistrib} />
            <FilaAsesor id="campo-asesor3" etiqueta="Asesor 3" asesores={listas.asesores} asesorId={f.asesor3Id} onAsesor={(v) => set('asesor3Id', v)} porc={f.porcAsesor3} onPorc={(v) => set('porcAsesor3', v)} base={f.comDistrib} />
            <FilaAsesor id="campo-agencia" etiqueta="Agencia" asesores={listas.asesores} asesorId={f.agenciaId} onAsesor={(v) => set('agenciaId', v)} porc={f.porcAgencia} onPorc={(v) => set('porcAgencia', v)} base={f.comDistrib} />
            <TotalPorcentaje id="campo-porcPrincipal" titulo="Total" total={totalPrincipal} />
          </div>
          <hr className="my-4 border-line" />
          <div className="space-y-3">
            <FilaAsesor id="campo-asesorAd" etiqueta="Asesor adicional" asesores={listas.asesores} asesorId={f.asesorAdId} onAsesor={(v) => set('asesorAdId', v)} porc={f.porcAsesorAd} onPorc={(v) => set('porcAsesorAd', v)} base={f.comAdicDistrib} />
            <FilaAsesor id="campo-agenciaAd" etiqueta="Agencia adicional" asesores={listas.asesores} asesorId={f.agenciaAdId} onAsesor={(v) => set('agenciaAdId', v)} porc={f.porcAgenciaAd} onPorc={(v) => set('porcAgenciaAd', v)} base={f.comAdicDistrib} />
            {totalAdicional !== 0 && <TotalPorcentaje id="campo-porcAdicional" titulo="Total adicional" total={totalAdicional} />}
          </div>
        </SeccionTarjeta>

        {/* ── Estado y prima pagada ─────────────────────────────────── */}
        <SeccionTarjeta titulo="Estado y prima pagada" icono={<FilePen />}>
          <div className="grid items-start gap-4 sm:grid-cols-[1fr_220px]">
            <div>
              <div className="mb-1 text-[12px] font-semibold text-ink-soft">Estado de la póliza</div>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Estado de la póliza">
                {listas.estados.map((e) => (
                  <Chip key={e.id} activo={f.estadoId === e.id} onClick={() => set('estadoId', e.id)}>
                    {e.nombre_estado}
                  </Chip>
                ))}
              </div>
              {esEdicion && original && f.estadoId === original.estadoId && (
                <p className="mt-2 text-[12px] text-ink-soft">
                  Si no lo cambia, se conserva el que tenga la póliza al guardar (los pagos lo pueden actualizar).
                </p>
              )}
            </div>
            <Campo
              etiqueta="Vlr. prima pagada"
              ayuda={esEdicion ? 'Incluye los abonos registrados. Solo se guarda si usted lo cambia.' : undefined}
            >
              <InputNumero valor={f.primaPagada} onCambio={(v) => set('primaPagada', v)} prefijo="$" />
            </Campo>
          </div>
        </SeccionTarjeta>

        {/* ── Observaciones ─────────────────────────────────────────── */}
        <SeccionTarjeta titulo="Observaciones" icono={<StickyNote />}>
          <AreaTexto rows={4} value={f.obs} onChange={(e) => set('obs', e.target.value)} placeholder="Observación" aria-label="Observación" />
        </SeccionTarjeta>
      </Contenido>

      {/* Barra fija con el botón de guardar */}
      <div className="sticky bottom-0 z-10 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <p className="hidden flex-1 text-[12px] text-ink-soft md:block">
            Atajos: <Tecla>Ctrl+S</Tecla> guardar
            {!esEdicion && (
              <>
                {' · '}<Tecla>Alt+B</Tecla> borrador · <Tecla>Alt+I</Tecla> importar
              </>
            )}
          </p>
          {intento && errores.length > 0 && (
            <button type="button" className="text-[13px] font-semibold text-danger underline-offset-2 hover:underline" onClick={() => irACampo(errores[0].campo)}>
              {errores.length === 1 ? '1 campo por revisar' : `${errores.length} campos por revisar`}
            </button>
          )}
          <Boton variante="verde" cargando={guardando} disabled={ocupado} onClick={guardar} className="ml-auto">
            {!guardando && <Save />}
            {guardando ? 'Guardando…' : 'Guardar póliza'}
          </Boton>
        </div>
      </div>

      <Dialogo
        abierto={blocker.state === 'blocked'}
        onCerrar={seguirEditando}
        titulo="Hay cambios sin guardar"
        ancho="sm"
        pie={
          <>
            <Boton variante="secundario" onClick={seguirEditando} disabled={guardandoBorrador}>
              Seguir editando
            </Boton>
            {!esEdicion && (
              <Boton variante="secundario" onClick={() => void salirGuardandoBorrador()} cargando={guardandoBorrador}>
                Guardar como borrador
              </Boton>
            )}
            <Boton variante="peligro" onClick={salirSinGuardar} disabled={guardandoBorrador}>
              Salir sin guardar
            </Boton>
          </>
        }
      >
        <p className="text-ink-soft">
          {esEdicion
            ? 'Si sale ahora, perderá los cambios hechos en esta póliza.'
            : 'Si sale ahora, perderá lo digitado. Puede guardarlo como borrador y retomarlo después desde Pólizas pendientes.'}
        </p>
      </Dialogo>
      <DialogoCliente
        abierto={!!dlgCliente}
        clienteId={dlgCliente?.clienteId ?? null}
        inicial={dlgCliente?.inicial}
        onCerrar={() => setDlgCliente(null)}
        onGuardado={alGuardarCliente}
      />
      <DialogoGuardada
        datos={guardada}
        onListo={() => {
          setGuardada(null)
          volver()
        }}
      />
    </div>
  )
}

function Tecla({ children }: { children: ReactNode }) {
  return <kbd className="num rounded border border-line bg-muted px-1 py-px text-[11px]">{children}</kbd>
}
