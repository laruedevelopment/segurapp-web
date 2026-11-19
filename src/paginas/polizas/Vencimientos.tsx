import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Mail, MessageCircle, Phone, RefreshCw, StickyNote } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Cargando, Chip, Etiqueta, MensajeError, Tarjeta, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { AreaTexto, Input, SelectorSimple } from '@/components/ui/campos'
import { CLAVE_VENCIMIENTOS, guardarSeguimiento, listarVencimientos, type Vencimiento } from '@/datos/vencimientos'
import {
  ESTADOS_SEGUIMIENTO,
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
import { aFecha, fmtFecha } from '@/lib/fechas'
import { fmtDinero } from '@/lib/numeros'
import { cn } from '@/lib/utils'

const TONO: Record<Semaforo, 'peligro' | 'alerta' | 'verde'> = { vencida: 'peligro', rojo: 'peligro', ambar: 'alerta', verde: 'verde' }
const BORDE: Record<Semaforo, string> = {
  vencida: 'border-l-danger',
  rojo: 'border-l-danger',
  ambar: 'border-l-warning',
  verde: 'border-l-green',
}

type Vista = 'pendientes' | 'todas' | EstadoSeguimiento

function Fila({ v }: { v: Vencimiento }) {
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
    <Tarjeta className={cn('border-l-4 p-4', BORDE[sem], cerrado && 'opacity-70')}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Etiqueta tono={TONO[sem]}>{textoDias(v.dias)}</Etiqueta>
            <span className="text-[13px] text-ink-soft">{fmtFecha(aFecha(v.vence))}</span>
            <Etiqueta tono={cerrado ? 'verde' : v.estado === 'P' ? 'neutro' : 'navy'}>{etiquetaEstado(v.estado)}</Etiqueta>
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
  const consulta = useQuery({ queryKey: [...CLAVE_VENCIMIENTOS, 'lista'], queryFn: listarVencimientos, refetchOnMount: 'always' })
  const [vista, setVista] = useState<Vista>('pendientes')
  const [asesor, setAsesor] = useState<string | null>(null)
  const todas = consulta.data
  const asesores = useMemo(
    () => [...new Set((todas ?? []).map((x) => x.nombreAsesor).filter((x): x is string => !!x))].sort().map((a) => ({ valor: a, etiqueta: a })),
    [todas],
  )
  const filas = useMemo(
    () =>
      (todas ?? []).filter((x) => {
        if (asesor && x.nombreAsesor !== asesor) return false
        if (vista === 'todas') return true
        if (vista === 'pendientes') return !estaCerrado(x.estado)
        return x.estado === vista
      }),
    [todas, vista, asesor],
  )
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
          <Chip activo={vista === 'pendientes'} onClick={() => setVista('pendientes')}>Por atender</Chip>
          {ESTADOS_SEGUIMIENTO.map((e) => (
            <Chip key={e.valor} activo={vista === e.valor} onClick={() => setVista(e.valor)}>
              {e.etiqueta} ({cuenta(e.valor)})
            </Chip>
          ))}
          <Chip activo={vista === 'todas'} onClick={() => setVista('todas')}>Todas</Chip>
          <SelectorSimple className="ml-auto h-8 w-44 text-[13px]" valor={asesor} vacio="Todos los asesores" opciones={asesores} onCambio={setAsesor} />
        </div>

        {consulta.isError && !consulta.data ? (
          <MensajeError error={causaAmigable(consulta.error, 'No se pudieron cargar los vencimientos')} />
        ) : consulta.isPending ? (
          <Cargando texto="Buscando vencimientos…" />
        ) : filas.length === 0 ? (
          <Vacio icono={<CheckCircle2 className="text-green" />} titulo="No hay pólizas en esta lista." detalle="Aquí aparecen las que vencen en los próximos 45 días." />
        ) : (
          <>
            {filas.map((v) => <Fila key={v.polizaId} v={v} />)}
            <p className="text-[12px] text-ink-soft">{filas.length} {filas.length === 1 ? 'póliza' : 'pólizas'}.</p>
          </>
        )}
      </Contenido>
    </div>
  )
}
