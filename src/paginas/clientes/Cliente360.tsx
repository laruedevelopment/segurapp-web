import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, CalendarPlus, History, Mail, MessageCircle, Phone } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Cargando, MensajeError, Vacio } from '@/components/ui/basicos'
import { Tabla, type Columna } from '@/components/ui/tabla'
import { obtenerCliente, useCatalogo } from '@/datos/catalogos'
import { listarPolizasDeCliente } from '@/datos/polizas'
import { telefonoWhatsapp, primerTelefono } from '@/datos/vencimientosLogica'
import { aFecha, fmtFecha } from '@/lib/fechas'
import { mensajeAmigable } from '@/lib/errores'
import { fmtDinero, fmtDoc } from '@/lib/numeros'
import { fmtEntero } from '@/paginas/dashboard/formato'
import { nombreBien } from '@/lib/placa'
import { cn } from '@/lib/utils'
import { claveCliente } from '@/paginas/catalogos/clientesDatos'
import {
  coberturaPorRamo, lineaDeTiempo, polizasDelCliente, resumenCliente,
  type PolCliente, type PolColapsada,
} from './cliente360Logica'

const hoyISO = () => {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

const ESTILO_RAMO = {
  vigente: 'bg-green-soft text-green',
  vencido: 'bg-warning-soft text-warning-ink',
  sin: 'bg-muted text-ink-soft',
} as const
const TEXTO_RAMO = { vigente: 'Vigente', vencido: 'Venció', sin: 'No tiene' } as const

function Cifra({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="text-[12px] font-semibold text-ink-soft">{titulo}</div>
      <div className="num text-xl font-bold">{valor}</div>
      {detalle && <div className="text-[12px] text-ink-soft">{detalle}</div>}
    </div>
  )
}

/** Ficha 360° del cliente: cifras, pólizas (con anexos juntos), cobertura por ramo y línea de tiempo. */
export default function Cliente360() {
  const navigate = useNavigate()
  const id = Number(useParams().id)
  const valido = Number.isInteger(id) && id > 0
  const cliente = useQuery({ queryKey: claveCliente(id), queryFn: () => obtenerCliente(id), enabled: valido })
  const polizas = useQuery({ queryKey: ['cliente360', 'polizas', id], queryFn: () => listarPolizasDeCliente(id), enabled: valido, staleTime: 0 })
  const ramos = useCatalogo('ramos')
  const hoy = hoyISO()

  const pols = useMemo<PolCliente[]>(
    () =>
      (polizas.data ?? []).map((p) => ({
        id: p.id, nro: p.nro_poliza, asegId: p.aseg_id, ramoId: p.ramo_id, nombreRamo: p.nombre_ramo, nombreAseg: p.nombre_aseg,
        fini: p.fini_poliza, fin: p.ffin_poliza, prima: p.prima_poliza, valor: p.valor_poliza, bien: p.bien_asegurado, obs: p.obs_poliza ?? null,
      })),
    [polizas.data],
  )
  const resumen = useMemo(() => resumenCliente(pols, hoy), [pols, hoy])
  const lista = useMemo(() => polizasDelCliente(pols, hoy), [pols, hoy])
  const cobertura = useMemo(() => coberturaPorRamo(pols, ramos.data ?? [], hoy), [pols, ramos.data, hoy])
  const linea = useMemo(() => lineaDeTiempo(pols, hoy), [pols, hoy])

  const c = cliente.data
  const tel = primerTelefono(c?.tel_cliente)
  const wa = telefonoWhatsapp(tel)
  const doc = c?.doc_cliente ? `${c.tipodoc_cliente ? c.tipodoc_cliente + ' ' : ''}${fmtDoc(c.doc_cliente)}` : ''
  const boton = 'inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-line-strong px-3 text-[13px] font-semibold text-navy hover:bg-muted'

  const columnas: Columna<PolColapsada>[] = [
    {
      id: 'estado', titulo: 'Estado', ancho: 90,
      celda: (p) => <span className={cn('rounded-full px-2 py-0.5 text-[11.5px] font-semibold', p.vigente ? 'bg-green-soft text-green' : 'bg-muted text-ink-soft')}>{p.vigente ? 'Vigente' : 'Vencida'}</span>,
      ordenar: (p) => Number(p.vigente),
    },
    {
      id: 'nro', titulo: 'Nro. póliza', ancho: 190,
      celda: (p) => (
        <div className="leading-tight">
          <span className="num font-semibold">{p.nro ?? '(sin número)'}</span>
          {p.anexos > 0 && <div className="text-[11.5px] text-ink-soft">+{p.anexos} {p.anexos === 1 ? 'anexo' : 'anexos'}</div>}
        </div>
      ),
      ordenar: (p) => p.nro,
    },
    { id: 'aseg', titulo: 'Aseguradora', ancho: 150, celda: (p) => p.nombreAseg ?? '—', ordenar: (p) => p.nombreAseg?.toLowerCase() },
    { id: 'ramo', titulo: 'Ramo', ancho: 150, celda: (p) => p.nombreRamo ?? '—', ordenar: (p) => p.nombreRamo?.toLowerCase() },
    {
      id: 'bien', titulo: 'Bien asegurado', ancho: 220,
      celda: (p) => nombreBien(p.bien, p.nombreRamo, null, p.obs) ?? '',
      titleDe: (p) => p.placas.join(' · ') || p.bien || undefined,
    },
    { id: 'ffin', titulo: 'F. vence', ancho: 95, celda: (p) => <span className="num">{fmtFecha(aFecha(p.fin)) || '—'}</span>, ordenar: (p) => p.fin },
    { id: 'prima', titulo: 'V. prima', ancho: 120, alinear: 'der', celda: (p) => <span className="num">{p.prima ? fmtDinero(p.prima) : '—'}</span>, ordenar: (p) => p.prima },
  ]

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo={c?.nombre_cliente ?? 'Cliente'}
        subtitulo={[`Cliente ${id}`, doc].filter(Boolean).join(' · ') || undefined}
        volver="/catalogos/clientes"
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            {tel && <a href={`tel:${tel.replace(/[^\d+]/g, '')}`} className={boton}><Phone className="size-4" /> {tel}</a>}
            {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className={boton}><MessageCircle className="size-4 text-green" /> WhatsApp</a>}
            {c?.correo_cliente && <a href={`mailto:${c.correo_cliente}`} className={boton}><Mail className="size-4" /> Correo</a>}
            <Link to={`/catalogos/clientes/${id}/polizas`} className={boton}>Ver todas las pólizas</Link>
          </div>
        }
      />
      <Contenido className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
        {!valido ? (
          <MensajeError error="El código de cliente no es válido." />
        ) : polizas.isError || cliente.isError ? (
          <MensajeError error={mensajeAmigable(polizas.error ?? cliente.error, 'No se pudo cargar el cliente')} />
        ) : polizas.isPending || cliente.isPending ? (
          <Cargando texto="Cargando cliente…" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Cifra titulo="Pólizas vigentes" valor={fmtEntero(resumen.vigentes)} detalle={`${fmtEntero(resumen.vencidas)} vencidas`} />
              <Cifra titulo="Prima vigente" valor={fmtDinero(resumen.primaVigente)} />
              <Cifra titulo="Valor vigente" valor={fmtDinero(resumen.valorVigente)} />
              <Cifra titulo="Aseguradoras" valor={fmtEntero(resumen.aseguradoras)} detalle="con póliza vigente" />
              <Cifra titulo="Cliente desde" valor={resumen.desde ? String(resumen.desde) : '—'} detalle={resumen.desde ? `${resumen.anios} ${resumen.anios === 1 ? 'año' : 'años'}` : undefined} />
            </div>

            <section className="rounded-xl border border-line bg-surface p-4">
              <h2 className="mb-2 text-[14px] font-bold">Cobertura por ramo <span className="font-normal text-ink-soft">(oportunidades de venta cruzada)</span></h2>
              <div className="flex flex-wrap gap-2">
                {cobertura.map((r) => (
                  <span key={r.ramoId} className={cn('rounded-full px-3 py-1 text-[12.5px] font-semibold', ESTILO_RAMO[r.estado])} title={TEXTO_RAMO[r.estado]}>
                    {r.nombre} · {TEXTO_RAMO[r.estado]}
                  </span>
                ))}
                {cobertura.length === 0 && <span className="text-[13px] text-ink-soft">Sin ramos en el catálogo.</span>}
              </div>
            </section>

            <section className="flex min-h-[260px] flex-col">
              <h2 className="mb-2 text-[14px] font-bold">Pólizas</h2>
              <Tabla
                className="min-h-[220px] flex-1"
                filas={lista}
                columnas={columnas}
                clave={(p) => p.id}
                alHacerClic={(p) => navigate(`/polizas/${p.id}`)}
                vacio={<Vacio titulo="Este cliente no tiene pólizas registradas." />}
              />
            </section>

            <section className="rounded-xl border border-line bg-surface p-4">
              <h2 className="mb-2 flex items-center gap-2 text-[14px] font-bold"><History className="size-4" /> Línea de tiempo</h2>
              {linea.length === 0 ? (
                <p className="text-[13px] text-ink-soft">Todavía no hay movimientos.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {linea.map((e, i) => (
                    <li key={i}>
                      <Link to={`/polizas/${e.polizaId}`} className="flex items-center gap-3 rounded-lg px-2 py-1 text-[13px] hover:bg-muted">
                        {e.tipo === 'inicio' ? <CalendarPlus className="size-4 text-green" /> : <CalendarClock className={cn('size-4', e.tipo === 'vence' ? 'text-warning' : 'text-ink-soft')} />}
                        <span className="num w-24 shrink-0 text-ink-soft">{fmtFecha(aFecha(e.fecha))}</span>
                        <span>{e.texto}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </Contenido>
    </div>
  )
}
