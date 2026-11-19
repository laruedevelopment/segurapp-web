import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, MessageCircle, Phone, Plus, RefreshCw } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Cargando, Chip, Etiqueta, MensajeError, Tarjeta, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { Input } from '@/components/ui/campos'
import { CLAVE_SOAT, listarSoatVehiculos } from '@/datos/soat'
import { esTodoRiesgo, type EstadoSoat, type FilaSoat } from '@/datos/soatLogica'
import { primerTelefono, telefonoWhatsapp, textoDias } from '@/datos/vencimientosLogica'
import { causaAmigable } from '@/lib/errores'
import { aFecha, fmtFecha } from '@/lib/fechas'
import { cn } from '@/lib/utils'

const ESTADOS: { e: EstadoSoat; etiqueta: string; clase: string; borde: string }[] = [
  { e: 'sin', etiqueta: 'sin SOAT registrado', clase: 'bg-danger text-white', borde: 'border-l-danger' },
  { e: 'vencido', etiqueta: 'vencidos', clase: 'bg-danger-soft text-danger', borde: 'border-l-danger' },
  { e: 'porVencer', etiqueta: 'por vencer (45 días o menos)', clase: 'bg-warning-soft text-warning-ink', borde: 'border-l-warning' },
  { e: 'vigente', etiqueta: 'vigentes', clase: 'bg-green-soft text-green-ink', borde: 'border-l-green' },
]

function urlNuevoSoat(f: FilaSoat) {
  const p = new URLSearchParams({ soat: String(f.vehiculo.id) })
  if (f.finSugerido) p.set('soatFin', f.finSugerido)
  return `/polizas/nueva?${p.toString()}`
}

function Fila({ f }: { f: FilaSoat }) {
  const meta = ESTADOS.find((x) => x.e === f.estado)!
  const v = f.vehiculo
  const tel = primerTelefono(v.tel)
  const wa = telefonoWhatsapp(tel)
  return (
    <Tarjeta className={cn('border-l-4 p-4', meta.borde)}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num rounded-md bg-[#f6d33a] px-2 py-0.5 text-[15px] font-bold tracking-wider text-black">{f.placa}</span>
            <Etiqueta tono={f.estado === 'vigente' ? 'verde' : f.estado === 'porVencer' ? 'alerta' : 'peligro'}>
              {f.estado === 'sin' ? 'Sin SOAT registrado' : `SOAT: ${textoDias(f.dias ?? 0)}`}
            </Etiqueta>
            {f.soatVence && <span className="text-[13px] text-ink-soft">{fmtFecha(aFecha(f.soatVence))}</span>}
          </div>
          <div className="mt-1 font-semibold">{v.nombreCliente ?? '—'}</div>
          <div className="text-[13px] text-ink-soft">
            <Link to={`/polizas/${v.id}`} className="font-semibold text-navy underline-offset-2 hover:underline">
              Póliza #{v.id}
            </Link>
            {' · '}
            {[v.nombreAseg, v.ramo, v.producto].filter(Boolean).join(' · ')} · vence {fmtFecha(aFecha(v.vence))}
          </div>
          {v.asesor && <div className="text-[12px] text-ink-soft">Asesor: {v.asesor}</div>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-1.5">
            {tel ? (
              <a href={`tel:${tel.replace(/[^\d+]/g, '')}`} title={`Llamar a ${tel}`} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-line-strong px-3 text-[13px] font-semibold text-navy hover:bg-muted">
                <Phone className="size-4" /> {tel}
              </a>
            ) : (
              <span className="inline-flex h-9 items-center px-2 text-[12px] text-ink-soft">Sin teléfono</span>
            )}
            {wa && (
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" title="Escribir por WhatsApp" aria-label="Escribir por WhatsApp" className="inline-flex size-9 items-center justify-center rounded-[10px] border border-line-strong text-green hover:bg-muted">
                <MessageCircle className="size-4" />
              </a>
            )}
          </div>
          {f.estado !== 'vigente' && (
            <Link
              to={urlNuevoSoat(f)}
              className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-navy px-3 text-[13px] font-semibold text-white hover:bg-navy-dark [&_svg]:size-3.5"
            >
              <Plus /> Registrar SOAT
            </Link>
          )}
        </div>
      </div>
    </Tarjeta>
  )
}

/** Vehículos asegurados con nosotros y el estado de su SOAT: quién no tiene, a quién se le venció o vence pronto. */
export default function SoatVehiculos() {
  const consulta = useQuery({ queryKey: CLAVE_SOAT, queryFn: listarSoatVehiculos, refetchOnMount: 'always' })
  const [estado, setEstado] = useState<EstadoSoat | null>('sin')
  const [soloTodoRiesgo, setSoloTodoRiesgo] = useState(false)
  const [q, setQ] = useState('')
  const todas = consulta.data
  const base = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (todas ?? []).filter(
      (f) =>
        (!soloTodoRiesgo || esTodoRiesgo(f.vehiculo)) &&
        (!t || f.placa.toLowerCase().includes(t) || (f.vehiculo.nombreCliente ?? '').toLowerCase().includes(t)),
    )
  }, [todas, soloTodoRiesgo, q])
  const filas = useMemo(() => base.filter((f) => !estado || f.estado === estado), [base, estado])
  const cuenta = (e: EstadoSoat) => base.filter((f) => f.estado === e).length

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo="SOAT de los vehículos"
        subtitulo="Vehículos con póliza vigente (livianos y pesados) y el estado de su SOAT"
        volver="/"
        acciones={
          <Boton variante="fantasma" tamano="icono" title="Recargar" onClick={() => void consulta.refetch()} disabled={consulta.isFetching}>
            <RefreshCw className={consulta.isFetching ? 'animate-spin' : ''} />
          </Boton>
        }
      />
      <Contenido className="flex max-w-4xl flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {ESTADOS.map((x) => (
            <button
              key={x.e}
              type="button"
              aria-pressed={estado === x.e}
              onClick={() => setEstado(estado === x.e ? null : x.e)}
              className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-all', x.clase, estado === x.e ? 'ring-2 ring-ink/50' : estado ? 'opacity-50' : '')}
            >
              {cuenta(x.e)} {x.etiqueta}
            </button>
          ))}
          <Chip activo={soloTodoRiesgo} onClick={() => setSoloTodoRiesgo((x) => !x)}>Solo todo riesgo</Chip>
          <Input className="ml-auto h-8 w-52" placeholder="Buscar placa o cliente" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {consulta.isError && !consulta.data ? (
          <MensajeError error={causaAmigable(consulta.error, 'No se pudo cargar el cruce de SOAT')} />
        ) : consulta.isPending ? (
          <Cargando texto="Cruzando placas con los SOAT…" />
        ) : filas.length === 0 ? (
          <Vacio icono={<CheckCircle2 className="text-green" />} titulo="No hay vehículos en esta lista." />
        ) : (
          <>
            {filas.map((f) => <Fila key={f.placa} f={f} />)}
            <p className="text-[12px] text-ink-soft">
              {filas.length} {filas.length === 1 ? 'vehículo' : 'vehículos'}. El SOAT se busca por la placa entre los SOAT del mismo cliente: si se registró a nombre de otra persona, aparecerá como "sin SOAT".
            </p>
          </>
        )}
      </Contenido>
    </div>
  )
}
