// Estado de cuenta: todos los abonos de un reporte de comisiones
// (/comisiones/:id/estado-cuenta) o de una póliza (/polizas/:id/pagos).
// Réplica de lib/ui/pagina_estado_cuenta.dart de la app Flutter, con su PDF
// (lib/utils/generador_pdf.dart) y el comprobante de pago de cada abono.

import { useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Download,
  FileText,
  FolderOpen,
  History,
  Inbox,
  Landmark,
  Percent,
  PieChart,
  Printer,
  ReceiptText,
  RefreshCw,
  Sigma,
  Wallet,
  WalletCards,
} from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Aviso, Cargando, Cifra, Etiqueta, MensajeError, SeccionTarjeta, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { Dialogo } from '@/components/ui/dialogo'
import {
  etiquetaEstadoPago,
  listarAbonosDePoliza,
  listarAbonosDeReporte,
  obtenerReporte,
  type AbonoPoliza,
  type ReportePago,
} from '@/datos/pagos'
import { obtenerPoliza } from '@/datos/polizas'
import { aFecha, aFechaHora, fmtFecha, fmtFechaHora } from '@/lib/fechas'
import { fmtDinero, fmtNum } from '@/lib/numeros'
import { useSesion, veComisiones } from '@/lib/sesion'
import type { Poliza } from '@/lib/tipos'
import { cn, mensajeError } from '@/lib/utils'
import {
  calcularPorcPagado,
  calcularSaldo,
  calcularTotales,
  esAnulado,
  etiquetaSaldo,
  fmtPct1,
} from './estado-cuenta-calculos'
import {
  abrirPdfParaImprimir,
  cargarLogoPdf,
  descargarPdf,
  filasClienteComprobante,
  filasDetalleComprobante,
  filasInfoPoliza,
  filasInfoReporte,
  filasPolizaComprobante,
  pdfComprobante,
  pdfEstadoCuentaPoliza,
  pdfEstadoCuentaReporte,
  type FilaInfo,
  type LogoPdf,
} from './pdf'

const CLAVE_LOGO = ['estado-cuenta', 'logo-pdf'] as const

const dinero = (n: number | null | undefined) => fmtDinero(n ?? 0)
const fecha = (v: string | null | undefined) => fmtFecha(aFecha(v))

type Tono = 'neutro' | 'navy' | 'verde' | 'alerta' | 'peligro'
const TONO_ESTADO: Record<string, Tono> = { C: 'verde', R: 'navy', I: 'alerta', V: 'peligro', A: 'neutro' }

function EstadoPago({ estado }: { estado: string | null }) {
  return <Etiqueta tono={TONO_ESTADO[estado ?? ''] ?? 'neutro'}>{etiquetaEstadoPago(estado) || '—'}</Etiqueta>
}

interface DatosEstadoCuenta {
  abonos: AbonoPoliza[]
  reporte: ReportePago | null
  poliza: Poliza | null
}

export default function EstadoCuenta() {
  const { id: idTexto } = useParams()
  const { pathname } = useLocation()
  const modoPoliza = pathname.startsWith('/polizas/')
  const id = Number(idTexto)
  const idValido = Number.isInteger(id) && id > 0
  const usuario = useSesion()?.usuario
  const puedeVerComisiones = veComisiones(usuario)
  const qc = useQueryClient()

  const [exportando, setExportando] = useState<'descargar' | 'imprimir' | null>(null)
  const [comprobante, setComprobante] = useState<AbonoPoliza | null>(null)

  const consulta = useQuery({
    queryKey: ['estado-cuenta', modoPoliza ? 'poliza' : 'reporte', id],
    enabled: idValido,
    queryFn: async (): Promise<DatosEstadoCuenta> => {
      if (modoPoliza) {
        const [abonos, poliza] = await Promise.all([listarAbonosDePoliza(id), obtenerPoliza(id)])
        return { abonos, poliza, reporte: null }
      }
      const [abonos, reporte] = await Promise.all([listarAbonosDeReporte(id), obtenerReporte(id)])
      return { abonos, reporte, poliza: null }
    },
  })

  // El logo del PDF se carga una sola vez y queda listo para imprimir sin esperas.
  const logo = useQuery({ queryKey: CLAVE_LOGO, queryFn: cargarLogoPdf, staleTime: Infinity, gcTime: Infinity })
  const obtenerLogo = async (): Promise<LogoPdf | null> =>
    logo.isSuccess ? logo.data : qc.ensureQueryData({ queryKey: CLAVE_LOGO, queryFn: cargarLogoPdf })

  const abonos = useMemo(() => consulta.data?.abonos ?? [], [consulta.data])
  const reporte = consulta.data?.reporte ?? null
  const poliza = consulta.data?.poliza ?? null
  const primero = abonos[0] ?? null

  const totales = useMemo(() => calcularTotales(abonos), [abonos])
  // Prima de la póliza (misma columna prima_poliza en la póliza y en cada abono).
  const prima = modoPoliza ? (poliza?.prima_poliza ?? primero?.prima_poliza ?? 0) : 0
  const saldo = calcularSaldo(prima, totales.totalAbonado)
  const porcPagado = calcularPorcPagado(prima, totales.totalAbonado)
  const hayAnulados = abonos.some(esAnulado)
  // Póliza en estado ANULADA (A): el saldo pendiente no aplica.
  const polizaAnulada = modoPoliza && (poliza ?? primero)?.estado_poliza_id === 'A'

  const fuenteInfoPoliza = poliza ?? primero
  const infoPoliza: FilaInfo[] | null = modoPoliza && fuenteInfoPoliza ? filasInfoPoliza(fuenteInfoPoliza, id, prima) : null
  const infoReporte: FilaInfo[] | null = !modoPoliza && reporte ? filasInfoReporte(reporte) : null

  const titulo = modoPoliza ? 'Estado de cuenta – Póliza' : `Estado de cuenta – Reporte #${idTexto ?? ''}`
  let subtitulo = ''
  if (modoPoliza && fuenteInfoPoliza) subtitulo = [fuenteInfoPoliza.nro_poliza, fuenteInfoPoliza.nombre_cliente].filter(Boolean).join(' · ')
  if (!modoPoliza && reporte) subtitulo = [reporte.nombre_aseg, fecha(reporte.fecha_rep)].filter(Boolean).join('  |  ')

  const nombreBase = modoPoliza ? `estado_cuenta_poliza_${id}` : `estado_cuenta_reporte_${id}`

  const generarPdf = (l: LogoPdf | null) =>
    modoPoliza
      ? pdfEstadoCuentaPoliza({
          abonos,
          // En el PDF va el cliente en el bloque y la prima en el resumen (como en Flutter).
          info: fuenteInfoPoliza ? filasInfoPoliza(fuenteInfoPoliza, id) : [],
          prima,
          logo: l,
        })
      : pdfEstadoCuentaReporte({ abonos, reporte, idReporte: id, logo: l })

  const descargar = async () => {
    setExportando('descargar')
    try {
      descargarPdf(generarPdf(await obtenerLogo()), nombreBase)
      toast.success('PDF generado y descargado.')
    } catch (e) {
      toast.error(`No se pudo generar el PDF: ${mensajeError(e)}`)
    } finally {
      setExportando(null)
    }
  }

  const imprimir = async () => {
    // Si el logo aún no está, la pestaña se abre ya (en el mismo clic) para que no la bloqueen.
    const ventana = logo.isSuccess ? null : window.open('', '_blank')
    setExportando('imprimir')
    try {
      const ok = abrirPdfParaImprimir(generarPdf(await obtenerLogo()), nombreBase, ventana)
      if (!ok) toast.info('El navegador bloqueó la ventana emergente; el PDF se descargó para que lo imprima.')
    } catch (e) {
      ventana?.close()
      toast.error(`No se pudo generar el PDF: ${mensajeError(e)}`)
    } finally {
      setExportando(null)
    }
  }

  const sinAbonos = abonos.length === 0

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo={titulo}
        subtitulo={
          subtitulo || polizaAnulada ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              {subtitulo}
              {polizaAnulada && <Etiqueta tono="peligro">ANULADA</Etiqueta>}
            </span>
          ) : undefined
        }
        volver={modoPoliza ? '/polizas' : '/comisiones'}
        acciones={
          <>
            {modoPoliza && idValido && (
              <Link to={`/polizas/${id}`}>
                <Boton variante="secundario" tamano="sm">
                  <FileText />
                  Ver póliza
                </Boton>
              </Link>
            )}
            {!modoPoliza && idValido && (
              <Link to={`/comisiones/${id}`}>
                <Boton variante="secundario" tamano="sm">
                  <FolderOpen />
                  Ver reporte
                </Boton>
              </Link>
            )}
            <Boton
              variante="secundario"
              tamano="sm"
              onClick={imprimir}
              disabled={sinAbonos || !!exportando}
              cargando={exportando === 'imprimir'}
              title="Abrir el PDF para imprimir"
            >
              {exportando !== 'imprimir' && <Printer />}
              Imprimir
            </Boton>
            <Boton
              tamano="sm"
              onClick={descargar}
              disabled={sinAbonos || !!exportando}
              cargando={exportando === 'descargar'}
              title="Descargar PDF"
            >
              {exportando !== 'descargar' && <Download />}
              Descargar PDF
            </Boton>
            <Boton
              variante="fantasma"
              tamano="icono"
              title="Recargar"
              onClick={() => consulta.refetch()}
              disabled={consulta.isFetching || !idValido}
            >
              <RefreshCw className={consulta.isFetching ? 'animate-spin' : ''} />
            </Boton>
          </>
        }
      />

      <Contenido className="flex flex-col gap-4">
        {!idValido ? (
          <MensajeError error={modoPoliza ? 'El código de la póliza no es válido.' : 'El número del reporte no es válido.'} />
        ) : consulta.isPending ? (
          <Cargando />
        ) : consulta.isError ? (
          <MensajeError error={`Error al cargar: ${mensajeError(consulta.error)}`} />
        ) : (
          <>
            {modoPoliza && !poliza && sinAbonos && <Aviso>No se encontró la póliza #{id}.</Aviso>}
            {!modoPoliza && !reporte && (
              <Aviso>No se encontró el reporte #{id} o no tiene permiso para verlo.</Aviso>
            )}

            {infoPoliza && (
              <SeccionTarjeta titulo="Información de la póliza" icono={<ReceiptText />}>
                <ListaInfo filas={infoPoliza} />
              </SeccionTarjeta>
            )}
            {infoReporte && (
              <SeccionTarjeta titulo="Información del reporte" icono={<FolderOpen />}>
                <ListaInfo filas={infoReporte} />
              </SeccionTarjeta>
            )}

            {sinAbonos ? (
              <Vacio icono={<Inbox />} titulo="Sin abonos registrados" />
            ) : (
              <>
                <Resumen
                  modoPoliza={modoPoliza}
                  prima={prima}
                  totalAbonado={totales.totalAbonado}
                  totalComision={totales.totalComision}
                  saldo={saldo}
                  polizaAnulada={polizaAnulada}
                  porcPagado={porcPagado}
                  numAbonos={totales.numAbonos}
                />
                <SeccionTarjeta titulo="Historial de pagos" icono={<History />}>
                  {hayAnulados && (
                    <Aviso tono="navy" className="mb-3">
                      Los abonos anulados se muestran en gris y no suman en los totales.
                    </Aviso>
                  )}
                  <TablaHistorial
                    abonos={abonos}
                    modoPoliza={modoPoliza}
                    enlazarReportes={puedeVerComisiones}
                    totalAbonado={totales.totalAbonado}
                    totalComisionBase={totales.totalComisionBase}
                    totalComisionAdicional={totales.totalComisionAdicional}
                    onComprobante={setComprobante}
                  />
                </SeccionTarjeta>
              </>
            )}
          </>
        )}
      </Contenido>

      <DialogoComprobante abono={comprobante} onCerrar={() => setComprobante(null)} obtenerLogo={obtenerLogo} />
    </div>
  )
}

// ── Información (Etiqueta: valor) ───────────────────────────────────────────

function ListaInfo({ filas }: { filas: FilaInfo[] }) {
  return (
    <dl className="grid gap-x-8 gap-y-1.5 text-[13px] sm:grid-cols-2">
      {filas.map(([e, v]) => (
        <div key={e} className="flex min-w-0 gap-2">
          <dt className="w-32 shrink-0 font-semibold text-ink-soft">{e}:</dt>
          <dd className="min-w-0 flex-1 break-words">{v || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

// ── Tarjetas de resumen ─────────────────────────────────────────────────────

function Resumen({
  modoPoliza,
  prima,
  totalAbonado,
  totalComision,
  saldo,
  polizaAnulada,
  porcPagado,
  numAbonos,
}: {
  modoPoliza: boolean
  prima: number
  totalAbonado: number
  totalComision: number
  saldo: number
  polizaAnulada: boolean
  porcPagado: number
  numAbonos: number
}) {
  const icono = (nodo: ReactNode, clase: string) => <span className={cn('[&_svg]:size-4', clase)}>{nodo}</span>
  return (
    <SeccionTarjeta titulo="Resumen de cuenta" icono={<Sigma />}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {modoPoliza && <Cifra titulo="Prima total" valor={dinero(prima)} icono={icono(<Landmark />, 'text-navy')} />}
        <Cifra titulo="Total abonado" valor={dinero(totalAbonado)} icono={icono(<Wallet />, 'text-green')} />
        {modoPoliza &&
          (polizaAnulada ? (
            <Cifra titulo="Saldo pendiente" valor="—" icono={icono(<WalletCards />, 'text-ink-soft')} />
          ) : (
            <Cifra
              titulo={etiquetaSaldo(saldo)}
              valor={<span className={saldo > 0 ? 'text-warning-ink' : 'text-green-ink'}>{dinero(Math.abs(saldo))}</span>}
              icono={icono(<WalletCards />, saldo > 0 ? 'text-warning' : 'text-green')}
            />
          ))}
        <Cifra titulo="Total comisión" valor={dinero(totalComision)} icono={icono(<Percent />, 'text-navy')} />
        {modoPoliza && (
          <Cifra
            titulo="% pagado"
            valor={<span className={porcPagado >= 100 ? 'text-green-ink' : 'text-warning-ink'}>{fmtPct1(porcPagado)}</span>}
            icono={icono(<PieChart />, porcPagado >= 100 ? 'text-green' : 'text-warning')}
          />
        )}
        <Cifra titulo="Número de pagos" valor={fmtNum(numAbonos)} icono={icono(<ReceiptText />, 'text-navy')} />
      </div>
    </SeccionTarjeta>
  )
}

// ── Historial de pagos ──────────────────────────────────────────────────────

function TablaHistorial({
  abonos,
  modoPoliza,
  enlazarReportes,
  totalAbonado,
  totalComisionBase,
  totalComisionAdicional,
  onComprobante,
}: {
  abonos: AbonoPoliza[]
  modoPoliza: boolean
  enlazarReportes: boolean
  totalAbonado: number
  totalComisionBase: number
  totalComisionAdicional: number
  onComprobante: (a: AbonoPoliza) => void
}) {
  const th = 'px-2.5 py-2.5 text-left font-semibold whitespace-nowrap'
  const thDer = cn(th, 'text-right')
  const td = 'px-2.5 py-2 align-middle'
  const tdNum = cn(td, 'num text-right whitespace-nowrap')
  const columnasAntesDeAbono = modoPoliza ? 4 : 5

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[1000px] border-collapse text-[13px]">
        <thead className="bg-muted text-[12px] text-ink-soft">
          <tr>
            <th className={th}>Fecha pago</th>
            {modoPoliza ? (
              <th className={th}>Reporte #</th>
            ) : (
              <>
                <th className={th}>N° póliza</th>
                <th className={th}>Cliente</th>
              </>
            )}
            <th className={th}>Ramo / Producto</th>
            <th className={th}>Bien asegurado</th>
            <th className={thDer}>Abono</th>
            <th className={thDer}>% Com.</th>
            <th className={thDer}>Vlr. com.</th>
            <th className={thDer}>Com. adic.</th>
            <th className={th}>N° factura</th>
            <th className={th}>Estado</th>
            <th className={cn(th, 'text-center')}>Comprobante</th>
          </tr>
        </thead>
        <tbody>
          {abonos.map((a) => {
            const anulado = esAnulado(a)
            return (
              <tr
                key={a.id}
                className={cn('border-t border-line/70', anulado && 'text-ink-soft/70 italic')}
                title={anulado ? 'Abono anulado: no suma en los totales' : undefined}
              >
                <td className={cn(td, 'num whitespace-nowrap')}>{fecha(a.fecha_pago) || '—'}</td>
                {modoPoliza ? (
                  <td className={cn(td, 'num whitespace-nowrap')}>
                    {a.idrep_pago == null ? (
                      '—'
                    ) : enlazarReportes ? (
                      <Link to={`/comisiones/${a.idrep_pago}`} className="font-semibold text-navy hover:underline">
                        #{a.idrep_pago}
                      </Link>
                    ) : (
                      `#${a.idrep_pago}`
                    )}
                  </td>
                ) : (
                  <>
                    <td className={cn(td, 'num whitespace-nowrap')}>
                      <Link
                        to={`/polizas/${a.id_poliza}`}
                        className="font-semibold text-navy hover:underline"
                        title="Ver póliza"
                      >
                        {a.nro_poliza ?? a.id_poliza}
                      </Link>
                    </td>
                    <td className={cn(td, 'max-w-56')}>
                      <div className="truncate" title={a.nombre_cliente ?? undefined}>
                        {a.nombre_cliente ?? '—'}
                      </div>
                    </td>
                  </>
                )}
                <td className={cn(td, 'max-w-48')}>
                  <div className="truncate">{a.nombre_ramo ?? '—'}</div>
                  {a.nombre_prod && <div className="truncate text-[11.5px] text-ink-soft">{a.nombre_prod}</div>}
                </td>
                <td className={cn(td, 'max-w-40')}>
                  <div className="truncate text-[12px]" title={a.bien_asegurado ?? undefined}>
                    {a.bien_asegurado ?? '—'}
                  </div>
                </td>
                <td className={cn(tdNum, 'font-semibold', anulado && 'line-through')}>{dinero(a.vlrabono_prima)}</td>
                <td className={tdNum}>{fmtPct1(a.porccomision)}</td>
                <td className={cn(tdNum, anulado && 'line-through')}>{dinero(a.vlrcomision)}</td>
                <td className={cn(tdNum, anulado && 'line-through')}>{dinero(a.vlrcomad)}</td>
                <td className={cn(td, 'num whitespace-nowrap')}>{a.num_factura ?? '—'}</td>
                <td className={td}>
                  <EstadoPago estado={a.estado_pago} />
                </td>
                <td className={cn(td, 'text-center')}>
                  <Boton
                    variante="fantasma"
                    tamano="icono"
                    title="Ver o descargar el comprobante de pago"
                    aria-label="Ver comprobante"
                    onClick={() => onComprobante(a)}
                  >
                    <ReceiptText />
                  </Boton>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-line-strong bg-muted font-semibold">
            <td className={td} colSpan={columnasAntesDeAbono}>
              TOTALES
            </td>
            <td className={tdNum}>{dinero(totalAbonado)}</td>
            <td className={td} />
            <td className={tdNum}>{dinero(totalComisionBase)}</td>
            <td className={tdNum}>{dinero(totalComisionAdicional)}</td>
            <td className={td} colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Comprobante de pago de un abono ─────────────────────────────────────────

function DialogoComprobante({
  abono: a,
  onCerrar,
  obtenerLogo,
}: {
  abono: AbonoPoliza | null
  onCerrar: () => void
  obtenerLogo: () => Promise<LogoPdf | null>
}) {
  const [descargando, setDescargando] = useState(false)

  const descargar = async () => {
    if (!a) return
    setDescargando(true)
    try {
      descargarPdf(pdfComprobante({ abono: a, logo: await obtenerLogo() }), `factura_${a.num_factura ?? a.id}`)
      toast.success('Comprobante descargado como PDF.')
    } catch (e) {
      toast.error(`No se pudo generar el PDF: ${mensajeError(e)}`)
    } finally {
      setDescargando(false)
    }
  }

  const detalle = a ? filasDetalleComprobante(a) : null
  const creado = a ? fmtFechaHora(aFechaHora(a.fcreado)) : ''

  return (
    <Dialogo
      abierto={!!a}
      onCerrar={onCerrar}
      titulo={a ? `Comprobante ${a.num_factura ?? `#${a.id}`}` : ''}
      descripcion="Comprobante de pago del abono"
      ancho="lg"
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar}>
            Cerrar
          </Boton>
          <Boton onClick={descargar} cargando={descargando}>
            {!descargando && <Download />}
            Descargar PDF
          </Boton>
        </>
      }
    >
      {a && detalle && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-bold text-navy">Rueda Serrano Asesores de Seguros</div>
              <div className="text-[12px] text-ink-soft">Asesoría y gestión de seguros</div>
            </div>
            <div className="rounded-[10px] bg-navy-soft px-3 py-2 text-right text-navy-dark">
              <div className="text-[13px] font-bold">COMPROBANTE DE PAGO</div>
              {a.num_factura && <div className="num text-[14px] font-bold">N° {a.num_factura}</div>}
              <div className="num text-[12px]">{fecha(a.fecha_pago) || '—'}</div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <BloqueComprobante titulo="DATOS DEL CLIENTE" filas={filasClienteComprobante(a)} />
            <BloqueComprobante titulo="DATOS DE LA PÓLIZA" filas={filasPolizaComprobante(a)} />
          </div>

          <div>
            <div className="mb-2 text-[13px] font-bold text-navy">DETALLE DEL PAGO</div>
            <div className="overflow-x-auto rounded-[10px] border border-line">
              <table className="w-full border-collapse text-[13px]">
                <thead className="bg-navy-soft text-navy-dark">
                  <tr>
                    <th className="px-3 py-2 text-left">Concepto</th>
                    <th className="px-3 py-2 text-right">Vlr. prima póliza</th>
                    <th className="px-3 py-2 text-right">Abono / comisión</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.filas.map((f) => (
                    <tr key={f[0]} className="border-t border-line">
                      <td className="px-3 py-2">{f[0]}</td>
                      <td className="num px-3 py-2 text-right">{f[1]}</td>
                      <td className="num px-3 py-2 text-right">{f[2]}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-muted font-bold">
                    <td className="px-3 py-2">{detalle.total[0]}</td>
                    <td className="px-3 py-2" />
                    <td className="num px-3 py-2 text-right">{detalle.total[2]}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-semibold text-ink-soft">Estado:</span>
            <EstadoPago estado={a.estado_pago} />
            {a.idrep_pago != null && (
              <Etiqueta tono="verde">Reporte #{a.idrep_pago}</Etiqueta>
            )}
          </div>

          {a.obs_pago?.trim() && (
            <div className="text-[13px]">
              <div className="font-semibold">Observaciones:</div>
              <div className="whitespace-pre-wrap text-ink-soft">{a.obs_pago}</div>
            </div>
          )}

          {a.apodo_usuario && (
            <div className="border-t border-line pt-2 text-[12px] text-ink-soft">
              Registrado por: {a.apodo_usuario}
              {creado && ` – ${creado}`}
            </div>
          )}
        </div>
      )}
    </Dialogo>
  )
}

function BloqueComprobante({ titulo, filas }: { titulo: string; filas: FilaInfo[] }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-line">
      <div className="bg-navy-soft px-3 py-1.5 text-[11.5px] font-bold text-navy-dark">{titulo}</div>
      <dl className="flex flex-col gap-1 p-3 text-[12.5px]">
        {filas.map(([e, v]) => (
          <div key={e} className="flex min-w-0 gap-2">
            <dt className="w-28 shrink-0 font-semibold">{e}:</dt>
            <dd className="min-w-0 flex-1 break-words">{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
