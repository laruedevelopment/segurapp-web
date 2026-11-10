import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FilePlus2, Save, Trash2, Unlink } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Aviso, Cargando, Chip, MensajeError, SeccionTarjeta, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { Buscador } from '@/components/ui/buscador'
import { AreaTexto, Campo, InputNumero } from '@/components/ui/campos'
import { Dialogo, useConfirmar } from '@/components/ui/dialogo'
import { InputFecha } from '@/components/ui/fecha'
import { Tabla, type Columna } from '@/components/ui/tabla'
import {
  CLAVE_FACTURAS,
  actualizarFactura,
  agregarLineasAFactura,
  eliminarFactura,
  listarAbonosDeFactura,
  listarAbonosPorIds,
  listarLineasPorFacturar,
  obtenerFactura,
  quitarLineasDeFactura,
  useEmpresas,
} from '@/datos/facturas'
import {
  ESTADOS_FACTURA,
  NOMBRE_ESTADO_FACTURA,
  calcularMontos,
  comisionDeLinea,
  empresasParaAseguradora,
  facturaCerradaParaEditar,
  numeroFactura,
  validarFactura,
  type EmpresaAseguradora,
  type EstadoFactura,
  type Factura,
} from '@/datos/facturasLogica'
import type { AbonoPoliza } from '@/datos/pagos'
import { aFecha, aISO } from '@/lib/fechas'
import { mensajeAmigable } from '@/lib/errores'
import { fmtDinero } from '@/lib/numeros'
import { esAdmin, useSesion } from '@/lib/sesion'
import { trasCambiarAbonos } from '@/paginas/comisiones/comun'
import { EstadoFacturaEtiqueta } from './ListaFacturas'

/** Una factura: cabecera editable, sus líneas y los montos calculados. */
export default function FormularioFactura() {
  const { id } = useParams()
  const idFactura = Number(id)
  const factura = useQuery({
    queryKey: [...CLAVE_FACTURAS, 'una', idFactura],
    queryFn: () => obtenerFactura(idFactura),
    enabled: Number.isInteger(idFactura) && idFactura > 0,
    staleTime: 0,
  })

  if (!Number.isInteger(idFactura) || idFactura <= 0) return <Pantalla><Vacio titulo="Esa factura no existe." /></Pantalla>
  if (factura.isError) return <Pantalla><MensajeError error={mensajeAmigable(factura.error, 'No se pudo cargar la factura')} /></Pantalla>
  if (factura.isPending) return <Pantalla><Cargando texto="Cargando factura…" /></Pantalla>
  if (!factura.data) return <Pantalla><Vacio titulo="Esa factura no existe o ya se eliminó." /></Pantalla>
  return <Editor factura={factura.data} />
}

function Pantalla({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina titulo="Factura" volver="/facturas" />
      <Contenido>{children}</Contenido>
    </div>
  )
}

function Editor({ factura }: { factura: Factura }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const confirmar = useConfirmar()
  const admin = esAdmin(useSesion()?.usuario)
  const empresas = useEmpresas()
  const abonos = useQuery({
    queryKey: [...CLAVE_FACTURAS, 'una', factura.id, 'abonos'],
    queryFn: () => listarAbonosDeFactura(factura.id),
    staleTime: 0,
  })

  const [fecha, setFecha] = useState<Date | null>(aFecha(factura.fecha))
  const [empresaId, setEmpresaId] = useState<number | null>(factura.empresaId)
  const [observacion, setObservacion] = useState(factura.observacion ?? '')
  const [iva, setIva] = useState<number | null>(factura.ivaPct)
  const [rete, setRete] = useState<number | null>(factura.retefuentePct)
  const [ica, setIca] = useState<number | null>(factura.icaPct)
  const [reteiva, setReteiva] = useState<number | null>(factura.reteivaPct)
  const [estado, setEstado] = useState<EstadoFactura>(factura.estado)
  const [intento, setIntento] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set())
  const [agregando, setAgregando] = useState(false)
  const [trabajando, setTrabajando] = useState(false)

  // Si la factura se recarga (se agregaron o quitaron líneas) la pantalla refleja los montos nuevos.
  useEffect(() => {
    setEstado(factura.estado)
  }, [factura.estado])

  const bloqueada = facturaCerradaParaEditar(factura.estado)
  const m = calcularMontos(factura.subtotal, iva ?? 0, rete ?? 0, ica ?? 0, reteiva ?? 0)
  const errores = validarFactura({ fecha, ivaPct: iva, retePct: rete, icaPct: ica, reteivaPct: reteiva, lineasElegidas: 1 })
  const opciones = useMemo(() => empresasParaAseguradora(empresas.data ?? [], factura.asegId), [empresas.data, factura.asegId])
  const empresa = (empresas.data ?? []).find((e) => e.id === empresaId) ?? null
  const sinCambios =
    aISO(fecha) === factura.fecha &&
    empresaId === factura.empresaId &&
    observacion.trim() === (factura.observacion ?? '') &&
    iva === factura.ivaPct &&
    rete === factura.retefuentePct &&
    ica === factura.icaPct &&
    reteiva === factura.reteivaPct &&
    estado === factura.estado

  const refrescar = async () => {
    await qc.invalidateQueries({ queryKey: CLAVE_FACTURAS })
  }

  const guardar = async () => {
    setIntento(true)
    if (Object.keys(errores).length > 0 || fecha == null) return
    setGuardando(true)
    try {
      await actualizarFactura(factura, {
        fecha: aISO(fecha) ?? factura.fecha,
        empresaId,
        observacion,
        ivaPct: iva ?? 0,
        retePct: rete ?? 0,
        icaPct: ica ?? 0,
        reteivaPct: reteiva ?? 0,
        estado,
      })
      toast.success('Factura guardada.')
      await refrescar()
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudo guardar la factura'))
    } finally {
      setGuardando(false)
    }
  }

  const quitar = async () => {
    const ids = [...marcadas]
    const ok = await confirmar({
      titulo: 'Quitar líneas de la factura',
      mensaje: `${ids.length === 1 ? 'La línea quedará' : `Las ${ids.length} líneas quedarán`} libre${ids.length === 1 ? '' : 's'} para facturarse otra vez. El subtotal se vuelve a calcular.`,
      confirmar: 'Quitar',
    })
    if (!ok) return
    setTrabajando(true)
    try {
      await quitarLineasDeFactura(factura.id, ids)
      setMarcadas(new Set())
      await Promise.all([refrescar(), trasCambiarAbonos(qc, [])])
      toast.success('Líneas quitadas.')
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudieron quitar las líneas'))
    } finally {
      setTrabajando(false)
    }
  }

  const eliminar = async () => {
    const ok = await confirmar({
      titulo: 'Eliminar factura',
      mensaje: `Se eliminará la factura ${numeroFactura(factura.prefijo, factura.numFactura)}. Sus líneas quedan libres para facturarse de nuevo. No se puede deshacer.`,
      confirmar: 'Eliminar',
      peligro: true,
    })
    if (!ok) return
    try {
      await eliminarFactura(factura.id)
      await refrescar()
      toast.success('Factura eliminada.')
      navigate('/facturas', { replace: true })
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudo eliminar la factura'))
    }
  }

  const lineas = abonos.data ?? []
  const alternar = (a: number) =>
    setMarcadas((s) => {
      const n = new Set(s)
      if (n.has(a)) n.delete(a)
      else n.add(a)
      return n
    })

  const columnas: Columna<AbonoPoliza>[] = [
    ...(bloqueada
      ? []
      : [
          {
            id: 'sel',
            titulo: '',
            ancho: 44,
            alinear: 'centro' as const,
            celda: (a: AbonoPoliza) => (
              <input
                type="checkbox"
                className="size-4 accent-navy"
                aria-label={`Marcar la póliza ${a.nro_poliza ?? a.id}`}
                checked={marcadas.has(a.id)}
                onChange={() => alternar(a.id)}
                onClick={(e) => e.stopPropagation()}
              />
            ),
          },
        ]),
    { id: 'poliza', titulo: 'Póliza', ancho: 190, celda: (a) => <span className="num">{a.nro_poliza ?? '—'}</span>, ordenar: (a) => a.nro_poliza ?? '' },
    { id: 'cliente', titulo: 'Cliente', ancho: 240, celda: (a) => a.nombre_cliente ?? '—', ordenar: (a) => a.nombre_cliente?.toLowerCase(), titleDe: (a) => a.nombre_cliente ?? undefined },
    { id: 'ramo', titulo: 'Ramo / Producto', ancho: 180, celda: (a) => [a.nombre_ramo, a.nombre_prod].filter(Boolean).join(' · ') || '—' },
    { id: 'prima', titulo: 'Vlr prima', ancho: 120, alinear: 'der', celda: (a) => <span className="num">{fmtDinero(a.vlrabono_prima ?? 0)}</span>, ordenar: (a) => a.vlrabono_prima ?? 0 },
    { id: 'pct', titulo: '% com.', ancho: 70, alinear: 'der', celda: (a) => <span className="num">{a.porccomision ?? 0}</span> },
    { id: 'com', titulo: 'Vlr comisión', ancho: 125, alinear: 'der', celda: (a) => <span className="num font-semibold">{fmtDinero(comisionDeLinea(a))}</span>, ordenar: (a) => comisionDeLinea(a) },
    { id: 'rep', titulo: 'Reporte', ancho: 80, alinear: 'der', celda: (a) => <span className="num">#{a.idrep_pago ?? '—'}</span> },
  ]

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            Factura {numeroFactura(factura.prefijo, factura.numFactura)}
            <EstadoFacturaEtiqueta estado={factura.estado} />
          </span>
        }
        subtitulo={`${factura.nombreAseg ?? 'Sin aseguradora'}${factura.nombreInterm ? ` · ${factura.nombreInterm}` : ''}`}
        volver="/facturas"
        acciones={
          <>
            {admin && (
              <Boton variante="fantasma" tamano="sm" onClick={() => void eliminar()}>
                <Trash2 className="text-danger" />
                Eliminar
              </Boton>
            )}
            <Boton variante="verde" tamano="sm" onClick={() => void guardar()} cargando={guardando} disabled={sinCambios}>
              {!guardando && <Save />}
              Guardar
            </Boton>
          </>
        }
      />
      <Contenido className="flex max-w-6xl flex-col gap-4">
        {bloqueada && (
          <Aviso tono="navy">
            Esta factura está {factura.estado === 'P' ? 'pagada' : 'anulada'}: solo se puede cambiar su estado. Para modificar las líneas o los montos,
            pásela primero a Abierta.
          </Aviso>
        )}

        <SeccionTarjeta titulo="Datos de la factura" icono={<FilePlus2 />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Fecha" obligatorio error={intento ? errores.fecha : null}>
              <InputFecha valor={fecha} onCambio={setFecha} disabled={bloqueada} error={intento && !!errores.fecha} />
            </Campo>
            <Campo etiqueta="Empresa aseguradora" ayuda="Se identifica por el NIT.">
              <Buscador<EmpresaAseguradora>
                valor={empresa}
                onCambio={(e) => setEmpresaId(e?.id ?? null)}
                opciones={opciones}
                etiqueta={(e) => e.nombre}
                detalle={(e) => `NIT ${e.nit}`}
                clave={(e) => e.id}
                disabled={bloqueada}
                placeholder={empresas.isPending ? 'Cargando…' : 'Seleccione…'}
              />
            </Campo>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Estado de la factura">
            {ESTADOS_FACTURA.map((e) => (
              <Chip key={e} fuerte activo={estado === e} onClick={() => setEstado(e)}>
                {NOMBRE_ESTADO_FACTURA[e]}
              </Chip>
            ))}
          </div>
          <Campo etiqueta="Observación" className="mt-3">
            <AreaTexto rows={2} value={observacion} onChange={(e) => setObservacion(e.target.value)} disabled={bloqueada} />
          </Campo>
        </SeccionTarjeta>

        <SeccionTarjeta titulo="Montos" icono={<Save />}>
          <div className="grid gap-3 sm:grid-cols-4">
            <Campo etiqueta="IVA (%)" error={intento ? errores.porcentajes : null}>
              <InputNumero valor={iva} onCambio={setIva} permitirNegativos={false} sufijo="%" disabled={bloqueada} />
            </Campo>
            <Campo etiqueta="Retención en la fuente (%)">
              <InputNumero valor={rete} onCambio={setRete} permitirNegativos={false} sufijo="%" disabled={bloqueada} />
            </Campo>
            <Campo etiqueta="ICA (%)">
              <InputNumero valor={ica} onCambio={setIca} permitirNegativos={false} sufijo="%" disabled={bloqueada} />
            </Campo>
            <Campo etiqueta="Retención de IVA (%)">
              <InputNumero valor={reteiva} onCambio={setReteiva} permitirNegativos={false} sufijo="%" disabled={bloqueada} />
            </Campo>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl bg-muted px-4 py-3 text-[13px] sm:grid-cols-7">
            <Monto etiqueta="Subtotal" valor={factura.subtotal} />
            <Monto etiqueta="IVA" valor={m.iva} />
            <Monto etiqueta="Total" valor={m.total} />
            <Monto etiqueta="Retención" valor={m.retefuente} />
            <Monto etiqueta="ICA" valor={m.ica} />
            <Monto etiqueta="Ret. IVA" valor={m.reteiva} />
            <Monto etiqueta="A consignar" valor={m.neto} fuerte />
          </dl>
          {!sinCambios && <p className="mt-2 text-[12px] text-ink-soft">Los montos se guardan al pulsar Guardar.</p>}
        </SeccionTarjeta>

        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex-1 text-[14px] font-bold">
              Líneas de la factura ({lineas.length})
            </h2>
            {!bloqueada && (
              <>
                <Boton variante="secundario" tamano="sm" onClick={() => setAgregando(true)} disabled={factura.asegId == null}>
                  <FilePlus2 />
                  Agregar líneas
                </Boton>
                <Boton variante="secundario" tamano="sm" onClick={() => void quitar()} disabled={marcadas.size === 0 || trabajando} cargando={trabajando}>
                  {!trabajando && <Unlink />}
                  Quitar {marcadas.size > 0 ? `(${marcadas.size})` : ''}
                </Boton>
              </>
            )}
          </div>
          {abonos.isError ? (
            <MensajeError error={mensajeAmigable(abonos.error, 'No se pudieron cargar las líneas')} />
          ) : abonos.isPending ? (
            <Cargando texto="Cargando líneas…" />
          ) : (
            <Tabla
              className="h-72"
              filas={lineas}
              columnas={columnas}
              clave={(a) => a.id}
              claveAnchos="factura-lineas"
              vacio={
                <Vacio
                  titulo="Esta factura no tiene líneas cargadas."
                  detalle="Si es una factura antigua, sus líneas quedan enlazadas por el código del software anterior."
                />
              }
            />
          )}
        </section>
      </Contenido>

      {agregando && factura.asegId != null && (
        <DialogoAgregarLineas
          factura={factura}
          onCerrar={() => setAgregando(false)}
          onAgregadas={async () => {
            setAgregando(false)
            await Promise.all([refrescar(), trasCambiarAbonos(qc, [])])
          }}
        />
      )}
    </div>
  )
}

function Monto({ etiqueta, valor, fuerte = false }: { etiqueta: string; valor: number; fuerte?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-ink-soft">{etiqueta}</dt>
      <dd className={`num ${fuerte ? 'text-[15px] font-extrabold text-green-ink' : 'font-semibold'}`}>{fmtDinero(valor)}</dd>
    </div>
  )
}

/** Líneas sin factura de la misma aseguradora, de cualquier reporte. */
function DialogoAgregarLineas({
  factura,
  onCerrar,
  onAgregadas,
}: {
  factura: Factura
  onCerrar: () => void
  onAgregadas: () => Promise<void>
}) {
  const libres = useQuery({
    queryKey: [...CLAVE_FACTURAS, 'libres', factura.asegId],
    queryFn: async () => {
      const todas = await listarLineasPorFacturar()
      const ids = todas.filter((l) => l.reporteAsegId === factura.asegId).map((l) => l.id)
      return listarAbonosPorIds(ids.slice(0, 500))
    },
    staleTime: 0,
  })
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [guardando, setGuardando] = useState(false)
  const alternar = (id: number) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const agregar = async () => {
    setGuardando(true)
    try {
      await agregarLineasAFactura(factura.id, [...sel])
      toast.success(sel.size === 1 ? 'Línea agregada.' : `${sel.size} líneas agregadas.`)
      await onAgregadas()
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudieron agregar las líneas'))
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      ancho="lg"
      titulo="Agregar líneas a la factura"
      descripcion={`Líneas sin factura de ${factura.nombreAseg ?? 'esta aseguradora'}`}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton onClick={() => void agregar()} disabled={sel.size === 0} cargando={guardando}>
            Agregar {sel.size > 0 ? `(${sel.size})` : ''}
          </Boton>
        </>
      }
    >
      {libres.isError ? (
        <MensajeError error={mensajeAmigable(libres.error, 'No se pudieron cargar las líneas')} />
      ) : libres.isPending ? (
        <Cargando texto="Buscando líneas libres…" />
      ) : (libres.data ?? []).length === 0 ? (
        <Vacio titulo="No hay líneas sin factura de esta aseguradora." />
      ) : (
        <div className="max-h-80 divide-y divide-line/70 overflow-y-auto rounded-xl border border-line">
          {(libres.data ?? []).map((a) => (
            <label key={a.id} className="flex cursor-pointer items-start gap-2.5 px-3 py-2 hover:bg-navy-soft/40">
              <input type="checkbox" className="mt-1 size-4 accent-navy" checked={sel.has(a.id)} onChange={() => alternar(a.id)} aria-label={`Agregar la póliza ${a.nro_poliza ?? a.id}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">
                  {a.nro_poliza ?? 'sin número'} · {a.nombre_cliente ?? 'sin cliente'}
                </span>
                <span className="block text-[11.5px] text-ink-soft">Reporte #{a.idrep_pago ?? '—'}</span>
              </span>
              <span className="num shrink-0 text-[13px] font-bold">{fmtDinero(comisionDeLinea(a))}</span>
            </label>
          ))}
        </div>
      )}
    </Dialogo>
  )
}
