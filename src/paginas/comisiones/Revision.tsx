import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, Save } from 'lucide-react'
import { Aviso, Cargando, Etiqueta } from '@/components/ui/basicos'
import { Buscador } from '@/components/ui/buscador'
import { Boton } from '@/components/ui/button'
import { Campo, Input, InputNumero } from '@/components/ui/campos'
import { Dialogo } from '@/components/ui/dialogo'
import { InputFecha } from '@/components/ui/fecha'
import { buscarClientePorDoc } from '@/datos/catalogos'
import { crearAbono, listarAbonosDePoliza, listarAbonosDeReporte, type AbonoPoliza } from '@/datos/pagos'
import { listarPolizasDeCliente, listarPolizasPorNroContiene } from '@/datos/polizas'
import { aFecha, aISO, fmtFecha } from '@/lib/fechas'
import { fmtDinero, formatearNumCO, parseNumCO, sumarDinero } from '@/lib/numeros'
import type { PolizaLista } from '@/lib/tipos'
import { cn, mensajeError } from '@/lib/utils'
import {
  a2Decimales,
  buscarPolizasParaAbono,
  etiquetaPoliza,
  fechaIA,
  numIA,
  redondearCentavos,
  textoIA,
  trasCambiarAbonos,
} from './comun'
import { crearResultado, normalizarDoc, resolverMatch, seIncluyeSolo, type ResultadoMatch } from './matching'

type Match = ResultadoMatch<PolizaLista>

/** Una línea del documento importado, con sus valores editables. */
interface Fila {
  clave: number
  incluir: boolean
  poliza: PolizaLista | null
  match: Match
  /** Se eligió la póliza a mano (reemplaza el estado automático). */
  manual: boolean
  /** La comisión no venía en el reporte: se calculó con abono × %. */
  comisionCalculada: boolean
  /** Error al guardar esta línea (queda en pantalla para reintentar). */
  errorGuardado: string | null
  nroExtraido: string
  anexoExtraido: string
  docExtraido: string
  clienteExtraido: string
  prima: number | null
  abono: number | null
  porcCom: number | null
  vlrCom: number | null
  porcAd: number | null
  vlrAd: number | null
  factura: string
  fechaPago: Date | null
}

const sinValor = (f: Fila) => (f.abono ?? 0) === 0
const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const pct5 = (n: number | null) => (n == null ? null : parseNumCO(formatearNumCO(n, 5)))
const dinero2 = (n: number | null) => (n == null ? null : a2Decimales(n))

/**
 * Factura/recibo comparable: sin espacios ni separadores ni ceros a la
 * izquierda ("000123" = "123", "FE-12" = "FE12").
 */
const normalizarFactura = (s: string | null | undefined) => normalizarDoc(s ?? '').replace(/^0+(?=.)/, '')

/**
 * Motivo si en la base ya existe un abono igual (misma póliza, mismo valor
 * y misma factura — o misma fecha si no hay factura). Evita cargar dos
 * veces el mismo pago si se importa el reporte de nuevo.
 *
 * No compara contra otras líneas del mismo archivo: ahí líneas con igual
 * póliza, valor y transacción son movimientos distintos (ej. Mundial:
 * emisión +, reversión −, re-emisión + con distinto certificado).
 */
function duplicadoDe(f: Fila, abonosPorPoliza: Map<number, AbonoPoliza[]>): string | null {
  if (!f.poliza) return null
  const existentes = abonosPorPoliza.get(f.poliza.id)
  if (!existentes) return null
  const abono = f.abono ?? 0
  const factura = normalizarFactura(f.factura)
  for (const a of existentes) {
    if (Math.abs((a.vlrabono_prima ?? 0) - abono) >= 0.01) continue
    const fecha = aFecha(a.fecha_pago)
    const igual = factura
      ? normalizarFactura(a.num_factura) === factura
      : f.fechaPago != null && fecha != null && mismoDia(f.fechaPago, fecha)
    if (igual) {
      return (
        `Ya existe un abono igual para esta póliza (factura ${a.num_factura ?? '—'}` +
        `${fecha ? `, ${fmtFecha(fecha)}` : ''}). Parece un reporte ya cargado.`
      )
    }
  }
  return null
}

/**
 * Revisión de la importación de un reporte de comisiones: cruza cada línea
 * extraída con una póliza real y deja todo editable antes de crear los
 * abonos. Nunca guarda solo, y solo deja incluidas de entrada las líneas
 * con coincidencia segura. Se monta solo mientras está abierta.
 */
export function DialogoRevision({
  idReporte,
  lineas,
  aseguradoraId,
  onCerrar,
}: {
  idReporte: number
  lineas: Record<string, unknown>[]
  /** Aseguradora del reporte: descarta pólizas de otra con el mismo número. */
  aseguradoraId: number | null
  /** [creoAlgo]: se guardó al menos un abono. */
  onCerrar: (creoAlgo: boolean) => void
}) {
  const qc = useQueryClient()
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [filas, setFilas] = useState<Fila[]>([])
  const [abonosPrevios, setAbonosPrevios] = useState(0)
  const creoAlgo = useRef(false)
  const abonosPorPoliza = useRef(new Map<number, AbonoPoliza[]>())
  const [, setVersionAbonos] = useState(0)

  /** Trae (una vez) los abonos ya cargados de esa póliza, para detectar duplicados. */
  const asegurarAbonos = async (idPoliza: number) => {
    if (abonosPorPoliza.current.has(idPoliza)) return
    try {
      const a = await listarAbonosDePoliza(idPoliza)
      abonosPorPoliza.current.set(idPoliza, a)
      setVersionAbonos((v) => v + 1)
    } catch {
      /* sin la consulta no se puede marcar como duplicado */
    }
  }

  // ── Cruce inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    let vigente = true
    ;(async () => {
      try {
        const previos = await listarAbonosDeReporte(idReporte)
        if (vigente) setAbonosPrevios(previos.length)
      } catch {
        /* solo es un aviso */
      }

      // Las líneas de un mismo cliente o número comparten consultas.
      const cacheCliente = new Map<string, Promise<PolizaLista[]>>()
      const cacheNumero = new Map<string, Promise<PolizaLista[]>>()
      const polizasDelDocumento = async (docNorm: string) => {
        const cliente = await buscarClientePorDoc(docNorm)
        return cliente ? listarPolizasDeCliente(cliente.id) : []
      }

      const resolver = async (nro: string, anexo: string, doc: string, prima: number | null): Promise<Match> => {
        let porNumero: PolizaLista[] = []
        let delCliente: PolizaLista[] = []
        try {
          const busqueda = normalizarDoc(nro).replace(/^0+/, '')
          if (busqueda) {
            if (!cacheNumero.has(busqueda)) cacheNumero.set(busqueda, listarPolizasPorNroContiene(busqueda))
            porNumero = await cacheNumero.get(busqueda)!
          }
          const docNorm = normalizarDoc(doc)
          if (docNorm) {
            if (!cacheCliente.has(docNorm)) cacheCliente.set(docNorm, polizasDelDocumento(docNorm))
            delCliente = await cacheCliente.get(docNorm)!
          }
        } catch {
          return crearResultado<PolizaLista>('noEncontrada', {
            motivo: 'No se pudo consultar la base. Asígnela a mano o reintente la importación.',
          })
        }
        if (!nro) {
          return crearResultado<PolizaLista>('noEncontrada', {
            candidatos: delCliente,
            motivo: 'Esta línea del reporte no trae número de póliza.',
          })
        }
        return resolverMatch({
          nucleo: nro,
          anexo: anexo || null,
          docCliente: doc,
          aseguradoraId,
          primaLinea: prima,
          candidatos: [...porNumero, ...delCliente],
          polizasDelCliente: delCliente,
        })
      }

      const resultados = await Promise.all(
        lineas.map((l) =>
          resolver(textoIA(l.nro_poliza), textoIA(l.anexo), textoIA(l.doc_cliente), numIA(l.vlrprima_poliza)),
        ),
      )

      const nuevas: Fila[] = lineas.map((l, i) => {
        const match = resultados[i]
        const poliza = match.poliza
        const primaLinea = numIA(l.vlrprima_poliza)
        // El abono sale SOLO del reporte. Si no lo trae, la línea queda sin
        // valor (nunca se llena con la prima completa de la póliza: sería
        // registrar un pago que nadie reportó).
        const abono = numIA(l.vlrabono_prima) ?? primaLinea
        const porcCom = numIA(l.porccomision) ?? poliza?.porccom_poliza ?? null
        let vlrCom = numIA(l.vlrcomision)
        let comisionCalculada = false
        if (vlrCom == null && abono != null && porcCom != null) {
          vlrCom = redondearCentavos((abono * porcCom) / 100)
          comisionCalculada = true
        }
        return {
          clave: i,
          incluir: seIncluyeSolo(match) && (abono ?? 0) !== 0,
          poliza,
          match,
          manual: false,
          comisionCalculada,
          errorGuardado: null,
          nroExtraido: textoIA(l.nro_poliza),
          anexoExtraido: textoIA(l.anexo),
          docExtraido: textoIA(l.doc_cliente),
          clienteExtraido: textoIA(l.nombre_cliente),
          prima: dinero2(primaLinea ?? poliza?.prima_poliza ?? null),
          abono: dinero2(abono),
          porcCom: pct5(porcCom),
          vlrCom: dinero2(vlrCom),
          porcAd: pct5(numIA(l.porccomad)),
          vlrAd: dinero2(numIA(l.vlrcomad)),
          factura: textoIA(l.num_factura),
          fechaPago: fechaIA(l.fecha_pago),
        }
      })

      // Duplicados contra la base: si ya estaba cargado, se deja por fuera.
      const ids = [...new Set(nuevas.flatMap((f) => (f.poliza ? [f.poliza.id] : [])))]
      await Promise.all(ids.map(asegurarAbonos))
      for (const f of nuevas) if (duplicadoDe(f, abonosPorPoliza.current)) f.incluir = false

      if (!vigente) return
      setFilas(nuevas)
      setCargando(false)
    })()
    return () => {
      vigente = false
    }
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cambiar = (clave: number, cambio: Partial<Fila> | ((f: Fila) => Partial<Fila>)) =>
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, ...(typeof cambio === 'function' ? cambio(f) : cambio) } : f)))

  const asignar = async (f: Fila, p: PolizaLista | null) => {
    cambiar(f.clave, (x) => ({ poliza: p, manual: true, incluir: p != null && !sinValor(x) }))
    if (!p) return
    await asegurarAbonos(p.id)
    setFilas((fs) =>
      fs.map((x) =>
        x.clave === f.clave && x.poliza?.id === p.id && duplicadoDe(x, abonosPorPoliza.current) ? { ...x, incluir: false } : x,
      ),
    )
  }

  /** Al editar abono o %: si la comisión era calculada, se recalcula. */
  const recalcularComision = (x: Fila, abono: number | null, pct: number | null): Partial<Fila> =>
    x.comisionCalculada && abono != null && pct != null ? { vlrCom: redondearCentavos((abono * pct) / 100) } : {}

  // ── Guardar ───────────────────────────────────────────────────────────────
  const guardar = async () => {
    const aGuardar = filas.filter((f) => f.incluir)
    const nSinPoliza = aGuardar.filter((f) => !f.poliza).length
    const nSinValor = aGuardar.filter(sinValor).length
    if (nSinPoliza > 0 || nSinValor > 0) {
      toast.error(
        [
          nSinPoliza > 0 ? `${nSinPoliza} línea(s) incluida(s) sin póliza asignada.` : null,
          nSinValor > 0 ? `${nSinValor} línea(s) incluida(s) sin valor de abono.` : null,
          'Corríjalas o quítelas de la importación.',
        ]
          .filter(Boolean)
          .join(' '),
      )
      return
    }
    if (aGuardar.length === 0) {
      toast.info('No hay líneas para guardar.')
      return
    }

    setGuardando(true)
    const guardadas = new Set<number>()
    const errores = new Map<number, string>()
    const idsPolizas: number[] = []
    for (const f of aGuardar) {
      try {
        // Lo pagado de la póliza y su paso a COMPLETA los recalcula la base
        // en la misma operación (trigger), no la app.
        await crearAbono({
          idrep_pago: idReporte,
          id_poliza: f.poliza!.id,
          fecha_pago: aISO(f.fechaPago),
          vlrprima_poliza: f.prima ?? 0,
          vlrabono_prima: f.abono ?? 0,
          porccomision: f.porcCom ?? 0,
          vlrcomision: f.vlrCom ?? 0,
          porccomad: f.porcAd ?? 0,
          vlrcomad: f.vlrAd ?? 0,
          num_factura: f.factura.trim() || null,
          estado_pago: 'I',
        })
        guardadas.add(f.clave)
        idsPolizas.push(f.poliza!.id)
      } catch (e) {
        errores.set(f.clave, `No se guardó: ${mensajeError(e)}`)
      }
    }

    if (guardadas.size > 0) {
      creoAlgo.current = true
      await trasCambiarAbonos(qc, idsPolizas)
    }

    const fallidas = aGuardar.length - guardadas.size
    // Las guardadas salen de la lista: si algo falló, quedan solo las
    // pendientes para corregir y reintentar.
    setFilas((fs) =>
      fs
        .filter((f) => !guardadas.has(f.clave))
        .map((f) => (f.incluir ? { ...f, errorGuardado: errores.get(f.clave) ?? null } : f)),
    )
    setGuardando(false)
    if (fallidas === 0) {
      toast.success(`Se crearon ${guardadas.size} abono(s).`)
      onCerrar(creoAlgo.current)
    } else {
      toast.warning(
        `Se crearon ${guardadas.size} abono(s). ${fallidas} no se pudieron guardar: siguen en la lista para reintentar.`,
      )
    }
  }

  // ── Resumen ───────────────────────────────────────────────────────────────
  const duplicados = new Map(filas.map((f) => [f.clave, duplicadoDe(f, abonosPorPoliza.current)]))
  const lista = (f: Fila) => !f.manual && seIncluyeSolo(f.match) && !duplicados.get(f.clave) && !sinValor(f)
  const nListas = filas.filter(lista).length
  const nSinPoliza = filas.filter((f) => !f.poliza).length
  const nPorRevisar = filas.length - nListas - nSinPoliza
  const incluidas = filas.filter((f) => f.incluir)
  const sumaAbonos = sumarDinero(incluidas.map((f) => f.abono ?? 0))
  const sumaComision = sumarDinero(incluidas.flatMap((f) => [f.vlrCom ?? 0, f.vlrAd ?? 0]))

  const cerrar = () => {
    if (!guardando) onCerrar(creoAlgo.current)
  }

  return (
    <Dialogo
      abierto
      onCerrar={cerrar}
      ancho="full"
      titulo={`Revisar importación (${filas.length} línea(s))`}
      descripcion="Revise cada línea antes de guardar. Solo quedan incluidas de entrada las que coinciden exacto (número de póliza + anexo). Las demás necesitan que elija la póliza o las deje por fuera."
      pie={
        <>
          <Boton variante="secundario" onClick={cerrar} disabled={guardando}>
            Cerrar
          </Boton>
          <Boton onClick={guardar} cargando={guardando} disabled={cargando}>
            {!guardando && <Save />}
            Guardar {incluidas.length} abono(s)
          </Boton>
        </>
      }
    >
      {cargando ? (
        <Cargando texto="Buscando las pólizas de cada línea…" />
      ) : (
        <div className="flex flex-col gap-3">
          {abonosPrevios > 0 && (
            <Aviso icono={<AlertTriangle />}>
              Este reporte ya tiene {abonosPrevios} abono(s) cargados. Si ya había importado este archivo, guardar de
              nuevo duplicaría los pagos.
            </Aviso>
          )}
          <div className="flex flex-wrap gap-2">
            <Etiqueta tono="verde">{nListas} coinciden exacto</Etiqueta>
            <Etiqueta tono="alerta">{nPorRevisar} por revisar</Etiqueta>
            <Etiqueta tono="peligro">{nSinPoliza} sin póliza</Etiqueta>
            <Etiqueta>
              <span className="num">
                Incluidas: abonos {fmtDinero(sumaAbonos, 2)} · comisión {fmtDinero(sumaComision, 2)}
              </span>
            </Etiqueta>
          </div>
          {filas.map((f) => (
            <TarjetaFila
              key={f.clave}
              f={f}
              duplicado={duplicados.get(f.clave) ?? null}
              onIncluir={(v) => cambiar(f.clave, { incluir: v })}
              onAsignar={(p) => asignar(f, p)}
              onCambio={(c) => cambiar(f.clave, c)}
              recalcularComision={recalcularComision}
            />
          ))}
          {filas.length === 0 && <p className="py-8 text-center text-ink-soft">No quedan líneas por revisar.</p>}
        </div>
      )}
    </Dialogo>
  )
}

function estadoVisual(f: Fila): [string, 'verde' | 'navy' | 'alerta' | 'peligro'] {
  if (f.manual) return f.poliza ? ['Asignada a mano', 'navy'] : ['Sin póliza', 'peligro']
  switch (f.match.estado) {
    case 'exacta':
      return ['Coincide exacto', 'verde']
    case 'unicaSinAnexo':
      return ['Coincide (reporte sin anexo)', 'verde']
    case 'revisar':
      return ['Revisar', 'alerta']
    case 'ambigua':
      return ['Varias opciones', 'alerta']
    case 'anexoNoRegistrado':
      return ['Anexo no registrado', 'alerta']
    case 'noEncontrada':
      return ['No encontrada', 'peligro']
  }
}

function TarjetaFila({
  f,
  duplicado,
  onIncluir,
  onAsignar,
  onCambio,
  recalcularComision,
}: {
  f: Fila
  duplicado: string | null
  onIncluir: (v: boolean) => void
  onAsignar: (p: PolizaLista | null) => void
  onCambio: (c: Partial<Fila> | ((f: Fila) => Partial<Fila>)) => void
  recalcularComision: (x: Fila, abono: number | null, pct: number | null) => Partial<Fila>
}) {
  const [etiqueta, tono] = estadoVisual(f)
  const mostrarMotivo = !f.manual && !!f.match.motivo && !seIncluyeSolo(f.match)
  const opciones = f.match.candidatos
  const extraido = [
    `Póliza ${f.nroExtraido || '—'}`,
    `anexo ${f.anexoExtraido || '—'}`,
    f.docExtraido ? `doc ${f.docExtraido}` : null,
    f.clienteExtraido || null,
  ]
    .filter(Boolean)
    .join('  ·  ')
  const avisos = [
    f.errorGuardado,
    duplicado,
    sinValor(f) ? 'El reporte no trae el valor abonado de esta línea: escríbalo o déjela por fuera.' : null,
    mostrarMotivo ? f.match.motivo : null,
  ].filter((a): a is string => !!a)
  const avisoRojo = !!f.errorGuardado || !!duplicado || sinValor(f)

  return (
    <div className={cn('rounded-xl border border-line p-3.5', f.incluir ? 'bg-surface' : 'bg-muted/70')}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="checkbox"
          className="size-4 accent-navy"
          checked={f.incluir}
          onChange={(e) => onIncluir(e.target.checked)}
          aria-label="Incluir esta línea"
        />
        <Etiqueta tono={tono}>{etiqueta}</Etiqueta>
        {duplicado && <Etiqueta tono="peligro">Posible duplicado</Etiqueta>}
        {f.comisionCalculada && <Etiqueta>Comisión calculada</Etiqueta>}
        <span className="min-w-0 flex-1 truncate text-[12px] text-ink-soft" title={extraido}>
          Reporte: {extraido}
        </span>
      </div>

      <div className="mt-1 flex flex-col gap-2 pl-6">
        {avisos.length > 0 && (
          <div className={cn('text-[12px] whitespace-pre-line', avisoRojo ? 'text-danger' : 'text-warning-ink')}>
            {avisos.join('\n')}
          </div>
        )}
        {f.poliza && (
          <div className="leading-tight">
            <div className="text-[13px] font-semibold">
              Póliza {f.poliza.nro_poliza ?? f.poliza.id} — {f.poliza.nombre_cliente ?? ''}
            </div>
            <div className="text-[11.5px] text-ink-soft">
              {f.poliza.nombre_aseg ?? '—'} · {f.poliza.nombre_ramo ?? '—'} · {f.poliza.nombre_prod ?? '—'} · Prima
              póliza: <span className="num">{fmtDinero(f.poliza.prima_poliza ?? 0)}</span>
            </div>
          </div>
        )}
        {opciones.length > 0 && !seIncluyeSolo(f.match) && (
          <div className="flex flex-wrap gap-1.5">
            {opciones.map((c) => {
              const elegida = f.poliza?.id === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onAsignar(c)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors',
                    elegida ? 'border-green/30 bg-green-soft text-green-ink' : 'border-line bg-surface hover:bg-muted',
                  )}
                >
                  {c.nro_poliza ?? c.id} — {c.nombre_cliente ?? ''} (<span className="num">{fmtDinero(c.prima_poliza ?? 0)}</span>)
                </button>
              )
            })}
          </div>
        )}
        <div className="max-w-xl">
          <Buscador<PolizaLista>
            valor={f.poliza}
            onCambio={onAsignar}
            buscar={(q) => buscarPolizasParaAbono(q)}
            etiqueta={etiquetaPoliza}
            detalle={(p) => `${p.nombre_ramo ?? ''}  |  ${p.bien_asegurado ?? ''}`}
            clave={(p) => p.id}
            placeholder={f.poliza ? 'Cambiar póliza' : 'Asignar póliza manualmente'}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          <Campo etiqueta="Fecha pago">
            <InputFecha valor={f.fechaPago} onCambio={(d) => onCambio({ fechaPago: d })} />
          </Campo>
          <Campo etiqueta="Prima">
            <InputNumero valor={f.prima} onCambio={(v) => onCambio({ prima: v })} />
          </Campo>
          <Campo etiqueta="Abono">
            <InputNumero valor={f.abono} onCambio={(v) => onCambio((x) => ({ abono: v, ...recalcularComision(x, v, x.porcCom) }))} />
          </Campo>
          <Campo etiqueta="% Com.">
            <InputNumero
              valor={f.porcCom}
              maxDecimales={5}
              onCambio={(v) => onCambio((x) => ({ porcCom: v, ...recalcularComision(x, x.abono, v) }))}
            />
          </Campo>
          <Campo etiqueta="Vlr. com.">
            <InputNumero valor={f.vlrCom} onCambio={(v) => onCambio({ vlrCom: v, comisionCalculada: false })} />
          </Campo>
          <Campo etiqueta="% Com. ad.">
            <InputNumero valor={f.porcAd} maxDecimales={5} onCambio={(v) => onCambio({ porcAd: v })} />
          </Campo>
          <Campo etiqueta="Vlr. com. ad.">
            <InputNumero valor={f.vlrAd} onCambio={(v) => onCambio({ vlrAd: v })} />
          </Campo>
          <Campo etiqueta="Factura">
            <Input value={f.factura} onChange={(e) => onCambio({ factura: e.target.value })} />
          </Campo>
        </div>
      </div>
    </div>
  )
}
