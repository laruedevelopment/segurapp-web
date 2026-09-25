import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Cargando, MensajeError, Tarjeta, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { agruparDuplicadas, type GrupoDuplicadas } from '@/datos/cargaMasivaLogica'
import { listarPolizasDuplicadas } from '@/datos/polizas'
import { fmtDinero } from '@/lib/numeros'
import type { PolizaLista } from '@/lib/tipos'
import { cn, mensajeError } from '@/lib/utils'

// Grupos que el usuario tiene desplegados. Vive fuera del componente para que
// revisar una póliza y volver no vuelva a cerrar todo el listado.
const expandidos = new Set<string>()

export default function Duplicadas() {
  const navigate = useNavigate()
  const [, setVersion] = useState(0)

  // vw_polizas_duplicadas ya filtra en la base (solo las repetidas): es una
  // consulta chica, así que se recarga siempre al entrar.
  const consulta = useQuery({
    queryKey: ['polizas', 'duplicadas'],
    queryFn: listarPolizasDuplicadas,
    refetchOnMount: 'always',
  })

  const grupos = useMemo(() => agruparDuplicadas(consulta.data ?? []), [consulta.data])
  const totalPolizas = grupos.reduce((s, g) => s + g.polizas.length, 0)

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
              {grupos.length} {grupos.length === 1 ? 'número repetido' : 'números repetidos'} — {totalPolizas} pólizas en
              total. Se ignoran espacios y guiones al comparar (el mismo criterio que usa la aplicación para detectar
              duplicados al guardar), y solo cuentan como repetidas las de la misma aseguradora. Esta pantalla no borra ni
              modifica nada por sí sola.
            </p>
            <div className="flex flex-col gap-2.5">
              {grupos.map((g) => (
                <Grupo
                  key={g.clave}
                  grupo={g}
                  abierto={expandidos.has(g.clave)}
                  onAlternar={() => alternar(g.clave)}
                  onAbrir={(p) => navigate(`/polizas/${p.id}`)}
                />
              ))}
            </div>
          </>
        )}
      </Contenido>
    </div>
  )
}

function Grupo({
  grupo,
  abierto,
  onAlternar,
  onAbrir,
}: {
  grupo: GrupoDuplicadas<PolizaLista>
  abierto: boolean
  onAlternar: () => void
  onAbrir: (p: PolizaLista) => void
}) {
  const primera = grupo.polizas[0]
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
          <span className="num block truncate font-bold">{primera.nro_poliza ?? '—'}</span>
          <span className="block truncate text-[12.5px] text-ink-soft">
            {grupo.polizas.length} pólizas con este número{primera.nombre_aseg ? ` · ${primera.nombre_aseg}` : ''}
          </span>
        </span>
        {abierto ? <ChevronDown className="size-4 text-ink-soft" /> : <ChevronRight className="size-4 text-ink-soft" />}
      </button>
      {abierto && (
        <div className="divide-y divide-line border-t border-line">
          {grupo.polizas.map((p) => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (window.getSelection()?.toString()) return
                onAbrir(p)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onAbrir(p)
              }}
              className={cn('flex cursor-pointer items-center gap-3 px-4 py-2.5 pl-16 hover:bg-navy-soft/40')}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">
                  <span className="num">#{p.id}</span> — {p.nombre_cliente ?? '—'}
                </div>
                <div className="text-[12px] text-ink-soft">
                  {p.nombre_aseg ?? '—'} · {p.nombre_ramo ?? '—'} ·{' '}
                  {p.bien_asegurado?.trim() ? `${p.bien_asegurado} · ` : ''}
                  Prima: <span className="num">{fmtDinero(p.prima_poliza ?? 0)}</span>
                  {p.nro_poliza != null && (
                    <>
                      {' '}
                      · Nro. exacto: <span className="num">“{p.nro_poliza}”</span>
                    </>
                  )}
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-ink-soft" />
            </div>
          ))}
        </div>
      )}
    </Tarjeta>
  )
}
