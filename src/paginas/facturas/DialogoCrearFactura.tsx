import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Aviso, Cargando, MensajeError } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { Buscador } from '@/components/ui/buscador'
import { AreaTexto, Campo, InputNumero } from '@/components/ui/campos'
import { Dialogo } from '@/components/ui/dialogo'
import { InputFecha } from '@/components/ui/fecha'
import { crearFactura, siguienteNumeroFactura, useConfigFacturacion, useEmpresas } from '@/datos/facturas'
import {
  calcularMontos,
  comisionDeLinea,
  empresasParaAseguradora,
  lineaFacturable,
  validarFactura,
  type EmpresaAseguradora,
} from '@/datos/facturasLogica'
import { listarAbonosDeReporte, type AbonoPoliza } from '@/datos/pagos'
import { aFecha, aISO, fmtFecha } from '@/lib/fechas'
import { mensajeAmigable } from '@/lib/errores'
import { fmtDinero } from '@/lib/numeros'

/**
 * Crea la factura de un reporte: elige las líneas que entran, la empresa
 * aseguradora (por NIT) y los porcentajes (traen los valores por defecto).
 */
export function DialogoCrearFactura({
  reporteId,
  asegId,
  intermId,
  onCerrar,
  onCreada,
}: {
  reporteId: number
  asegId: number
  intermId: number | null
  onCerrar: () => void
  onCreada: (idFactura: number) => void
}) {
  const abonos = useQuery({ queryKey: ['facturas', 'dialogo', reporteId], queryFn: () => listarAbonosDeReporte(reporteId), staleTime: 0 })
  const config = useConfigFacturacion()
  const empresas = useEmpresas()
  const numero = useQuery({ queryKey: ['facturas', 'siguiente'], queryFn: siguienteNumeroFactura, staleTime: 0, retry: false })

  const libres = useMemo(() => (abonos.data ?? []).filter(lineaFacturable), [abonos.data])
  const [elegidas, setElegidas] = useState<Set<number> | null>(null)
  const sel = elegidas ?? new Set(libres.map((a) => a.id))
  const [fecha, setFecha] = useState<Date | null>(() => new Date())
  const [empresa, setEmpresa] = useState<EmpresaAseguradora | null>(null)
  const [observacion, setObservacion] = useState('')
  const [iva, setIva] = useState<number | null>(null)
  const [rete, setRete] = useState<number | null>(null)
  const [ica, setIca] = useState<number | null>(null)
  const [reteiva, setReteiva] = useState<number | null>(0)
  const [intento, setIntento] = useState(false)
  const [guardando, setGuardando] = useState(false)

  // Los porcentajes empiezan con los valores por defecto (una sola vez).
  useEffect(() => {
    if (config.data && iva == null && rete == null && ica == null) {
      setIva(config.data.ivaPct)
      setRete(config.data.retePct)
      setIca(config.data.icaPct)
    }
  }, [config.data, iva, rete, ica])

  const lineas = libres.filter((a) => sel.has(a.id))
  const subtotal = Math.round(lineas.reduce((s, a) => s + comisionDeLinea(a), 0) * 100) / 100
  const m = calcularMontos(subtotal, iva ?? 0, rete ?? 0, ica ?? 0, reteiva ?? 0)
  const errores = validarFactura({ fecha, ivaPct: iva, retePct: rete, icaPct: ica, reteivaPct: reteiva, lineasElegidas: lineas.length, subtotal })
  const opciones = useMemo(() => empresasParaAseguradora(empresas.data ?? [], asegId), [empresas.data, asegId])

  const alternar = (id: number) => {
    const nuevo = new Set(sel)
    if (nuevo.has(id)) nuevo.delete(id)
    else nuevo.add(id)
    setElegidas(nuevo)
  }

  const crear = async () => {
    setIntento(true)
    if (Object.keys(errores).length > 0 || fecha == null) return
    setGuardando(true)
    try {
      const id = await crearFactura({
        asegId,
        intermId,
        empresaId: empresa?.id ?? null,
        fecha: aISO(fecha) ?? '',
        abonoIds: lineas.map((a) => a.id),
        observacion,
        ivaPct: iva ?? 0,
        retePct: rete ?? 0,
        icaPct: ica ?? 0,
        reteivaPct: reteiva ?? 0,
      })
      toast.success('Factura creada.')
      onCreada(id)
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudo crear la factura'))
      setGuardando(false)
    }
  }

  const fila = (a: AbonoPoliza) => (
    <label key={a.id} className="flex cursor-pointer items-start gap-2.5 px-2 py-1.5 hover:bg-navy-soft/40">
      <input type="checkbox" className="mt-1 size-4 accent-navy" checked={sel.has(a.id)} onChange={() => alternar(a.id)} aria-label={`Incluir la póliza ${a.nro_poliza ?? a.id}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold">
          {a.nro_poliza ?? 'sin número'} · {a.nombre_cliente ?? 'sin cliente'}
        </span>
        <span className="block text-[11.5px] text-ink-soft">
          {a.nombre_ramo ?? ''} {a.fecha_pago ? `· ${fmtFecha(aFecha(a.fecha_pago))}` : ''}
        </span>
      </span>
      <span className="num shrink-0 text-[13px] font-bold">{fmtDinero(comisionDeLinea(a))}</span>
    </label>
  )

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      ancho="lg"
      titulo={`Crear factura del reporte #${reporteId}`}
      descripcion={numero.data != null ? `Número que le tocará: ${numero.data}` : undefined}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton variante="verde" onClick={() => void crear()} cargando={guardando} disabled={abonos.isPending || libres.length === 0}>
            Crear factura
          </Boton>
        </>
      }
    >
      {abonos.isError ? (
        <MensajeError error={mensajeAmigable(abonos.error, 'No se pudieron cargar las líneas del reporte')} />
      ) : abonos.isPending ? (
        <Cargando texto="Cargando líneas…" />
      ) : libres.length === 0 ? (
        <Aviso tono="navy">Todas las líneas de este reporte ya tienen factura.</Aviso>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Fecha de la factura" obligatorio error={intento ? errores.fecha : null}>
              <InputFecha valor={fecha} onCambio={setFecha} error={intento && !!errores.fecha} />
            </Campo>
            <Campo etiqueta="Empresa aseguradora" ayuda="Se identifica por el NIT.">
              <Buscador<EmpresaAseguradora>
                valor={empresa}
                onCambio={(e) => {
                  setEmpresa(e)
                  // El IVA parte del que lleva la empresa; se puede cambiar después.
                  if (e) setIva(e.ivaPct)
                }}
                opciones={opciones}
                etiqueta={(e) => e.nombre}
                detalle={(e) => `NIT ${e.nit}`}
                clave={(e) => e.id}
                placeholder={empresas.isPending ? 'Cargando…' : opciones.length === 0 ? 'No hay empresas creadas (Ajustes)' : 'Seleccione…'}
              />
            </Campo>
          </div>

          <div className="rounded-xl border border-line">
            <div className="flex items-center justify-between border-b border-line bg-muted px-3 py-1.5 text-[12px] font-semibold text-ink-soft">
              <span>
                Líneas a facturar ({lineas.length} de {libres.length})
              </span>
              <button
                type="button"
                className="font-semibold text-navy underline"
                onClick={() => setElegidas(lineas.length === libres.length ? new Set() : new Set(libres.map((a) => a.id)))}
              >
                {lineas.length === libres.length ? 'Quitar todas' : 'Elegir todas'}
              </button>
            </div>
            <div className="max-h-56 divide-y divide-line/70 overflow-y-auto">{libres.map(fila)}</div>
          </div>
          {intento && errores.lineas && <p className="text-[12px] text-danger">{errores.lineas}</p>}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Campo etiqueta="IVA (%)">
              <InputNumero valor={iva} onCambio={setIva} permitirNegativos={false} sufijo="%" />
            </Campo>
            <Campo etiqueta="Retención en la fuente (%)">
              <InputNumero valor={rete} onCambio={setRete} permitirNegativos={false} sufijo="%" />
            </Campo>
            <Campo etiqueta="ICA (%)">
              <InputNumero valor={ica} onCambio={setIca} permitirNegativos={false} sufijo="%" />
            </Campo>
            <Campo etiqueta="Retención de IVA (%)">
              <InputNumero valor={reteiva} onCambio={setReteiva} permitirNegativos={false} sufijo="%" />
            </Campo>
          </div>
          {intento && errores.porcentajes && <p className="text-[12px] text-danger">{errores.porcentajes}</p>}

          <Campo etiqueta="Observación (opcional)">
            <AreaTexto rows={2} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
          </Campo>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl bg-muted px-4 py-3 text-[13px] sm:grid-cols-5">
            <Total etiqueta="Subtotal" valor={subtotal} />
            <Total etiqueta="IVA" valor={m.iva} />
            <Total etiqueta="Total" valor={m.total} />
            <Total etiqueta="Retenciones" valor={m.retefuente + m.ica + m.reteiva} />
            <Total etiqueta="A consignar" valor={m.neto} fuerte />
          </dl>
        </div>
      )}
    </Dialogo>
  )
}

function Total({ etiqueta, valor, fuerte = false }: { etiqueta: string; valor: number; fuerte?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-ink-soft">{etiqueta}</dt>
      <dd className={`num ${fuerte ? 'text-[15px] font-extrabold text-green-ink' : 'font-semibold'}`}>{fmtDinero(valor)}</dd>
    </div>
  )
}
