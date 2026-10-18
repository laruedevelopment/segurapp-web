import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Ban, CheckCircle2, ChevronDown, ChevronRight, RefreshCw, Wallet } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Cargando, Chip, Etiqueta, MensajeError, Tarjeta, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { agruparDuplicadas, type GrupoDuplicadas } from '@/datos/cargaMasivaLogica'
import { listarPolizasDuplicadas } from '@/datos/polizas'
import { aFecha, fmtFecha } from '@/lib/fechas'
import { fmtDinero } from '@/lib/numeros'
import { useSesion, veComisiones } from '@/lib/sesion'
import type { PolizaLista } from '@/lib/tipos'
import { cn, mensajeError } from '@/lib/utils'
import { DialogoAnular } from './DialogoAnular'
import {
  AYUDA_TIPO,
  ETIQUETA_TIPO,
  TIPOS_GRUPO,
  estaAnulada,
  grupoResuelto,
  polizasActivas,
  resumirGrupos,
  tipoDeGrupo,
  type TipoGrupo,
} from './duplicadasLogica'

// Grupos que el usuario tiene desplegados. Vive fuera del componente para que
// revisar una póliza y volver no vuelva a cerrar todo el listado.
const expandidos = new Set<string>()

const TONO_TIPO: Record<TipoGrupo, 'verde' | 'alerta' | 'peligro'> = {
  identicas: 'verde',
  distintaPrimaOVigencia: 'alerta',
  distintoCliente: 'peligro',
}

export default function Duplicadas() {
  const navigate = useNavigate()
  const [, setVersion] = useState(0)
  const [filtro, setFiltro] = useState<TipoGrupo | null>(null)
  const [incluirResueltos, setIncluirResueltos] = useState(false)
  const [anulando, setAnulando] = useState<number | null>(null)
  const verPagos = veComisiones(useSesion()?.usuario)

  // vw_polizas_duplicadas ya filtra en la base (solo las repetidas): es una
  // consulta chica, así que se recarga siempre al entrar.
  const consulta = useQuery({
    queryKey: ['polizas', 'duplicadas'],
    queryFn: listarPolizasDuplicadas,
    refetchOnMount: 'always',
  })

  const grupos = useMemo(() => agruparDuplicadas(consulta.data ?? []), [consulta.data])
  const resumen = useMemo(
    () =>
      resumirGrupos(
        grupos.map((g) => g.polizas),
        incluirResueltos,
        filtro,
      ),
    [grupos, incluirResueltos, filtro],
  )
  const visibles = useMemo(() => {
    const porGrupo = new Map(grupos.map((g) => [g.polizas, g]))
    return resumen.visibles.map((p) => porGrupo.get(p)!)
  }, [grupos, resumen.visibles])

  const alternar = (clave: string) => {
    if (expandidos.has(clave)) expandidos.delete(clave)
    else expandidos.add(clave)
    setVersion((v) => v + 1)
  }

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo="Pólizas con número repetido"
        volver="/polizas"
        acciones={
          <Boton
            variante="fantasma"
            tamano="icono"
            title="Recargar"
            onClick={() => void consulta.refetch()}
            disabled={consulta.isFetching}
          >
            <RefreshCw className={consulta.isFetching ? 'animate-spin' : ''} />
          </Boton>
        }
      />
      <Contenido className="flex max-w-4xl flex-col gap-4">
        {consulta.isError && !consulta.data ? (
          <MensajeError
            error={
              <div className="flex items-center gap-3">
                <span className="flex-1">No se pudieron cargar las pólizas repetidas: {mensajeError(consulta.error)}</span>
                <Boton tamano="sm" variante="secundario" onClick={() => void consulta.refetch()}>
                  Reintentar
                </Boton>
              </div>
            }
          />
        ) : consulta.isPending ? (
          <Cargando texto="Buscando números repetidos…" />
        ) : grupos.length === 0 ? (
          <Vacio icono={<CheckCircle2 className="text-green" />} titulo="No hay números de póliza repetidos." />
        ) : (
          <>
            <p className="text-[13px] text-ink-soft">
              {visibles.length} número(s) repetido(s) — {resumen.totalPolizas} póliza(s). Se ignoran espacios y guiones
              al comparar y solo cuenta la misma aseguradora. Aquí puede ver los pagos de cada póliza, corregirla o
              anular la que sobra; nada se borra ni cambia solo.
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip activo={filtro == null} onClick={() => setFiltro(null)}>
                Todos ({resumen.base.length})
              </Chip>
              {TIPOS_GRUPO.map((t) => (
                <span key={t} title={AYUDA_TIPO[t]}>
                  <Chip activo={filtro === t} onClick={() => setFiltro(filtro === t ? null : t)}>
                    {ETIQUETA_TIPO[t]} ({resumen.conteo[t]})
                  </Chip>
                </span>
              ))}
              <Chip activo={incluirResueltos} onClick={() => setIncluirResueltos((v) => !v)}>
                Incluir ya resueltos ({resumen.resueltos})
              </Chip>
            </div>
            {visibles.length === 0 && (
              <p className="py-6 text-center text-ink-soft">No hay grupos con este filtro.</p>
            )}
            <div className="flex flex-col gap-2.5">
              {visibles.map((g) => (
                <Grupo
                  key={g.clave}
                  grupo={g}
                  abierto={expandidos.has(g.clave)}
                  verPagos={verPagos}
                  onAlternar={() => alternar(g.clave)}
                  onAbrir={(p) => navigate(`/polizas/${p.id}`)}
                  onAnular={(p) => setAnulando(p.id)}
                />
              ))}
            </div>
          </>
        )}
      </Contenido>
      <DialogoAnular
        idPoliza={anulando}
        onCerrar={(cambio) => {
          setAnulando(null)
          if (cambio) void consulta.refetch()
        }}
      />
    </div>
  )
}

function Grupo({
  grupo,
  abierto,
  verPagos,
  onAlternar,
  onAbrir,
  onAnular,
}: {
  grupo: GrupoDuplicadas<PolizaLista>
  abierto: boolean
  verPagos: boolean
  onAlternar: () => void
  onAbrir: (p: PolizaLista) => void
  onAnular: (p: PolizaLista) => void
}) {
  const primera = grupo.polizas[0]
  const resuelto = grupoResuelto(grupo.polizas)
  const tipo = tipoDeGrupo(grupo.polizas)
  return (
    <Tarjeta className="overflow-hidden">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={onAlternar}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60"
      >
        <span className="num flex size-9 shrink-0 items-center justify-center rounded-full bg-warning-soft font-bold text-warning-ink">
          {grupo.polizas.length}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="num block truncate font-bold">{primera.nro_poliza ?? '—'}</span>
            <Etiqueta tono={resuelto ? 'neutro' : TONO_TIPO[tipo]}>{resuelto ? 'Resuelto' : ETIQUETA_TIPO[tipo]}</Etiqueta>
          </span>
          <span className="block truncate text-[12.5px] text-ink-soft">
            {grupo.polizas.length} pólizas con este número · {polizasActivas(grupo.polizas).length} activa(s)
            {primera.nombre_aseg ? ` · ${primera.nombre_aseg}` : ''}
          </span>
        </span>
        {abierto ? <ChevronDown className="size-4 text-ink-soft" /> : <ChevronRight className="size-4 text-ink-soft" />}
      </button>
      {abierto && (
        <div className="divide-y divide-line border-t border-line">
          {grupo.polizas.map((p) => {
            const anulada = estaAnulada(p)
            const ini = fmtFecha(aFecha(p.fini_poliza))
            const fin = fmtFecha(aFecha(p.ffin_poliza))
            const vigencia = p.fini_poliza || p.ffin_poliza ? `${ini || '?'} – ${fin || '?'}` : null
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (window.getSelection()?.toString()) return
                  onAbrir(p)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target === e.currentTarget) onAbrir(p)
                }}
                className={cn('flex cursor-pointer items-center gap-3 px-4 py-2.5 pl-16 hover:bg-navy-soft/40')}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13.5px] font-medium">
                    <span className={cn('min-w-0 truncate', anulada && 'text-ink-soft line-through')}>
                      <span className="num">#{p.id}</span> — {p.nombre_cliente ?? '—'}
                    </span>
                    {anulada && <Etiqueta tono="peligro">ANULADA</Etiqueta>}
                  </div>
                  <div className="text-[12px] text-ink-soft">
                    {p.nombre_aseg ?? '—'} · {p.nombre_ramo ?? '—'} ·{' '}
                    {p.bien_asegurado?.trim() ? `${p.bien_asegurado} · ` : ''}
                    Prima: <span className="num">{fmtDinero(p.prima_poliza ?? 0)}</span>
                    {vigencia && (
                      <>
                        {' '}
                        · Vigencia: <span className="num">{vigencia}</span>
                      </>
                    )}
                    {p.nro_poliza != null && (
                      <>
                        {' '}
                        · Nro. exacto: <span className="num">“{p.nro_poliza}”</span>
                      </>
                    )}
                  </div>
                </div>
                {verPagos && (
                  <Link
                    to={`/polizas/${p.id}/pagos`}
                    title="Ver pagos"
                    aria-label="Ver pagos"
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-lg p-2 text-navy hover:bg-muted"
                  >
                    <Wallet className="size-5" />
                  </Link>
                )}
                {!anulada && (
                  <button
                    type="button"
                    title="Anular esta póliza"
                    aria-label="Anular esta póliza"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAnular(p)
                    }}
                    className="rounded-lg p-2 text-danger hover:bg-danger-soft"
                  >
                    <Ban className="size-5" />
                  </button>
                )}
                <ChevronRight className="size-4 shrink-0 text-ink-soft" />
              </div>
            )
          })}
        </div>
      )}
    </Tarjeta>
  )
}
