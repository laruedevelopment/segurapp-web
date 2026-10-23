import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Building2, CalendarDays, ExternalLink, FilePen, RefreshCw, Search, UserCheck } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Aviso, Cargando, Chip, Etiqueta, MensajeError, Tarjeta, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { AreaTexto, Campo, Input, SelectorSimple } from '@/components/ui/campos'
import { Dialogo } from '@/components/ui/dialogo'
import { buscarContratos, CLAVE_SECOP, guardarSeguimiento, useIndiceClientes, useSeguimientos } from '@/datos/secop'
import {
  DEPARTAMENTOS,
  ESTADOS_OPORTUNIDAD,
  NOMBRE_ESTADO,
  TIPOS_CONTRATO,
  diasDesdeFirma,
  dineroCorto,
  plazoDias,
  puntaje,
  type ContratoSecop,
  type EstadoOportunidad,
} from '@/datos/secopLogica'
import { aFecha, fmtFecha } from '@/lib/fechas'
import { mensajeAmigable } from '@/lib/errores'
import { fmtDinero } from '@/lib/numeros'
import { ES_PRUEBAS } from '@/lib/supabase'

const VALORES_MIN = [
  { valor: '0', etiqueta: 'Cualquier valor' },
  { valor: '20000000', etiqueta: 'Desde $20 millones' },
  { valor: '50000000', etiqueta: 'Desde $50 millones' },
  { valor: '100000000', etiqueta: 'Desde $100 millones' },
  { valor: '500000000', etiqueta: 'Desde $500 millones' },
  { valor: '1000000000', etiqueta: 'Desde $1.000 millones' },
]
const PERIODOS = [
  { valor: '3', etiqueta: 'Últimos 3 días' },
  { valor: '7', etiqueta: 'Últimos 7 días' },
  { valor: '15', etiqueta: 'Últimos 15 días' },
  { valor: '30', etiqueta: 'Últimos 30 días' },
]

const TONO_ESTADO: Record<EstadoOportunidad, 'neutro' | 'navy' | 'alerta' | 'verde' | 'peligro'> = {
  nuevo: 'neutro',
  contactado: 'navy',
  cotizado: 'alerta',
  cerrado: 'verde',
  descartado: 'peligro',
}

/**
 * Oportunidades SECOP: contratos públicos recién firmados. Cada contratista
 * debe comprar pólizas (cumplimiento, responsabilidad civil…), así que cada
 * contrato es un posible cliente. Por ahora solo en el entorno de pruebas.
 */
export default function Oportunidades() {
  const qc = useQueryClient()
  const [departamento, setDepartamento] = useState('Santander')
  const [dias, setDias] = useState('7')
  const [valorMin, setValorMin] = useState('50000000')
  const [tipos, setTipos] = useState<string[]>(['Obra', 'Consultoría', 'Suministros'])
  const [texto, setTexto] = useState('')
  const [verEstado, setVerEstado] = useState<'pendientes' | 'todos'>('pendientes')
  const [editando, setEditando] = useState<ContratoSecop | null>(null)

  const filtro = useMemo(
    () => ({ departamento, dias: Number(dias), valorMin: Number(valorMin), tipos }),
    [departamento, dias, valorMin, tipos],
  )
  const contratos = useQuery({
    queryKey: [...CLAVE_SECOP, 'contratos', filtro],
    queryFn: ({ signal }) => buscarContratos(filtro, signal),
    enabled: ES_PRUEBAS,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  const clientes = useIndiceClientes()
  const seguimientos = useSeguimientos()

  const filas = useMemo(() => {
    const t = texto.trim().toLowerCase()
    const lista = (contratos.data ?? []).map((c) => ({
      c,
      cliente: clientes.data?.(c.documento) ?? null,
      seguimiento: seguimientos.data?.get(c.idContrato) ?? null,
    }))
    return lista
      .filter((f) => (t ? `${f.c.proveedor} ${f.c.entidad} ${f.c.objeto} ${f.c.documento}`.toLowerCase().includes(t) : true))
      .filter((f) => (verEstado === 'pendientes' ? !f.seguimiento || f.seguimiento.estado === 'nuevo' : true))
      .sort((a, b) => puntaje(b.c) - puntaje(a.c) || b.c.valor - a.c.valor)
  }, [contratos.data, clientes.data, seguimientos.data, texto, verEstado])

  const alternarTipo = (t: string) => setTipos((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]))

  if (!ES_PRUEBAS) {
    return (
      <div className="flex h-full flex-col">
        <EncabezadoPagina titulo="Oportunidades SECOP" volver="/" />
        <Contenido>
          <Vacio titulo="Esta función está disponible solo en el entorno de pruebas por ahora." />
        </Contenido>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo="Oportunidades SECOP"
        subtitulo="Contratos públicos recién firmados: cada contratista necesita pólizas"
        volver="/"
        acciones={
          <Boton variante="fantasma" tamano="icono" title="Actualizar" onClick={() => void qc.invalidateQueries({ queryKey: CLAVE_SECOP })} disabled={contratos.isFetching}>
            <RefreshCw className={contratos.isFetching ? 'animate-spin' : ''} />
          </Boton>
        }
      />
      <Contenido className="flex max-w-5xl flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Departamento">
            <SelectorSimple
              valor={departamento}
              onCambio={(v) => v && setDepartamento(v)}
              opciones={DEPARTAMENTOS.map((d) => ({ valor: d, etiqueta: d }))}
            />
          </Campo>
          <Campo etiqueta="Firmados">
            <SelectorSimple valor={dias} onCambio={(v) => v && setDias(v)} opciones={PERIODOS} />
          </Campo>
          <Campo etiqueta="Valor del contrato">
            <SelectorSimple valor={valorMin} onCambio={(v) => v && setValorMin(v)} opciones={VALORES_MIN} />
          </Campo>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-ink-soft">Tipo de contrato:</span>
          {TIPOS_CONTRATO.map((t) => (
            <Chip key={t} activo={tipos.includes(t)} onClick={() => alternarTipo(t)}>
              {t}
            </Chip>
          ))}
          {tipos.length > 0 && (
            <button type="button" className="text-[12px] font-semibold text-navy underline" onClick={() => setTipos([])}>
              Ver todos los tipos
            </button>
          )}
        </div>

        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
          <Input
            className="pl-9"
            aria-label="Buscar en los resultados"
            placeholder="Buscar por contratista, NIT, entidad u objeto del contrato…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip activo={verEstado === 'pendientes'} onClick={() => setVerEstado('pendientes')}>
            Por trabajar
          </Chip>
          <Chip activo={verEstado === 'todos'} onClick={() => setVerEstado('todos')}>
            Todos (incluye ya trabajados)
          </Chip>
          {!contratos.isPending && !contratos.isError && (
            <span className="ml-auto text-[12px] text-ink-soft">
              {filas.length} {filas.length === 1 ? 'contrato' : 'contratos'}
              {(contratos.data?.length ?? 0) >= 300 ? ' (se muestran los 300 más recientes)' : ''}
            </span>
          )}
        </div>

        {seguimientos.isError && (
          <Aviso tono="alerta">
            No se pudo leer el seguimiento de las oportunidades. Si apenas se está configurando, falta aplicar la migración
            <b> oportunidades_secop</b> en la base de datos. Puede ver la lista, pero aún no guardar el estado.
          </Aviso>
        )}

        {contratos.isError ? (
          <MensajeError
            error={
              <div className="flex items-center gap-3">
                <span className="flex-1">{mensajeAmigable(contratos.error, 'No se pudieron cargar los contratos')}</span>
                <Boton tamano="sm" variante="secundario" onClick={() => void contratos.refetch()}>
                  Reintentar
                </Boton>
              </div>
            }
          />
        ) : contratos.isPending ? (
          <Cargando texto="Consultando contratos en datos.gov.co…" />
        ) : filas.length === 0 ? (
          <Vacio
            titulo="No hay contratos con estos filtros."
            detalle="Pruebe con más días, un valor menor o todos los tipos de contrato."
          />
        ) : (
          <div className="flex flex-col gap-2 pb-6">
            {filas.map((f) => (
              <TarjetaContrato key={f.c.idContrato} c={f.c} cliente={f.cliente} seguimiento={f.seguimiento} onTrabajar={() => setEditando(f.c)} />
            ))}
          </div>
        )}
      </Contenido>

      {editando && (
        <DialogoSeguimiento
          c={editando}
          actual={seguimientos.data?.get(editando.idContrato) ?? null}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null)
            void qc.invalidateQueries({ queryKey: [...CLAVE_SECOP, 'seguimiento'] })
          }}
        />
      )}
    </div>
  )
}

function Dato({ etiqueta, valor, mono = false }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-ink-soft">{etiqueta}</div>
      <div className={`text-[13px] font-semibold ${mono ? 'num' : ''}`}>{valor}</div>
    </div>
  )
}

function TarjetaContrato({
  c,
  cliente,
  seguimiento,
  onTrabajar,
}: {
  c: ContratoSecop
  cliente: { id: number; nombre: string } | null
  seguimiento: { estado: EstadoOportunidad; nota: string | null } | null
  onTrabajar: () => void
}) {
  const dias = diasDesdeFirma(c.firma)
  const plazo = plazoDias(c.inicio, c.fin)
  const estado = seguimiento?.estado ?? 'nuevo'
  return (
    <Tarjeta className="px-4 py-3">
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold">{c.proveedor || 'Contratista sin nombre'}</div>
          <div className="flex items-center gap-1.5 text-[12.5px] text-ink-soft [&_svg]:size-3.5 [&_svg]:shrink-0">
            <Building2 />
            <span className="truncate">{c.entidad}</span>
            {c.ciudad && c.ciudad !== 'No Definido' && <span className="shrink-0">· {c.ciudad}</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {cliente && (
            <Etiqueta tono="verde">
              <UserCheck />
              Ya es cliente
            </Etiqueta>
          )}
          <Etiqueta tono={TONO_ESTADO[estado]}>{NOMBRE_ESTADO[estado]}</Etiqueta>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-[13px]">{c.objeto || 'Sin descripción'}</p>

      <div className="mt-2 flex flex-wrap gap-x-7 gap-y-2">
        <Dato etiqueta="Valor del contrato" valor={`${dineroCorto(c.valor)}`} mono />
        <Dato etiqueta="Tipo" valor={c.tipo || '—'} />
        <Dato etiqueta="NIT / documento" valor={c.documento && c.documento !== 'No Definido' ? c.documento : '—'} mono />
        <Dato etiqueta="Plazo" valor={plazo != null ? `${plazo} días` : '—'} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-[18px] gap-y-1.5 border-t border-line pt-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft [&_svg]:size-3.5">
          <CalendarDays />
          Firmado el <span className="num">{fmtFecha(aFecha(c.firma))}</span>
          {dias != null && <> · {dias === 0 ? 'hoy' : dias === 1 ? 'hace 1 día' : `hace ${dias} días`}</>}
        </span>
        <span className="text-[12px] text-ink-soft" title={fmtDinero(c.valor)}>
          {c.modalidad}
        </span>
        {seguimiento?.nota && <span className="text-[12px] text-ink-soft">Nota: {seguimiento.nota}</span>}
        <span className="ml-auto flex items-center gap-1">
          {c.url && (
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex">
              <Boton variante="fantasma" tamano="sm" type="button">
                <ExternalLink />
                Ver en SECOP
              </Boton>
            </a>
          )}
          {cliente && (
            <Link to={`/catalogos/clientes/${cliente.id}/polizas`} className="inline-flex">
              <Boton variante="fantasma" tamano="sm" type="button">
                Ver cliente
              </Boton>
            </Link>
          )}
          <Boton variante="secundario" tamano="sm" onClick={onTrabajar}>
            <FilePen />
            Dar seguimiento
          </Boton>
        </span>
      </div>
    </Tarjeta>
  )
}

function DialogoSeguimiento({
  c,
  actual,
  onCerrar,
  onGuardado,
}: {
  c: ContratoSecop
  actual: { estado: EstadoOportunidad; nota: string | null } | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [estado, setEstado] = useState<EstadoOportunidad>(actual?.estado ?? 'contactado')
  const [nota, setNota] = useState(actual?.nota ?? '')
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    setGuardando(true)
    try {
      await guardarSeguimiento(c, estado, nota)
      toast.success('Seguimiento guardado.')
      onGuardado()
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudo guardar el seguimiento'))
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo="Dar seguimiento"
      descripcion={`${c.proveedor} · ${dineroCorto(c.valor)}`}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton onClick={() => void guardar()} cargando={guardando}>
            Guardar
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Estado">
          {ESTADOS_OPORTUNIDAD.map((e) => (
            <Chip key={e} fuerte activo={estado === e} onClick={() => setEstado(e)}>
              {NOMBRE_ESTADO[e]}
            </Chip>
          ))}
        </div>
        <Campo etiqueta="Nota (opcional)">
          <AreaTexto
            rows={3}
            maxLength={500}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Con quién habló, qué quedó pendiente, valor cotizado…"
          />
        </Campo>
      </div>
    </Dialogo>
  )
}
