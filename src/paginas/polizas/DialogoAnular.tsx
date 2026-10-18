import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Ban } from 'lucide-react'
import { Cargando, MensajeError } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { Dialogo } from '@/components/ui/dialogo'
import { CLAVE_CASOS } from '@/datos/casos'
import { anularAbonos, etiquetaEstadoPago, listarAbonosDePoliza, type AbonoPoliza } from '@/datos/pagos'
import { actualizarPoliza, obtenerPoliza } from '@/datos/polizas'
import { fmtDinero } from '@/lib/numeros'
import { useSesion, veComisiones } from '@/lib/sesion'
import type { Poliza } from '@/lib/tipos'
import { causaAmigable, mensajeAmigable } from '@/lib/errores'
import { trasCambiarAbonos } from '@/paginas/comisiones/comun'
import { ESTADO_ANULADA, alternarMarca, idsAAnular, mensajeAnulacion, textoPago, yaAnulado } from './anularLogica'

interface Datos {
  poliza: Poliza | null
  abonos: AbonoPoliza[]
}

/**
 * Marca una póliza como ANULADA (estado 'A') después de mostrar sus datos y,
 * para los roles que ven pagos (A y S), la lista de sus pagos con una casilla
 * por pago: los marcados pasan a estado Anulada (dejan de sumar en los totales
 * pero quedan como historial); los demás se dejan como están. No borra nada.
 * Se revierte cambiando el estado en el formulario de la póliza.
 *
 * Uso: `<DialogoAnular idPoliza={id} onCerrar={(cambio) => …} />`; con
 * `idPoliza` en null no se muestra. `onCerrar(true)` = algo cambió (o la póliza
 * ya estaba anulada), para que quien lo usa recargue su pantalla.
 */
export function DialogoAnular({
  idPoliza,
  onCerrar,
}: {
  idPoliza: number | null
  onCerrar: (cambio: boolean) => void
}) {
  if (idPoliza == null) return null
  return <ContenidoAnular key={idPoliza} idPoliza={idPoliza} onCerrar={onCerrar} />
}

function ContenidoAnular({ idPoliza, onCerrar }: { idPoliza: number; onCerrar: (cambio: boolean) => void }) {
  const qc = useQueryClient()
  const usuario = useSesion()?.usuario
  // Los pagos solo los ven y editan A y S (la base los oculta al Digitador).
  const verPagos = veComisiones(usuario)
  const [marcados, setMarcados] = useState<ReadonlySet<number>>(new Set())
  const [guardando, setGuardando] = useState(false)

  const consulta = useQuery({
    queryKey: ['anular-poliza', idPoliza],
    queryFn: async (): Promise<Datos> => {
      const poliza = await obtenerPoliza(idPoliza)
      if (!poliza || poliza.estado_poliza_id === ESTADO_ANULADA) return { poliza, abonos: [] }
      return { poliza, abonos: verPagos ? await listarAbonosDePoliza(idPoliza) : [] }
    },
    gcTime: 0,
    staleTime: 0,
    retry: false,
  })

  // Póliza inexistente o ya anulada: se avisa y se cierra sin mostrar el diálogo.
  const avisado = useRef(false)
  useEffect(() => {
    if (!consulta.isSuccess || avisado.current) return
    const { poliza } = consulta.data
    if (!poliza) {
      avisado.current = true
      toast.error(`No se encontró la póliza cód. ${idPoliza}`)
      onCerrar(false)
    } else if (poliza.estado_poliza_id === ESTADO_ANULADA) {
      avisado.current = true
      toast.info(`La póliza cód. ${idPoliza} ya está anulada.`)
      onCerrar(true)
    }
  }, [consulta.isSuccess, consulta.data, idPoliza, onCerrar])

  useEffect(() => {
    if (!consulta.isError || avisado.current) return
    avisado.current = true
    toast.error(mensajeAmigable(consulta.error, 'No se pudo preparar la anulación'))
    onCerrar(false)
  }, [consulta.isError, consulta.error, onCerrar])

  const poliza = consulta.data?.poliza ?? null
  const abonos = consulta.data?.abonos ?? []
  const listo = consulta.isSuccess && !!poliza && poliza.estado_poliza_id !== ESTADO_ANULADA

  const anular = async () => {
    if (!poliza || guardando) return
    setGuardando(true)
    try {
      await actualizarPoliza(idPoliza, { estado_poliza_id: ESTADO_ANULADA })
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudo anular la póliza'))
      setGuardando(false)
      return
    }
    try {
      const { hechos, fallidos } = await anularAbonos(idsAAnular(marcados, abonos))
      toast[fallidos > 0 ? 'error' : 'success'](mensajeAnulacion(hechos, fallidos))
      await Promise.all([trasCambiarAbonos(qc, [idPoliza]), qc.invalidateQueries({ queryKey: CLAVE_CASOS })])
    } catch (e) {
      toast.error(mensajeAmigable(e, 'La póliza se anuló, pero no se pudo actualizar la pantalla'))
    } finally {
      setGuardando(false)
      onCerrar(true)
    }
  }

  return (
    <Dialogo
      abierto={listo || consulta.isPending}
      onCerrar={() => !guardando && onCerrar(false)}
      titulo="Anular póliza"
      ancho="md"
      pie={
        listo && (
          <>
            <Boton variante="secundario" onClick={() => onCerrar(false)} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton variante="peligro" onClick={anular} cargando={guardando}>
              {!guardando && <Ban />}
              Anular póliza
            </Boton>
          </>
        )
      }
    >
      {consulta.isPending ? (
        <Cargando className="py-6" texto="Cargando póliza…" />
      ) : consulta.isError ? (
        <MensajeError error={causaAmigable(consulta.error, 'No se pudo cargar la póliza')} />
      ) : (
        poliza && (
          <div className="flex flex-col gap-3 text-[13.5px]">
            <p className="whitespace-pre-line">
              {`Póliza cód. ${idPoliza} · ${poliza.nro_poliza ?? '—'}\n${poliza.nombre_cliente ?? ''}\nPrima: ${fmtDinero(poliza.prima_poliza ?? 0)}\n\n`}
              Se marca como ANULADA; no se borra nada. Se puede revertir cambiando el estado desde el formulario de la
              póliza.
            </p>
            {abonos.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[13px] leading-snug text-ink-soft">
                  Pagos de esta póliza ({abonos.length}). Marque los que también quiere anular (dejan de sumar en los
                  totales, pero quedan como historial). Los que no marque se dejan como están.
                </p>
                <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-[10px] border border-line">
                  {abonos.map((a) => (
                    <li key={a.id} className="px-3 py-2">
                      {yaAnulado(a) ? (
                        <div className="flex items-start gap-2 text-ink-soft">
                          <Ban className="mt-0.5 size-4 shrink-0" />
                          <div>
                            <div>{textoPago(a)}</div>
                            <div className="text-[12px]">Ya está anulado</div>
                          </div>
                        </div>
                      ) : (
                        <label className="flex cursor-pointer items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1 size-4 accent-navy"
                            checked={marcados.has(a.id)}
                            disabled={guardando}
                            onChange={(e) => setMarcados((m) => alternarMarca(m, a.id, e.target.checked))}
                          />
                          <div>
                            <div>{textoPago(a)}</div>
                            <div className="text-[12px] text-ink-soft">
                              Comisión {fmtDinero(a.vlrcomision ?? 0)} · {etiquetaEstadoPago(a.estado_pago)}
                            </div>
                          </div>
                        </label>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      )}
    </Dialogo>
  )
}
