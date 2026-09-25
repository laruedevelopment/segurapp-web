import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Receipt, ReceiptText, Save } from 'lucide-react'
import { Cargando } from '@/components/ui/basicos'
import { Buscador } from '@/components/ui/buscador'
import { Boton } from '@/components/ui/button'
import { AreaTexto, Campo, Input, InputNumero, SelectorSimple } from '@/components/ui/campos'
import { Dialogo } from '@/components/ui/dialogo'
import { InputFecha } from '@/components/ui/fecha'
import { ESTADOS_PAGO, actualizarAbono, crearAbono, type AbonoPoliza, type DatosAbono } from '@/datos/pagos'
import { obtenerPoliza } from '@/datos/polizas'
import { aFecha, aISO, hoy } from '@/lib/fechas'
import { fmtDinero } from '@/lib/numeros'
import type { PolizaLista } from '@/lib/tipos'
import { mensajeError } from '@/lib/utils'
import { a2Decimales, buscarPolizasParaAbono, etiquetaPoliza, trasCambiarAbonos } from './comun'

const OPCIONES_ESTADO = Object.entries(ESTADOS_PAGO).map(([valor, etiqueta]) => ({ valor, etiqueta }))

/**
 * Añadir o editar un abono (una póliza dentro del reporte). Al elegir la
 * póliza sugiere el saldo pendiente (no la prima completa) y calcula la
 * comisión con el %, salvo que la comisión se haya escrito a mano.
 * Se permiten valores negativos (reversiones, devoluciones).
 */
export function DialogoAbono({
  abierto,
  idReporte,
  abono,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  idReporte: number
  /** Null = abono nuevo. */
  abono: AbonoPoliza | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  return (
    <Dialogo
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={abono ? 'Editar abono' : 'Añadir póliza al reporte'}
      ancho="lg"
    >
      {abierto && (
        <FormularioAbono key={abono?.id ?? 'nuevo'} idReporte={idReporte} abono={abono} onCerrar={onCerrar} onGuardado={onGuardado} />
      )}
    </Dialogo>
  )
}

function FormularioAbono({
  idReporte,
  abono,
  onCerrar,
  onGuardado,
}: {
  idReporte: number
  abono: AbonoPoliza | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const qc = useQueryClient()
  const esNuevo = abono == null
  const [poliza, setPoliza] = useState<PolizaLista | null>(null)
  const [cargandoPoliza, setCargandoPoliza] = useState(!esNuevo)
  const [fechaPago, setFechaPago] = useState<Date | null>(abono ? aFecha(abono.fecha_pago) ?? hoy() : hoy())
  const [estadoPago, setEstadoPago] = useState<string>(abono?.estado_pago ?? 'R')
  const [prima, setPrima] = useState<number | null>(abono?.vlrprima_poliza ?? null)
  const [valorAbono, setValorAbono] = useState<number | null>(abono?.vlrabono_prima ?? null)
  const [porcCom, setPorcCom] = useState<number | null>(abono?.porccomision ?? null)
  const [vlrCom, setVlrCom] = useState<number | null>(abono?.vlrcomision ?? null)
  const [porcAd, setPorcAd] = useState<number | null>(abono?.porccomad ?? null)
  const [vlrAd, setVlrAd] = useState<number | null>(abono?.vlrcomad ?? null)
  const [factura, setFactura] = useState(abono?.num_factura ?? '')
  const [obs, setObs] = useState(abono?.obs_pago ?? '')
  // Si se escribió la comisión (ej. la cifra exacta del reporte de la
  // aseguradora), cambiar el abono o el % ya no la pisa. Al editar un abono
  // existente sus comisiones se respetan desde el principio.
  const [comAMano, setComAMano] = useState(!esNuevo)
  const [comAdAMano, setComAdAMano] = useState(!esNuevo)
  const [intentoGuardar, setIntentoGuardar] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abono) return
    let vigente = true
    obtenerPoliza(abono.id_poliza)
      .then((p) => {
        if (vigente && p) setPoliza(p)
      })
      .catch(() => {})
      .finally(() => {
        if (vigente) setCargandoPoliza(false)
      })
    return () => {
      vigente = false
    }
  }, [abono])

  /** Comisiones calculadas con abono × % (las escritas a mano se respetan). */
  const recalcular = (
    v: { abono: number | null; pCom: number | null; pAd: number | null },
    manual = { com: comAMano, ad: comAdAMano },
  ) => {
    const ab = v.abono ?? 0
    if (!manual.com) setVlrCom(a2Decimales((ab * (v.pCom ?? 0)) / 100))
    if (!manual.ad) setVlrAd(a2Decimales((ab * (v.pAd ?? 0)) / 100))
  }

  const alElegirPoliza = (p: PolizaLista | null) => {
    if (!p) return
    setPoliza(p)
    const primaP = p.prima_poliza ?? 0
    setPrima(a2Decimales(primaP))
    // Sugiere lo que falta por pagar, no la prima completa: con pagos
    // previos, la prima completa sería un sobrepago.
    const saldo = primaP - (p.vlrprimapagada_poliza ?? 0)
    const nuevoAbono = saldo > 0 ? a2Decimales(saldo) : null
    setValorAbono(nuevoAbono)
    const pCom = Number((p.porccom_poliza ?? 0).toFixed(5))
    setPorcCom(pCom)
    recalcular({ abono: nuevoAbono, pCom, pAd: porcAd })
  }

  const errorPrima = intentoGuardar && prima == null ? 'Requerido' : null
  const errorAbono = intentoGuardar && valorAbono == null ? 'Requerido' : null
  const errorPoliza = intentoGuardar && esNuevo && !poliza ? 'Seleccione una póliza' : null

  const guardar = async () => {
    setIntentoGuardar(true)
    if (prima == null || valorAbono == null) return
    if (!poliza) {
      toast.error('Seleccione una póliza')
      return
    }
    setGuardando(true)
    try {
      const datos: DatosAbono = {
        idrep_pago: idReporte,
        id_poliza: poliza.id,
        fecha_pago: aISO(fechaPago),
        vlrprima_poliza: prima ?? 0,
        vlrabono_prima: valorAbono ?? 0,
        porccomision: porcCom ?? 0,
        vlrcomision: vlrCom ?? 0,
        porccomad: porcAd ?? 0,
        vlrcomad: vlrAd ?? 0,
        num_factura: factura.trim() || null,
        estado_pago: estadoPago,
        obs_pago: obs.trim() || null,
      }
      if (esNuevo) await crearAbono(datos)
      else await actualizarAbono(abono.id, datos)
      // Lo pagado y el estado de la póliza los recalcula la base. Si se
      // cambió de póliza, también la anterior.
      await trasCambiarAbonos(qc, abono ? [poliza.id, abono.id_poliza] : [poliza.id])
      onGuardado()
    } catch (e) {
      toast.error(`Error: ${mensajeError(e)}`)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {esNuevo && (
        <Campo etiqueta="Buscar y seleccionar póliza" obligatorio error={errorPoliza}>
          <Buscador<PolizaLista>
            valor={poliza}
            onCambio={alElegirPoliza}
            buscar={(q) => buscarPolizasParaAbono(q)}
            etiqueta={etiquetaPoliza}
            detalle={(p) => `${p.nombre_ramo ?? ''}  |  ${p.bien_asegurado ?? ''}`}
            clave={(p) => p.id}
            placeholder="Nro. de póliza, cliente, documento…"
            permitirVacio={false}
            error={!!errorPoliza}
          />
        </Campo>
      )}

      {cargandoPoliza ? (
        <Cargando className="py-4" texto="Cargando póliza…" />
      ) : (
        poliza && (
          <div className="rounded-[10px] border border-navy/20 bg-navy-soft/50 p-3 text-[12.5px]">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-navy">
              <ReceiptText className="size-3.5" />
              Póliza seleccionada
            </div>
            <Dato etiqueta="Póliza" valor={poliza.nro_poliza ?? String(poliza.id)} />
            <Dato etiqueta="Cliente" valor={poliza.nombre_cliente} />
            <Dato etiqueta="Ramo" valor={poliza.nombre_ramo} />
            <Dato etiqueta="Producto" valor={poliza.nombre_prod} />
            <Dato etiqueta="Bien asegurado" valor={poliza.bien_asegurado} />
            <Dato etiqueta="Prima póliza" valor={fmtDinero(poliza.prima_poliza ?? 0)} />
            {!!poliza.vlrprimapagada_poliza && <Dato etiqueta="Prima ya pagada" valor={fmtDinero(poliza.vlrprimapagada_poliza)} />}
          </div>
        )
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Fecha de pago" obligatorio>
          <InputFecha valor={fechaPago} onCambio={setFechaPago} />
        </Campo>
        <Campo etiqueta="Estado">
          <SelectorSimple valor={estadoPago} onCambio={(v) => setEstadoPago(v ?? 'R')} opciones={OPCIONES_ESTADO} />
        </Campo>
        <Campo etiqueta="Vlr. prima póliza" obligatorio error={errorPrima}>
          <InputNumero valor={prima} onCambio={setPrima} prefijo="$" />
        </Campo>
        <Campo etiqueta="Vlr. abono prima" obligatorio error={errorAbono}>
          <InputNumero
            valor={valorAbono}
            onCambio={(v) => {
              setValorAbono(v)
              recalcular({ abono: v, pCom: porcCom, pAd: porcAd })
            }}
            prefijo="$"
            className="[&_input]:bg-navy-soft/30"
          />
        </Campo>
        <Campo etiqueta="% Comisión">
          <InputNumero
            valor={porcCom}
            maxDecimales={5}
            onCambio={(v) => {
              setPorcCom(v)
              recalcular({ abono: valorAbono, pCom: v, pAd: porcAd })
            }}
            sufijo="%"
          />
        </Campo>
        <Campo etiqueta="Vlr. comisión" ayuda={comAMano ? undefined : 'Se calcula con abono × %.'}>
          <InputNumero
            valor={vlrCom}
            onCambio={(v) => {
              setComAMano(true)
              setVlrCom(v)
            }}
            prefijo="$"
          />
        </Campo>
        <Campo etiqueta="% Com. adicional">
          <InputNumero
            valor={porcAd}
            maxDecimales={5}
            onCambio={(v) => {
              setPorcAd(v)
              recalcular({ abono: valorAbono, pCom: porcCom, pAd: v })
            }}
            sufijo="%"
          />
        </Campo>
        <Campo etiqueta="Vlr. com. adicional">
          <InputNumero
            valor={vlrAd}
            onCambio={(v) => {
              setComAdAMano(true)
              setVlrAd(v)
            }}
            prefijo="$"
          />
        </Campo>
      </div>
      <Campo etiqueta="N.° factura">
        <div className="relative">
          <Receipt className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
          <Input className="pl-9" value={factura} onChange={(e) => setFactura(e.target.value)} />
        </div>
      </Campo>
      <Campo etiqueta="Observaciones">
        <AreaTexto rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
      </Campo>

      <div className="-mx-5 -mb-4 mt-1 flex justify-end gap-2 border-t border-line px-5 py-3">
        <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Boton>
        <Boton onClick={guardar} cargando={guardando}>
          {!guardando && <Save />}
          {esNuevo ? 'Añadir' : 'Actualizar'}
        </Boton>
      </div>
    </div>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <div className="flex gap-2 py-px">
      <span className="w-28 shrink-0 font-semibold">{etiqueta}:</span>
      <span className="min-w-0 flex-1 truncate">{valor || '—'}</span>
    </div>
  )
}
