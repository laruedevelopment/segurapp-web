import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Mail, MessageCircle, Phone, RefreshCw, StickyNote } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Cargando, Chip, Etiqueta, MensajeError, Tarjeta, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { AreaTexto, CasillaTactil, Input, SelectorSimple } from '@/components/ui/campos'
import { CLAVE_VENCIMIENTOS, guardarSeguimiento, guardarSeguimientos, listarVencimientos, type Vencimiento } from '@/datos/vencimientos'
import {
  ATAJOS_RANGO,
  ESTADOS_SEGUIMIENTO,
  rangoDias,
  rangoPorDefecto,
  rangoValido,
  estaCerrado,
  etiquetaEstado,
  primerTelefono,
  semaforo,
  telefonoWhatsapp,
  textoDias,
  type EstadoSeguimiento,
  type Semaforo,
} from '@/datos/vencimientosLogica'
import { causaAmigable } from '@/lib/errores'
import { aFecha, fmtFecha, hoy } from '@/lib/fechas'
import { fmtDinero } from '@/lib/numeros'
import { cn } from '@/lib/utils'

const TONO: Record<Semaforo, 'peligro' | 'alerta' | 'verde'> = { vencida: 'peligro', rojo: 'peligro', ambar: 'alerta', verde: 'verde' }
const BORDE: Record<Semaforo, string> = {
  vencida: 'border-l-danger',
  rojo: 'border-l-danger',
  ambar: 'border-l-warning',
  verde: 'border-l-green',
}

const SEMAFOROS: { sem: Semaforo; etiqueta: string; clase: string }[] = [
  { sem: 'vencida', etiqueta: 'vencidas', clase: 'bg-danger text-white' },
  { sem: 'rojo', etiqueta: 'urgentes (15 días o menos)', clase: 'bg-danger-soft text-danger' },
  { sem: 'ambar', etiqueta: 'próximas (16 a 30 días)', clase: 'bg-warning-soft text-warning-ink' },
  { sem: 'verde', etiqueta: 'con tiempo (más de 30)', clase: 'bg-green-soft text-green-ink' },
]

type Vista = 'pendientes' | 'todas' | EstadoSeguimiento

function Fila({ v, marcada, onMarcar }: { v: Vencimiento; marcada: boolean; onMarcar: () => void }) {
  const qc = useQueryClient()
  const [abierta, setAbierta] = useState(false)
  const [nota, setNota] = useState(v.nota ?? '')
  const [proximo, setProximo] = useState(v.proximoContacto ?? '')
  const [error, setError] = useState<string | null>(null)

  const guardar = useMutation({
    mutationFn: (p: { estado: EstadoSeguimiento; nota: string; proximo: string }) =>
      guardarSeguimiento(v.polizaId, p.estado, p.nota.trim() || null, p.proximo || null),
    onSuccess: () => {
      setError(null)
      setAbierta(false)
      void qc.invalidateQueries({ queryKey: CLAVE_VENCIMIENTOS })
    },
    onError: (e) => setError(causaAmigable(e, 'No se pudo guardar el seguimiento')),
  })

  const sem = semaforo(v.dias)
  const tel = primerTelefono(v.telCliente)
  const wa = telefonoWhatsapp(tel)
  const cerrado = estaCerrado(v.estado)

  return (
    <Tarjeta className={cn('border-l-4 p-4', BORDE[sem], cerrado && 'opacity-70', marcada && 'ring-2 ring-navy/40')}>
      <div className="flex flex-wrap items-start gap-x-2 gap-y-2">
        <CasillaTactil className="-ml-2 -mt-2" checked={marcada} onChange={onMarcar} label={`Seleccionar la póliza ${v.nroPoliza ?? v.polizaId}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Etiqueta tono={TONO[sem]}>{textoDias(v.dias)}</Etiqueta>
            <span className="text-[13px] text-ink-soft">{fmtFecha(aFecha(v.vence))}</span>
            <Etiqueta tono={cerrado ? 'verde' : v.estado === 'P' ? 'neutro' : 'navy'}>{etiquetaEstado(v.estado)}{v.renovadaAuto && v.estado === 'F' ? ' (ya hay una nueva)' : ''}</Etiqueta>
          </div>
          <div className="mt-1 font-semibold">{v.nombreCliente ?? '—'}</div>
          <div className="text-[13px] text-ink-soft">
            <Link to={`/polizas/${v.polizaId}`} className="num font-semibold text-navy underline-offset-2 hover:underline">
              {v.nroPoliza ?? `#${v.polizaId}`}
            </Link>
            {' · '}
            {[v.nombreAseg, v.nombreRamo, v.nombreProd].filter(Boolean).join(' · ') || '—'}
          </div>
          {v.bien && <div className="truncate text-[13px] text-ink-soft" title={v.bien}>{v.bien}</div>}
          <div className="text-[13px] text-ink-soft">
            Prima {fmtDinero(v.prima)}
            {v.nombreAsesor ? ` · Asesor: ${v.nombreAsesor}` : ''}
          </div>
          {v.nota && !abierta && <div className="mt-1 text-[13px] italic">“{v.nota}”</div>}
          {v.proximoContacto && !cerrado && (
            <div className="text-[12px] text-ink-soft">Volver a llamar: {fmtFecha(aFecha(v.proximoContacto))}</div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-1.5">
            {tel ? (
              <a href={`tel:${tel.replace(/[^\d+]/g, '')}`} title={`Llamar a ${tel}`} aria-label={`Llamar a ${tel}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-line-strong px-3 text-[13px] font-semibold text-navy hover:bg-muted">
                <Phone className="size-4" /> {tel}
              </a>
            ) : (
              <span className="inline-flex h-9 items-center px-2 text-[12px] text-ink-soft">Sin teléfono</span>
            )}
            {wa && (
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" title="Escribir por WhatsApp" aria-label="Escribir por WhatsApp"
                className="inline-flex size-9 items-center justify-center rounded-[10px] border border-line-strong text-green hover:bg-muted">
                <MessageCircle className="size-4" />
              </a>
            )}
            {v.correoCliente && (
              <a href={`mailto:${v.correoCliente}`} title={v.correoCliente} aria-label={`Escribir a ${v.correoCliente}`}
                className="inline-flex size-9 items-center justify-center rounded-[10px] border border-line-strong text-navy hover:bg-muted">
                <Mail className="size-4" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <SelectorSimple<EstadoSeguimiento>
              className="h-9 w-40 text-[13px]"
              valor={v.estado}
              opciones={ESTADOS_SEGUIMIENTO}
              disabled={guardar.isPending}
              onCambio={(e) => e && guardar.mutate({ estado: e, nota: v.nota ?? '', proximo: v.proximoContacto ?? '' })}
            />
            <Boton variante="fantasma" tamano="icono" title="Nota y próximo contacto" onClick={() => setAbierta((x) => !x)}>
              <StickyNote />
            </Boton>
          </div>
        </div>
      </div>

      {abierta && (
        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          <AreaTexto value={nota} maxLength={500} rows={2} placeholder="Nota (por ejemplo: pidió cotizar con otra aseguradora)" onChange={(e) => setNota(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[13px] text-ink-soft" htmlFor={`prox-${v.polizaId}`}>Volver a llamar el</label>
            <Input id={`prox-${v.polizaId}`} type="date" className="h-9 w-44" value={proximo} onChange={(e) => setProximo(e.target.value)} />
            <Boton tamano="sm" cargando={guardar.isPending} onClick={() => guardar.mutate({ estado: v.estado, nota, proximo })}>
              Guardar
            </Boton>
          </div>
        </div>
      )}
      {error && <div className="mt-2 text-[13px] text-danger">{error}</div>}
    </Tarjeta>
  )
}

/** Pólizas por vencer con semáforo y seguimiento de a quién ya se llamó. */
export default function Vencimientos() {
  const [rango, setRango] = useState(() => rangoPorDefecto(hoy()))
  const [atajo, setAtajo] = useState<string | null>('defecto')
  const valido = rangoValido(rango)
  const consulta = useQuery({
    queryKey: [...CLAVE_VENCIMIENTOS, 'lista', rango.desde, rango.hasta],
    queryFn: () => listarVencimientos(rango),
    enabled: valido,
    refetchOnMount: 'always',
  })
  const [params, setParams] = useSearchParams()
  const semParam = params.get('sem')
  const sem: Semaforo | null = semParam === 'vencida' || semParam === 'rojo' || semParam === 'ambar' || semParam === 'verde' ? semParam : null
  const elegirSem = (s: Semaforo | null) => setParams(s ? { sem: s } : {}, { replace: true })
  const [vista, setVista] = useState<Vista>('pendientes')
  const [asesor, setAsesor] = useState<string | null>(null)
  const todas = consulta.data
  const qc = useQueryClient()
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set())
  const [estadoLote, setEstadoLote] = useState<EstadoSeguimiento | null>(null)
  const [avisoLote, setAvisoLote] = useState<string | null>(null)
  const lote = useMutation({
    mutationFn: ({ filas, estado }: { filas: Vencimiento[]; estado: EstadoSeguimiento }) => guardarSeguimientos(filas, estado),
    onSuccess: (fallaron, { filas }) => {
      setAvisoLote(fallaron ? `${fallaron} de ${filas.length} no se pudieron actualizar; vuelva a intentarlo.` : null)
      if (!fallaron) setMarcadas(new Set())
      setEstadoLote(null)
      void qc.invalidateQueries({ queryKey: CLAVE_VENCIMIENTOS })
    },
    onError: (e) => setAvisoLote(causaAmigable(e, 'No se pudo actualizar')),
  })
  const asesores = useMemo(
    () => [...new Set((todas ?? []).map((x) => x.nombreAsesor).filter((x): x is string => !!x))].sort().map((a) => ({ valor: a, etiqueta: a })),
    [todas],
  )
  const filas = useMemo(
    () =>
      (todas ?? []).filter((x) => {
        if (asesor && x.nombreAsesor !== asesor) return false
        if (sem && semaforo(x.dias) !== sem) return false
        if (vista === 'todas') return true
        if (vista === 'pendientes') return !estaCerrado(x.estado)
        return x.estado === vista
      }),
    [todas, vista, asesor, sem],
  )
  const seleccion = filas.filter((x) => marcadas.has(x.polizaId))
  const todasMarcadas = filas.length > 0 && seleccion.length === filas.length
  const alternar = (id: number) =>
    setMarcadas((m) => {
      const n = new Set(m)
      if (!n.delete(id)) n.add(id)
      return n
    })
  const cuenta = (e: EstadoSeguimiento) => (todas ?? []).filter((x) => x.estado === e && (!asesor || x.nombreAsesor === asesor)).length

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo="Vencimientos"
        subtitulo="Pólizas por vencer: llame al cliente y marque en qué va cada una"
        volver="/"
        acciones={
          <Boton variante="fantasma" tamano="icono" title="Recargar" onClick={() => void consulta.refetch()} disabled={consulta.isFetching}>
            <RefreshCw className={consulta.isFetching ? 'animate-spin' : ''} />
          </Boton>
        }
      />
      <Contenido className="flex max-w-4xl flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold">Vence entre</span>
          <Input type="date" aria-label="Vence desde" className="h-9 w-40" value={rango.desde} onChange={(e) => { setAtajo(null); setRango({ ...rango, desde: e.target.value }) }} />
          <span className="text-[13px]">y</span>
          <Input type="date" aria-label="Vence hasta" className="h-9 w-40" value={rango.hasta} onChange={(e) => { setAtajo(null); setRango({ ...rango, hasta: e.target.value }) }} />
          <Chip activo={atajo === 'defecto'} onClick={() => { setAtajo('defecto'); setRango(rangoPorDefecto(hoy())) }}>Por defecto</Chip>
          {ATAJOS_RANGO.map((a) => (
            <Chip key={a.clave} activo={atajo === a.clave} onClick={() => { setAtajo(a.clave); setRango(rangoDias(hoy(), a.atras, a.adelante)) }}>{a.etiqueta}</Chip>
          ))}
        </div>
        {!valido && <MensajeError error="La fecha inicial debe ser anterior o igual a la final." />}
        <div className="flex flex-wrap items-center gap-2">
          {SEMAFOROS.map((x) => {
            const n = (todas ?? []).filter((f) => semaforo(f.dias) === x.sem && !estaCerrado(f.estado) && (!asesor || f.nombreAsesor === asesor)).length
            return (
              <button
                key={x.sem}
                type="button"
                aria-pressed={sem === x.sem}
                onClick={() => elegirSem(sem === x.sem ? null : x.sem)}
                className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-all', x.clase, sem === x.sem ? 'ring-2 ring-ink/50' : sem ? 'opacity-50' : '')}
              >
                {n} {x.etiqueta}
              </button>
            )
          })}
          {sem && <Boton variante="fantasma" tamano="sm" onClick={() => elegirSem(null)}>Quitar color</Boton>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip activo={vista === 'pendientes'} onClick={() => setVista('pendientes')}>Por atender</Chip>
          {ESTADOS_SEGUIMIENTO.map((e) => (
            <Chip key={e.valor} activo={vista === e.valor} onClick={() => setVista(e.valor)}>
              {e.etiqueta} ({cuenta(e.valor)})
            </Chip>
          ))}
          <Chip activo={vista === 'todas'} onClick={() => setVista('todas')}>Todas</Chip>
          <SelectorSimple className="ml-auto h-8 w-44 text-[13px]" valor={asesor} vacio="Todos los asesores" opciones={asesores} onCambio={setAsesor} />
        </div>

        {!valido ? null : consulta.isError && !consulta.data ? (
          <MensajeError error={causaAmigable(consulta.error, 'No se pudieron cargar los vencimientos')} />
        ) : consulta.isPending ? (
          <Cargando texto="Buscando vencimientos…" />
        ) : filas.length === 0 ? (
          <Vacio icono={<CheckCircle2 className="text-green" />} titulo="No hay pólizas en esta lista." detalle="Pruebe con otro rango de fechas o con otro estado." />
        ) : (
          <>
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1 shadow-sm">
              <CasillaTactil
                checked={todasMarcadas}
                indeterminada={seleccion.length > 0 && !todasMarcadas}
                onChange={() => setMarcadas(todasMarcadas ? new Set() : new Set(filas.map((x) => x.polizaId)))}
                label="Seleccionar todas las pólizas de la lista"
              />
              <span className="text-[13px] text-ink-soft">
                {seleccion.length > 0 ? `${seleccion.length} ${seleccion.length === 1 ? 'seleccionada' : 'seleccionadas'}` : 'Seleccionar todas'}
              </span>
              {seleccion.length > 0 && (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[13px]">Marcar como</span>
                  <SelectorSimple<EstadoSeguimiento> className="h-9 w-40 text-[13px]" valor={estadoLote} vacio="Elegir estado…" opciones={ESTADOS_SEGUIMIENTO} onCambio={setEstadoLote} />
                  <Boton tamano="sm" disabled={!estadoLote} cargando={lote.isPending} onClick={() => estadoLote && lote.mutate({ filas: seleccion, estado: estadoLote })}>
                    Aplicar
                  </Boton>
                </div>
              )}
            </div>
            {avisoLote && <MensajeError error={avisoLote} />}
            {filas.map((v) => <Fila key={v.polizaId} v={v} marcada={marcadas.has(v.polizaId)} onMarcar={() => alternar(v.polizaId)} />)}
            <p className="text-[12px] text-ink-soft">{filas.length} {filas.length === 1 ? 'póliza' : 'pólizas'}.</p>
          </>
        )}
      </Contenido>
    </div>
  )
}
