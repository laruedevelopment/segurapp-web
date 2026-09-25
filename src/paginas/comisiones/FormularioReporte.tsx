import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Calculator,
  DollarSign,
  FileText,
  ListChecks,
  Loader2,
  Pencil,
  Percent,
  Plus,
  ReceiptText,
  Save,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Aviso, Cargando, Cifra, MensajeError, SeccionTarjeta, Vacio } from '@/components/ui/basicos'
import { Buscador } from '@/components/ui/buscador'
import { Boton } from '@/components/ui/button'
import { AreaTexto, Campo, InputNumero, SelectorSimple } from '@/components/ui/campos'
import { useConfirmar } from '@/components/ui/dialogo'
import { InputFecha } from '@/components/ui/fecha'
import { buscarIntermediarioAprendido, registrarAprendizajeIntermediario, useCatalogo } from '@/datos/catalogos'
import { extraerReportePago } from '@/datos/ia'
import {
  ESTADOS_PAGO,
  actualizarReporte,
  crearReporte,
  eliminarAbono,
  listarAbonosDeReporte,
  obtenerReporte,
  type AbonoPoliza,
  type DatosReporte,
  type ReportePago,
} from '@/datos/pagos'
import { aFecha, aISO, hoy } from '@/lib/fechas'
import { fmtDinero, fmtDoc, fmtNum, fmtPct, sumarDinero } from '@/lib/numeros'
import type { Aseguradora, Intermediario } from '@/lib/tipos'
import { mensajeError } from '@/lib/utils'
import {
  CLAVE_REPORTES,
  a2Decimales,
  coincidirPorNombre,
  fechaIA,
  normalizarTextoCabecera,
  numIA,
  trasCambiarAbonos,
} from './comun'
import { DialogoAbono } from './DialogoAbono'
import { EstadoPago } from './EstadoPago'
import { DialogoRevision } from './Revision'

const OPCIONES_ESTADO = Object.entries(ESTADOS_PAGO).map(([valor, etiqueta]) => ({ valor, etiqueta }))
const EXTENSIONES = ['pdf', 'xlsx', 'jpg', 'jpeg', 'png', 'webp']

/** Líneas importadas antes de guardar un reporte nuevo (viajan en el estado de la navegación). */
interface EstadoNavegacion {
  lineasPendientes?: Record<string, unknown>[]
  aseguradoraId?: number | null
}

export default function FormularioReporte() {
  const { id: idParam } = useParams()
  const id = idParam ? Number(idParam) : null

  const reporte = useQuery({
    queryKey: [...CLAVE_REPORTES, 'uno', id],
    queryFn: () => obtenerReporte(id!),
    enabled: id != null && Number.isFinite(id),
  })

  if (id != null && !Number.isFinite(id)) return <NoEncontrado />
  if (id == null) return <Editor key="nuevo" reporte={null} />
  if (reporte.isPending) return <Cargando texto="Cargando reporte…" />
  if (reporte.isError) {
    return (
      <Contenido>
        <MensajeError
          error={
            <div className="flex items-center gap-3">
              <span className="flex-1">No se pudo cargar el reporte: {mensajeError(reporte.error)}</span>
              <Boton tamano="sm" variante="secundario" onClick={() => reporte.refetch()}>
                Reintentar
              </Boton>
            </div>
          }
        />
      </Contenido>
    )
  }
  if (!reporte.data) return <NoEncontrado />
  // La llave hace que al pasar de "nuevo" al reporte creado el formulario arranque de cero.
  return <Editor key={id} reporte={reporte.data} />
}

function NoEncontrado() {
  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina titulo="Reporte de comisiones" volver="/comisiones" />
      <Contenido>
        <Vacio icono={<ReceiptText />} titulo="El reporte no existe" detalle="Pudo haber sido eliminado." />
      </Contenido>
    </div>
  )
}

function Editor({ reporte }: { reporte: ReportePago | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const confirmar = useConfirmar()
  const esNuevo = reporte == null
  const idReporte = reporte?.id ?? null

  const aseguradoras = useCatalogo('aseguradoras')
  const intermediarios = useCatalogo('intermediarios')

  const [fechaRep, setFechaRep] = useState<Date | null>(() => (reporte ? aFecha(reporte.fecha_rep) : hoy()))
  const [finiRep, setFiniRep] = useState<Date | null>(() => aFecha(reporte?.fini_rep))
  const [ffinRep, setFfinRep] = useState<Date | null>(() => aFecha(reporte?.ffin_rep))
  const [estadoRep, setEstadoRep] = useState<string>(reporte?.estado_rep ?? 'I')
  const [asegId, setAsegId] = useState<number | null>(reporte?.aseg_id ?? null)
  const [intermId, setIntermId] = useState<number | null>(reporte?.interm_id ?? null)
  const [vlrPrima, setVlrPrima] = useState<number | null>(reporte ? reporte.vlrprima_rep ?? 0 : null)
  const [vlrCom, setVlrCom] = useState<number | null>(reporte ? reporte.vlrcom_rep ?? 0 : null)
  const [obs, setObs] = useState(reporte?.obs_rep ?? '')
  const [intentoGuardar, setIntentoGuardar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [lineasPendientes, setLineasPendientes] = useState<Record<string, unknown>[]>([])
  const [revision, setRevision] = useState<{ lineas: Record<string, unknown>[]; aseguradoraId: number | null } | null>(null)
  const [dialogoAbono, setDialogoAbono] = useState<{ abono: AbonoPoliza | null } | null>(null)
  const archivoRef = useRef<HTMLInputElement>(null)

  // Aprendizaje de correcciones de la IA para el intermediario
  // (ia_aprendizaje_intermediario_reporte): el texto de la cabecera casi
  // nunca coincide en forma con el nombre guardado. Si se termina eligiendo
  // un intermediario distinto al sugerido (o uno cuando no se sugirió
  // ninguno) para este texto y aseguradora, se guarda la corrección.
  const aprendizaje = useRef<{ texto: string | null; sugerido: number | null; asegId: number | null }>({
    texto: null,
    sugerido: null,
    asegId: null,
  })

  const abonos = useQuery({
    queryKey: [...CLAVE_REPORTES, 'uno', idReporte, 'abonos'],
    queryFn: () => listarAbonosDeReporte(idReporte!),
    enabled: idReporte != null,
  })

  // Reporte recién creado desde una importación: se revisan de una las líneas.
  useEffect(() => {
    const estado = location.state as EstadoNavegacion | null
    if (idReporte != null && estado?.lineasPendientes?.length) {
      setRevision({ lineas: estado.lineasPendientes, aseguradoraId: estado.aseguradoraId ?? null })
      // Se consume una sola vez (recargar la página no debe volver a abrirla).
      navigate(location.pathname, { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const listaAseg = aseguradoras.data ?? []
  const listaInterm = intermediarios.data ?? []
  const aseguradora = listaAseg.find((a) => a.id === asegId) ?? null
  const intermediario = listaInterm.find((i) => i.id === intermId) ?? null
  const errorAseg = intentoGuardar && asegId == null ? 'Requerido' : null
  const errorFecha = intentoGuardar && !fechaRep ? 'Requerido' : null

  // ── Guardar ───────────────────────────────────────────────────────────────
  const guardar = async () => {
    if (guardando) return
    setIntentoGuardar(true)
    if (asegId == null || !fechaRep) return
    setGuardando(true)
    try {
      // Los totales calculados (suma de abonos) no se mandan: los calcula la
      // vista desde los abonos, así no quedan desfasados ni pisan lo que
      // agregó otro usuario.
      const datos: DatosReporte = {
        fecha_rep: aISO(fechaRep)!,
        aseg_id: asegId,
        interm_id: intermId,
        fini_rep: aISO(finiRep),
        ffin_rep: aISO(ffinRep),
        vlrprima_rep: vlrPrima ?? 0,
        vlrcom_rep: vlrCom ?? 0,
        estado_rep: estadoRep,
        obs_rep: obs.trim() || null,
      }
      const idGuardado = esNuevo ? await crearReporte(datos) : idReporte!
      if (!esNuevo) await actualizarReporte(idGuardado, datos)

      // Aprendizaje, solo con el reporte ya guardado (si se registrara antes
      // y el guardado fallara, al reintentar contaría doble).
      const ap = aprendizaje.current
      if (ap.texto != null && ap.asegId != null && intermId != null && intermId !== ap.sugerido && asegId === ap.asegId) {
        const texto = ap.texto
        ap.texto = null
        registrarAprendizajeIntermediario(ap.asegId, texto, intermId).catch(() => {})
      }

      await qc.invalidateQueries({ queryKey: CLAVE_REPORTES })
      if (esNuevo) {
        // Si se había importado un documento antes de guardar, las líneas
        // quedaron esperando el id real: se revisan en el reporte creado.
        const estado: EstadoNavegacion | null = lineasPendientes.length
          ? { lineasPendientes, aseguradoraId: asegId }
          : null
        toast.success(`Reporte #${idGuardado} creado`)
        navigate(`/comisiones/${idGuardado}`, { replace: true, state: estado })
      } else {
        toast.success('Reporte actualizado')
        navigate('/comisiones')
      }
    } catch (e) {
      toast.error(`Error: ${mensajeError(e)}`)
    } finally {
      setGuardando(false)
    }
  }

  // ── Importar con IA ───────────────────────────────────────────────────────
  const importar = async (archivo: File) => {
    const ext = archivo.name.split('.').pop()?.toLowerCase() ?? ''
    if (!EXTENSIONES.includes(ext)) {
      toast.error('No se pudo leer el archivo. Use PDF, XLSX, JPG, PNG o WEBP.')
      return
    }
    setImportando(true)
    try {
      const extraido = await extraerReportePago(archivo)
      const cab = extraido.cabecera

      // Cabecera: solo se aplica lo que efectivamente se reconoció.
      const nombreAseg = typeof cab.nombre_aseguradora === 'string' ? cab.nombre_aseguradora : null
      const matchAseg = coincidirPorNombre<Aseguradora>(listaAseg, (a) => a.nombre_aseg, nombreAseg)
      const asegParaAprendizaje = matchAseg ?? aseguradora
      const dRep = fechaIA(cab.fecha_reporte)
      const dIni = fechaIA(cab.fecha_inicio_periodo)
      const dFin = fechaIA(cab.fecha_fin_periodo)
      const vComTotal = numIA(cab.vlr_comision_total)
      // Prima total: si el documento no trae una fila de total general, se
      // suma lo que sí se extrajo de las líneas (mejor una suma real que
      // dejarlo en blanco).
      const vPrimaTotal =
        numIA(cab.vlr_prima_total) ??
        sumarDinero(extraido.lineas.map((l) => numIA(l.vlrprima_poliza ?? l.vlrabono_prima) ?? 0))

      // Intermediario: primero lo aprendido de correcciones anteriores para
      // esta aseguradora; si no hay, la coincidencia por nombre.
      const textoInterm = typeof cab.nombre_intermediario === 'string' ? cab.nombre_intermediario : null
      const textoIntermNorm = textoInterm ? normalizarTextoCabecera(textoInterm) : ''
      let matchInterm: Intermediario | null = null
      if (textoIntermNorm && asegParaAprendizaje) {
        try {
          const idAprendido = await buscarIntermediarioAprendido(asegParaAprendizaje.id, textoIntermNorm)
          if (idAprendido != null) matchInterm = listaInterm.find((i) => i.id === idAprendido) ?? null
        } catch {
          /* sin aprendizaje: se usa la coincidencia por nombre */
        }
      }
      matchInterm ??= coincidirPorNombre<Intermediario>(listaInterm, (i) => i.nombre_interm, textoInterm)
      if (textoIntermNorm && asegParaAprendizaje) {
        aprendizaje.current = { texto: textoIntermNorm, sugerido: matchInterm?.id ?? null, asegId: asegParaAprendizaje.id }
      }

      if (matchAseg) setAsegId(matchAseg.id)
      if (matchInterm) setIntermId(matchInterm.id)
      if (dRep) setFechaRep(dRep)
      if (dIni) setFiniRep(dIni)
      if (dFin) setFfinRep(dFin)
      if (vPrimaTotal > 0) setVlrPrima(a2Decimales(vPrimaTotal))
      if (vComTotal != null) setVlrCom(a2Decimales(vComTotal))

      if (extraido.lineas.length === 0) {
        toast.info('Se completó la cabecera. No se encontraron líneas de pólizas en el documento.')
        return
      }
      const asegFinal = matchAseg?.id ?? asegId
      if (idReporte != null) {
        // El reporte ya existe: se revisan las líneas de una.
        setRevision({ lineas: extraido.lineas, aseguradoraId: asegFinal })
      } else {
        // Reporte nuevo, todavía sin id: las líneas esperan a que se guarde.
        setLineasPendientes(extraido.lineas)
        toast.info(
          `Se completó la cabecera y se detectaron ${extraido.lineas.length} línea(s). Guarde el reporte para revisarlas y crear los abonos.`,
        )
      }
    } catch (e) {
      toast.error(`Error al importar: ${mensajeError(e)}`)
    } finally {
      setImportando(false)
    }
  }

  // ── Abonos ────────────────────────────────────────────────────────────────
  const abrirAbono = (abono: AbonoPoliza | null) => {
    if (idReporte == null) {
      toast.error('Guarde primero el reporte y luego añada pólizas')
      return
    }
    setDialogoAbono({ abono })
  }

  const eliminarUnAbono = async (a: AbonoPoliza) => {
    const ok = await confirmar({
      titulo: 'Eliminar abono',
      mensaje: `¿Eliminar el abono de ${a.nombre_cliente ?? `Póliza ${a.id_poliza}`}?`,
      confirmar: 'Eliminar',
      peligro: true,
    })
    if (!ok) return
    try {
      await eliminarAbono(a.id)
      await trasCambiarAbonos(qc, [a.id_poliza])
    } catch (e) {
      toast.error(`Error: ${mensajeError(e)}`)
    }
  }

  const titulo = esNuevo ? 'Nuevo reporte' : `Reporte #${idReporte}`

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo={titulo}
        subtitulo={reporte?.nombre_aseg ?? undefined}
        volver="/comisiones"
        acciones={
          <>
            <input
              ref={archivoRef}
              type="file"
              className="hidden"
              accept=".pdf,.xlsx,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) importar(f)
              }}
            />
            <Boton
              variante="secundario"
              tamano="sm"
              onClick={() => archivoRef.current?.click()}
              disabled={importando || aseguradoras.isPending || intermediarios.isPending}
              title="Lee el reporte con IA: llena la cabecera y propone los abonos"
            >
              {importando ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {importando ? 'Leyendo documento…' : 'Importar desde PDF/imagen'}
            </Boton>
            {!esNuevo && (
              <Link to={`/comisiones/${idReporte}/estado-cuenta`}>
                <Boton variante="secundario" tamano="sm" title="Estado de cuenta del reporte">
                  <Wallet />
                  Estado de cuenta
                </Boton>
              </Link>
            )}
            <Boton variante="verde" tamano="sm" onClick={guardar} cargando={guardando}>
              {!guardando && <Save />}
              Guardar
            </Boton>
          </>
        }
      />
      <Contenido className="flex flex-col gap-4">
        {lineasPendientes.length > 0 && esNuevo && (
          <Aviso tono="navy" icono={<Sparkles />}>
            Se detectaron {lineasPendientes.length} línea(s) en el documento. Guarde el reporte para revisarlas y crear
            los abonos.
          </Aviso>
        )}

        {/* 1. Cabecera */}
        <SeccionTarjeta titulo="Datos del reporte" icono={<FileText />}>
          {aseguradoras.isError || intermediarios.isError ? (
            <MensajeError className="mb-3" error="No se pudieron cargar las aseguradoras o los intermediarios." />
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Fecha del reporte" obligatorio error={errorFecha}>
              <InputFecha valor={fechaRep} onCambio={setFechaRep} error={!!errorFecha} />
            </Campo>
            <Campo etiqueta="Estado">
              <SelectorSimple valor={estadoRep} onCambio={(v) => setEstadoRep(v ?? 'I')} opciones={OPCIONES_ESTADO} />
            </Campo>
            <Campo etiqueta="Aseguradora" obligatorio error={errorAseg}>
              <Buscador<Aseguradora>
                valor={aseguradora}
                onCambio={(a) => setAsegId(a?.id ?? null)}
                opciones={listaAseg}
                etiqueta={(a) => a.nombre_aseg}
                clave={(a) => a.id}
                inactivo={(a) => !a.estado_aseg}
                placeholder={aseguradoras.isPending ? 'Cargando…' : 'Seleccione…'}
                error={!!errorAseg}
              />
            </Campo>
            <Campo etiqueta="Intermediario">
              <Buscador<Intermediario>
                valor={intermediario}
                onCambio={(i) => setIntermId(i?.id ?? null)}
                opciones={listaInterm}
                etiqueta={(i) => i.nombre_interm}
                clave={(i) => i.id}
                inactivo={(i) => !i.estado_interm}
                placeholder={intermediarios.isPending ? 'Cargando…' : 'Seleccione…'}
              />
            </Campo>
            <Campo etiqueta="Inicio del período">
              <InputFecha valor={finiRep} onCambio={setFiniRep} />
            </Campo>
            <Campo etiqueta="Fin del período">
              <InputFecha valor={ffinRep} onCambio={setFfinRep} />
            </Campo>
            <Campo etiqueta="Vlr. prima (según el documento)">
              <InputNumero valor={vlrPrima} onCambio={setVlrPrima} prefijo="$" />
            </Campo>
            <Campo etiqueta="Vlr. comisión (según el documento)">
              <InputNumero valor={vlrCom} onCambio={setVlrCom} prefijo="$" />
            </Campo>
            <Campo etiqueta="Observaciones" className="sm:col-span-2">
              <AreaTexto rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
            </Campo>
          </div>
        </SeccionTarjeta>

        {!esNuevo && reporte && (
          <>
            {/* 2. Resumen calculado por la base */}
            <SeccionTarjeta titulo="Resumen calculado" icono={<Calculator />}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Cifra titulo="Prima total (calculada)" icono={<DollarSign />} valor={fmtDinero(reporte.vlrsumprima_rep ?? 0)} />
                <Cifra titulo="Comisión total (calculada)" icono={<Percent />} valor={fmtDinero(reporte.vlrsumcom_rep ?? 0)} />
                <Cifra
                  titulo="Pólizas en el reporte"
                  icono={<ReceiptText />}
                  valor={fmtNum(abonos.data?.length ?? reporte.num_abonos ?? 0)}
                />
              </div>
              <p className="mt-2 text-[12px] text-ink-soft">No incluye los abonos anulados.</p>
            </SeccionTarjeta>

            {/* 3. Abonos */}
            <SeccionTarjeta
              titulo="Pólizas en este reporte"
              icono={<ListChecks />}
              acciones={
                <Boton tamano="sm" onClick={() => abrirAbono(null)}>
                  <Plus />
                  Añadir póliza
                </Boton>
              }
            >
              {abonos.isPending ? (
                <Cargando className="py-8" texto="Cargando abonos…" />
              ) : abonos.isError ? (
                <MensajeError error={`No se pudieron cargar los abonos: ${mensajeError(abonos.error)}`} />
              ) : abonos.data.length === 0 ? (
                <Vacio titulo="Sin pólizas en este reporte" detalle='Presione "Añadir póliza" para comenzar o importe el documento.' />
              ) : (
                <TablaAbonos abonos={abonos.data} onEditar={(a) => abrirAbono(a)} onEliminar={eliminarUnAbono} />
              )}
            </SeccionTarjeta>
          </>
        )}
      </Contenido>

      {idReporte != null && (
        <DialogoAbono
          abierto={!!dialogoAbono}
          idReporte={idReporte}
          abono={dialogoAbono?.abono ?? null}
          onCerrar={() => setDialogoAbono(null)}
          onGuardado={() => setDialogoAbono(null)}
        />
      )}
      {idReporte != null && revision && (
        <DialogoRevision
          idReporte={idReporte}
          lineas={revision.lineas}
          aseguradoraId={revision.aseguradoraId}
          onCerrar={(creoAlgo) => {
            setRevision(null)
            if (creoAlgo) qc.invalidateQueries({ queryKey: CLAVE_REPORTES })
          }}
        />
      )}
    </div>
  )
}

function TablaAbonos({
  abonos,
  onEditar,
  onEliminar,
}: {
  abonos: AbonoPoliza[]
  onEditar: (a: AbonoPoliza) => void
  onEliminar: (a: AbonoPoliza) => void
}) {
  const th = 'px-2.5 py-2.5 text-left font-semibold whitespace-nowrap'
  const td = 'px-2.5 py-2 align-middle'
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[1100px] text-[13px]">
        <thead className="bg-muted text-[12px] text-ink-soft">
          <tr>
            <th className={th}>N.° póliza</th>
            <th className={th}>Cliente</th>
            <th className={th}>Ramo / Producto</th>
            <th className={th}>Bien asegurado</th>
            <th className={`${th} text-right`}>Vlr. prima</th>
            <th className={`${th} text-right`}>Abono</th>
            <th className={`${th} text-right`}>% Com.</th>
            <th className={`${th} text-right`}>Vlr. com.</th>
            <th className={th}>Estado</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody>
          {abonos.map((a) => (
            <tr key={a.id} className="border-t border-line/70 hover:bg-navy-soft/30">
              <td className={`${td} num font-semibold`}>{a.nro_poliza ?? a.id_poliza}</td>
              <td className={td}>
                <div className="leading-tight">
                  <div>{a.nombre_cliente ?? '—'}</div>
                  {a.doc_cliente && (
                    <div className="num text-[11.5px] text-ink-soft">
                      {a.tipodoc_cliente ?? ''} {fmtDoc(a.doc_cliente)}
                    </div>
                  )}
                </div>
              </td>
              <td className={td}>
                <div className="leading-tight">
                  <div>{a.nombre_ramo ?? '—'}</div>
                  {a.nombre_prod && <div className="text-[11.5px] text-ink-soft">{a.nombre_prod}</div>}
                </div>
              </td>
              <td className={`${td} max-w-44 truncate`} title={a.bien_asegurado ?? undefined}>
                {a.bien_asegurado ?? '—'}
              </td>
              <td className={`${td} num text-right whitespace-nowrap`}>{fmtDinero(a.vlrprima_poliza ?? 0)}</td>
              <td className={`${td} num text-right font-semibold whitespace-nowrap`}>{fmtDinero(a.vlrabono_prima ?? 0)}</td>
              <td className={`${td} num text-right`}>{fmtPct(a.porccomision ?? 0, 1)}</td>
              <td className={`${td} num text-right whitespace-nowrap`}>{fmtDinero(a.vlrcomision ?? 0)}</td>
              <td className={td}>
                <EstadoPago estado={a.estado_pago} />
              </td>
              <td className={td}>
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    title="Editar"
                    onClick={() => onEditar(a)}
                    className="rounded-lg p-2 text-ink-soft hover:bg-muted hover:text-navy"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <Link
                    to={`/polizas/${a.id_poliza}/pagos`}
                    title="Estado de cuenta de la póliza"
                    className="rounded-lg p-2 text-ink-soft hover:bg-muted hover:text-green"
                  >
                    <Wallet className="size-4" />
                  </Link>
                  <button
                    type="button"
                    title="Eliminar"
                    onClick={() => onEliminar(a)}
                    className="rounded-lg p-2 text-ink-soft hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
