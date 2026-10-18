import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, Clock, Eye, History, ListChecks, RefreshCw, Trash2, Undo2, UserRound, Wallet } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Aviso, Cargando, Chip, MensajeError, Tarjeta, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { AreaTexto, Campo, Input } from '@/components/ui/campos'
import { Dialogo } from '@/components/ui/dialogo'
import { DialogoDetalle } from './DialogoDetalle'
import {
  CLAVE_CONTEO_ELIMINACIONES,
  CLAVE_ELIMINACIONES,
  listarEliminacionesPendientes,
  listarHistorialEliminaciones,
  obtenerDetalleEliminacion,
  resolverEliminaciones,
} from '@/datos/eliminacion'
import {
  agruparPorLote,
  confirmacionValida,
  type HistorialEliminacion,
  mensajeResueltas,
  plural,
  tituloOmitidasResolver,
  type ResultadoEliminacion,
  type SolicitudEliminacion,
} from '@/datos/eliminacionLogica'
import { aFechaHora, fmtFecha, fmtFechaHora, aFecha } from '@/lib/fechas'
import { mensajeAmigable } from '@/lib/errores'
import { fmtDinero } from '@/lib/numeros'
import { esAdmin, useSesion } from '@/lib/sesion'

const LIMITE_HISTORIAL = 100
const cuando = (v: string | null) => (v ? fmtFechaHora(aFechaHora(v)) : '')
const dia = (v: string | null) => (v ? fmtFecha(aFecha(v)) : '')

/** Casilla que puede quedar "a medias" (algunas marcadas). */
function CasillaTri({
  estado,
  onCambio,
  etiqueta,
  disabled,
}: {
  estado: boolean | 'parcial'
  onCambio: () => void
  etiqueta: string
  disabled?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = estado === 'parcial'
  }, [estado])
  return (
    <input
      ref={ref}
      type="checkbox"
      className="size-4 shrink-0 accent-navy"
      aria-label={etiqueta}
      checked={estado === true}
      disabled={disabled}
      onChange={onCambio}
    />
  )
}

/**
 * Bandeja del Administrador: pólizas que alguien marcó para eliminar. Aquí se
 * AUTORIZA (se borran de verdad, con copia en el registro) o se RECHAZA (vuelven
 * a las listas). La base también exige el rol, así que no depende de esta pantalla.
 */
export default function EliminacionesPendientes() {
  const sesion = useSesion()
  if (!esAdmin(sesion?.usuario)) {
    return (
      <div className="flex h-full flex-col">
        <EncabezadoPagina titulo="Eliminaciones por autorizar" volver="/polizas" />
        <Contenido>
          <Vacio titulo="Solo disponible para administradores." />
        </Contenido>
      </div>
    )
  }
  return <Bandeja />
}

function Bandeja() {
  const qc = useQueryClient()
  const [verHistorial, setVerHistorial] = useState(false)
  const [selMarcada, setSelMarcada] = useState<Set<number>>(new Set()) // ids de solicitud
  const [trabajando, setTrabajando] = useState(false)
  const [dialogo, setDialogo] = useState<{ aprobar: boolean; elegidas: SolicitudEliminacion[] } | null>(null)
  const [parcial, setParcial] = useState<{ aprobar: boolean; r: ResultadoEliminacion; porSolicitud: Map<number, SolicitudEliminacion> } | null>(null)

  const datos = useQuery({
    queryKey: CLAVE_ELIMINACIONES,
    queryFn: async () => {
      const [pendientes, historial] = await Promise.all([
        listarEliminacionesPendientes(),
        listarHistorialEliminaciones(LIMITE_HISTORIAL),
      ])
      return { pendientes, historial }
    },
    staleTime: 0,
  })
  const pendientes = useMemo(() => datos.data?.pendientes ?? [], [datos.data])
  const historial = datos.data?.historial ?? []

  // Si una solicitud ya no está (la resolvió otro administrador), sale de la selección.
  const sel = useMemo(() => {
    const vigentes = new Set(pendientes.map((s) => s.id))
    return new Set([...selMarcada].filter((id) => vigentes.has(id)))
  }, [selMarcada, pendientes])
  const setSel = setSelMarcada

  const alternar = (ids: number[], marcar: boolean) =>
    setSel((a) => {
      const b = new Set(a)
      for (const id of ids) {
        if (marcar) b.add(id)
        else b.delete(id)
      }
      return b
    })

  const abrirResolver = (aprobar: boolean) => {
    const elegidas = pendientes.filter((s) => sel.has(s.id))
    if (elegidas.length && !trabajando) setDialogo({ aprobar, elegidas })
  }

  const resolver = async (aprobar: boolean, elegidas: SolicitudEliminacion[], nota: string) => {
    setDialogo(null)
    setTrabajando(true)
    try {
      const r = await resolverEliminaciones(
        elegidas.map((s) => s.id),
        aprobar,
        nota || null,
      )
      // Aprobadas o restauradas: la lista de pólizas cambió en cualquier caso.
      qc.invalidateQueries({ queryKey: ['polizas'] })
      qc.invalidateQueries({ queryKey: CLAVE_CONTEO_ELIMINACIONES })
      // Las que no se pudieron procesar quedan seleccionadas para reintentar.
      setSel(new Set(r.omitidas.map((o) => o.id)))
      await datos.refetch()
      if (r.omitidas.length === 0) {
        toast.success(mensajeResueltas(aprobar, r.hechas))
      } else {
        setParcial({ aprobar, r, porSolicitud: new Map(elegidas.map((s) => [s.id, s])) })
      }
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudo completar la acción'))
    } finally {
      setTrabajando(false)
    }
  }

  const todas = pendientes.length
  const estadoTodas: boolean | 'parcial' = sel.size === 0 ? false : sel.size === todas ? true : 'parcial'

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo="Eliminaciones por autorizar"
        volver="/polizas"
        acciones={
          <Boton variante="fantasma" tamano="icono" title="Recargar" onClick={() => datos.refetch()} disabled={datos.isFetching || trabajando}>
            <RefreshCw className={datos.isFetching ? 'animate-spin' : ''} />
          </Boton>
        }
      />
      <Contenido className="flex max-w-4xl flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Chip activo={!verHistorial} onClick={() => setVerHistorial(false)}>
            <ListChecks />
            Por autorizar ({pendientes.length})
          </Chip>
          <Chip activo={verHistorial} onClick={() => setVerHistorial(true)}>
            <History />
            Historial ({historial.length}
            {historial.length >= LIMITE_HISTORIAL ? '+' : ''})
          </Chip>
        </div>

        {datos.isError ? (
          <MensajeError
            error={
              <div className="flex items-center gap-3">
                <span className="flex-1">{mensajeAmigable(datos.error, 'No se pudieron cargar las solicitudes')}</span>
                <Boton tamano="sm" variante="secundario" onClick={() => datos.refetch()}>
                  Reintentar
                </Boton>
              </div>
            }
          />
        ) : datos.isPending ? (
          <Cargando texto="Cargando solicitudes…" />
        ) : verHistorial ? (
          <VistaHistorial historial={historial} />
        ) : pendientes.length === 0 ? (
          <Vacio
            icono={<CheckCircle2 />}
            titulo="No hay eliminaciones por autorizar"
            detalle="Cuando alguien marque una póliza para eliminar, aparecerá aquí."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <CasillaTri
                estado={estadoTodas}
                disabled={trabajando}
                etiqueta="Seleccionar todas las solicitudes"
                onCambio={() => (sel.size === todas ? setSel(new Set()) : setSel(new Set(pendientes.map((s) => s.id))))}
              />
              <span className="text-[13px]">
                {sel.size === 0
                  ? 'Marque las pólizas, o un lote completo, para decidir'
                  : plural(sel.size, 'seleccionada', 'seleccionadas')}
              </span>
              <Boton variante="peligro" tamano="sm" disabled={sel.size === 0 || trabajando} onClick={() => abrirResolver(true)}>
                <Trash2 />
                Autorizar eliminación ({sel.size})
              </Boton>
              <Boton variante="secundario" tamano="sm" disabled={sel.size === 0 || trabajando} onClick={() => abrirResolver(false)}>
                <Undo2 />
                Rechazar y restaurar ({sel.size})
              </Boton>
            </div>
            <div className="flex flex-col gap-3 pb-6">
              {agruparPorLote(pendientes).map((items) => (
                <TarjetaLote key={items[0].lote} items={items} sel={sel} trabajando={trabajando} alternar={alternar} />
              ))}
            </div>
          </>
        )}
      </Contenido>

      {dialogo && (
        <DialogoResolver
          aprobar={dialogo.aprobar}
          elegidas={dialogo.elegidas}
          onCancelar={() => setDialogo(null)}
          onAceptar={(nota) => resolver(dialogo.aprobar, dialogo.elegidas, nota)}
        />
      )}

      {parcial && (
        <Dialogo
          abierto
          onCerrar={() => setParcial(null)}
          titulo={tituloOmitidasResolver(parcial.aprobar, parcial.r.hechas, parcial.r.omitidas.length)}
          pie={
            <Boton autoFocus onClick={() => setParcial(null)}>
              Entendido
            </Boton>
          }
        >
          <ul className="flex flex-col gap-3">
            {parcial.r.omitidas.map((o) => {
              const s = parcial.porSolicitud.get(o.id)
              return (
                <li key={o.id}>
                  <div className="font-semibold">
                    Cód. {s?.polizaId ?? o.id} · {s?.nroPoliza ?? 'sin número'}
                  </div>
                  <div className="text-ink-soft">{o.razon}</div>
                </li>
              )
            })}
          </ul>
        </Dialogo>
      )}
    </div>
  )
}

/** Botón "Ver detalle": trae la póliza completa y la muestra en un diálogo de solo lectura. */
function BotonDetalle({ polizaId, titulo }: { polizaId: number; titulo: string }) {
  const [datos, setDatos] = useState<Record<string, unknown> | null>(null)
  const [cargando, setCargando] = useState(false)
  const abrir = async () => {
    setCargando(true)
    try {
      const d = await obtenerDetalleEliminacion(polizaId)
      if (d) setDatos(d)
      else toast.error('Ya no hay datos guardados de esta póliza.')
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudo abrir el detalle'))
    } finally {
      setCargando(false)
    }
  }
  return (
    <>
      <Boton
        variante="fantasma"
        tamano="sm"
        cargando={cargando}
        onClick={(e) => {
          // Dentro de una fila con casilla: no debe marcarla.
          e.preventDefault()
          e.stopPropagation()
          void abrir()
        }}
      >
        {!cargando && <Eye />}
        Ver detalle
      </Boton>
      {datos && <DialogoDetalle titulo={titulo} datos={datos} onCerrar={() => setDatos(null)} />}
    </>
  )
}

function TarjetaLote({
  items,
  sel,
  trabajando,
  alternar,
}: {
  items: SolicitudEliminacion[]
  sel: Set<number>
  trabajando: boolean
  alternar: (ids: number[], marcar: boolean) => void
}) {
  const primera = items[0]
  const ids = items.map((s) => s.id)
  const marcadas = ids.filter((id) => sel.has(id)).length
  const conPagos = items.filter((s) => s.nPagos > 0).length
  return (
    <Tarjeta>
      <div className="flex items-start gap-3 border-b border-line px-3 py-2.5">
        <div className="pt-0.5">
          <CasillaTri
            estado={marcadas === 0 ? false : marcadas === ids.length ? true : 'parcial'}
            disabled={trabajando}
            etiqueta="Seleccionar todo el lote"
            onCambio={() => alternar(ids, marcadas !== ids.length)}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold">
            {plural(items.length, 'póliza', 'pólizas')}
            {conPagos > 0 ? ` (${conPagos} con pagos)` : ''} · pedido por {primera.solicitadoPor}
            {primera.solicitadoEn ? ` el ${cuando(primera.solicitadoEn)}` : ''}
          </div>
          <div className="text-[12.5px] text-ink-soft">Motivo: {primera.motivo}</div>
        </div>
      </div>
      <ul className="divide-y divide-line/70">
        {items.map((s) => {
          const marcada = sel.has(s.id)
          return (
            <li key={s.id}>
              <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-navy-soft/40">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-navy"
                  aria-label={`Seleccionar la póliza ${s.nroPoliza ?? s.polizaId}`}
                  checked={marcada}
                  disabled={trabajando}
                  onChange={(e) => alternar([s.id], e.target.checked)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 text-[15px] font-bold">{s.cliente ?? 'Sin cliente'}</div>
                    <BotonDetalle polizaId={s.polizaId} titulo={`Detalle · Cód. ${s.polizaId} · ${s.nroPoliza ?? 'sin número'}`} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-7 gap-y-2">
                    <Dato etiqueta="N.º de póliza" valor={s.nroPoliza ?? 'sin número'} mono={!!s.nroPoliza} />
                    {s.aseguradora && <Dato etiqueta="Aseguradora" valor={s.aseguradora} />}
                    {s.ramo && <Dato etiqueta="Ramo" valor={s.ramo} />}
                    <Dato etiqueta="Prima" valor={s.prima ? fmtDinero(s.prima) : '—'} mono />
                    {s.fini && s.ffin && <Dato etiqueta="Vigencia" valor={`${dia(s.fini)} – ${dia(s.ffin)}`} mono />}
                    <Dato etiqueta="Código" valor={String(s.polizaId)} mono />
                  </div>
                  {s.nPagos > 0 && (
                    <div className="mt-1 flex items-start gap-1.5 text-[12px] font-semibold text-warning-ink">
                      <Wallet className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        Tiene {plural(s.nPagos, 'pago', 'pagos')}: para poder borrarla hay que moverlos a la póliza correcta.
                        Mientras tanto puede rechazarla para restaurarla.
                      </span>
                    </div>
                  )}
                </div>
              </label>
            </li>
          )
        })}
      </ul>
    </Tarjeta>
  )
}

/** Dato con su etiqueta encima (mismo formato que la bandeja de pendientes). */
function Dato({ etiqueta, valor, mono = false }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-ink-soft">{etiqueta}</div>
      <div className={`text-[13px] font-semibold ${mono ? 'num' : ''}`}>{valor}</div>
    </div>
  )
}

function Origen({ icono, children }: { icono: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] text-ink-soft [&_svg]:size-3.5 [&_svg]:shrink-0">
      {icono}
      <span className="truncate">{children}</span>
    </span>
  )
}

/**
 * Tarjeta del historial, en tres niveles como las pendientes:
 *  1. Número de póliza y resultado.  2. Datos clave con etiqueta.  3. Quién pidió y quién resolvió.
 */
function VistaHistorial({ historial }: { historial: HistorialEliminacion[] }) {
  if (historial.length === 0) {
    return <Vacio titulo="Todavía no hay eliminaciones resueltas." />
  }
  return (
    <div className="flex flex-col gap-2 pb-6">
      {historial.map((h) => {
        const aprobada = h.estado === 'aprobada'
        const tono = aprobada ? 'bg-danger-soft text-danger' : 'bg-green-soft text-green-ink'
        return (
          <Tarjeta key={h.id} className="flex items-start gap-3.5 px-4 py-3">
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5 ${tono}`}>
              {aprobada ? <Trash2 /> : <Undo2 />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2.5">
                <div className="min-w-0 flex-1 text-[15px] font-bold">{h.nroPoliza ?? 'Sin número de póliza'}</div>
                <BotonDetalle polizaId={h.polizaId} titulo={`Detalle · Cód. ${h.polizaId} · ${h.nroPoliza ?? 'sin número'}`} />
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${tono}`}>
                  {aprobada ? 'Eliminada' : 'Rechazada: volvió a las listas'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-7 gap-y-2">
                <Dato etiqueta="Código" valor={String(h.polizaId)} mono />
                {h.prima ? <Dato etiqueta="Prima" valor={fmtDinero(h.prima)} mono /> : null}
                <Dato etiqueta="Motivo" valor={h.motivo || '—'} />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-[18px] gap-y-1 border-t border-line pt-2">
                <Origen icono={<UserRound />}>
                  Pedido por {h.solicitadoPor}
                  {h.solicitadoEn ? <> el <span className="num">{cuando(h.solicitadoEn)}</span></> : null}
                </Origen>
                <Origen icono={<Clock />}>
                  {aprobada ? 'Autorizada' : 'Rechazada'} por {h.resueltoPor}
                  {h.resueltoEn ? <> el <span className="num">{cuando(h.resueltoEn)}</span></> : null}
                </Origen>
              </div>
              {h.nota && <p className="mt-2 text-[12.5px] text-ink-soft">Nota: {h.nota}</p>}
            </div>
          </Tarjeta>
        )
      })}
    </div>
  )
}

/** Confirmación al autorizar (exige escribir ELIMINAR) o rechazar. Entrega la nota ('' si no hay). */
function DialogoResolver({
  aprobar,
  elegidas,
  onCancelar,
  onAceptar,
}: {
  aprobar: boolean
  elegidas: SolicitudEliminacion[]
  onCancelar: () => void
  onAceptar: (nota: string) => void
}) {
  const [nota, setNota] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const n = elegidas.length
  const conPagos = elegidas.filter((s) => s.nPagos > 0).length
  const valido = !aprobar || confirmacionValida(confirmar)
  const aceptar = () => {
    if (valido) onAceptar(nota.trim())
  }

  return (
    <Dialogo
      abierto
      onCerrar={onCancelar}
      ancho="lg"
      titulo={
        aprobar
          ? `Autorizar la eliminación de ${plural(n, 'póliza', 'pólizas')}`
          : `Rechazar y restaurar ${plural(n, 'póliza', 'pólizas')}`
      }
      pie={
        <>
          <Boton variante="secundario" onClick={onCancelar}>
            Cancelar
          </Boton>
          <Boton variante={aprobar ? 'peligro' : 'primario'} disabled={!valido} onClick={aceptar}>
            {aprobar ? 'Eliminar para siempre' : 'Rechazar y restaurar'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p>
          {aprobar
            ? 'Se borrarán para siempre. Guardamos una copia de sus datos en el registro de eliminaciones.'
            : 'Volverán a aparecer en las listas, las estadísticas y los dashboards, como estaban.'}
        </p>
        {aprobar && conPagos > 0 && (
          <Aviso tono="alerta">
            {conPagos} de {n} {conPagos === 1 ? 'tiene pagos y no se borrará' : 'tienen pagos y no se borrarán'}: seguirán
            marcadas hasta que se muevan los pagos, o puede rechazarlas para restaurarlas.
          </Aviso>
        )}
        <ul className="max-h-[130px] divide-y divide-line overflow-y-auto rounded-[10px] border border-line px-2.5 py-1">
          {elegidas.map((s) => (
            <li key={s.id} className="truncate py-0.5 text-[12.5px]">
              Cód. {s.polizaId} · {s.nroPoliza ?? 'sin número'}
              {s.cliente ? ` · ${s.cliente}` : ''}
            </li>
          ))}
        </ul>
        <Campo etiqueta="Nota (opcional)">
          <AreaTexto
            autoFocus={!aprobar}
            rows={1}
            maxLength={300}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </Campo>
        {aprobar && (
          <Campo etiqueta="Para confirmar, escriba ELIMINAR">
            <Input
              autoFocus
              autoComplete="off"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') aceptar()
              }}
            />
          </Campo>
        )}
      </div>
    </Dialogo>
  )
}
