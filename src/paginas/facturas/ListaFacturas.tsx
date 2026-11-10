import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FilePlus2, ReceiptText, RefreshCw, Search, Settings2 } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Cargando, Chip, Etiqueta, MensajeError, Tarjeta, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { Input } from '@/components/ui/campos'
import { Tabla, type Columna } from '@/components/ui/tabla'
import { useCatalogo } from '@/datos/catalogos'
import { CLAVE_FACTURAS, LIMITE_FACTURAS, listarFacturas, listarLineasPorFacturar } from '@/datos/facturas'
import {
  ESTADOS_FACTURA,
  NOMBRE_ESTADO_FACTURA,
  agruparPorReporte,
  nombreEstadoFactura,
  numeroFactura,
  type EstadoFactura,
  type Factura,
  type GrupoPorFacturar,
} from '@/datos/facturasLogica'
import { aFecha, fmtFecha } from '@/lib/fechas'
import { mensajeAmigable } from '@/lib/errores'
import { fmtDinero, fmtNum } from '@/lib/numeros'
import { esAdmin, useSesion } from '@/lib/sesion'
import { normalizarTexto } from '@/lib/filtros'
import { DialogoCrearFactura } from './DialogoCrearFactura'

export const TONO_ESTADO: Record<EstadoFactura, 'neutro' | 'navy' | 'alerta' | 'verde' | 'peligro'> = {
  A: 'alerta',
  C: 'neutro',
  R: 'navy',
  P: 'verde',
  N: 'peligro',
}

export function EstadoFacturaEtiqueta({ estado }: { estado: string }) {
  return <Etiqueta tono={TONO_ESTADO[estado as EstadoFactura] ?? 'neutro'}>{nombreEstadoFactura(estado)}</Etiqueta>
}

type Vista = 'facturas' | 'porfacturar'

/**
 * Facturas (cuentas de cobro) de los reportes de comisiones. "Por facturar" lista
 * los reportes que todavía tienen líneas sin factura.
 */
export default function ListaFacturas() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const admin = esAdmin(useSesion()?.usuario)
  const [vista, setVista] = useState<Vista>('facturas')
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<EstadoFactura | null>(null)
  const [creando, setCreando] = useState<GrupoPorFacturar | null>(null)

  const aseguradoras = useCatalogo('aseguradoras')
  const intermediarios = useCatalogo('intermediarios')

  const facturas = useQuery({
    queryKey: [...CLAVE_FACTURAS, 'lista', estado],
    queryFn: () => listarFacturas({ estado }),
    staleTime: 0,
    placeholderData: (previa) => previa,
  })
  const lineas = useQuery({ queryKey: [...CLAVE_FACTURAS, 'porfacturar'], queryFn: listarLineasPorFacturar, staleTime: 0 })

  const grupos = useMemo(() => agruparPorReporte(lineas.data ?? []), [lineas.data])
  const nombreAseg = (id: number | null) => aseguradoras.data?.find((a) => a.id === id)?.nombre_aseg ?? '—'
  const nombreInterm = (id: number | null) => intermediarios.data?.find((i) => i.id === id)?.nombre_interm ?? '—'

  const filtradas = useMemo(() => {
    const t = normalizarTexto(texto.trim())
    const lista = facturas.data ?? []
    if (!t) return lista
    return lista.filter((f) =>
      normalizarTexto(
        `${numeroFactura(f.prefijo, f.numFactura)} ${f.nombreAseg ?? ''} ${f.nombreInterm ?? ''} ${f.empresaNombre ?? ''} ${f.empresaNit ?? ''} ${fmtFecha(aFecha(f.fecha))}`,
      ).includes(t),
    )
  }, [facturas.data, texto])

  const refrescar = () => void qc.invalidateQueries({ queryKey: CLAVE_FACTURAS })

  const columnas: Columna<Factura>[] = [
    {
      id: 'num',
      titulo: 'Número',
      ancho: 90,
      celda: (f) => <span className="num font-semibold">{numeroFactura(f.prefijo, f.numFactura)}</span>,
      ordenar: (f) => f.prefijo * 1e9 + f.numFactura,
    },
    { id: 'fecha', titulo: 'Fecha', ancho: 100, celda: (f) => <span className="num">{fmtFecha(aFecha(f.fecha))}</span>, ordenar: (f) => f.fecha },
    { id: 'aseg', titulo: 'Aseguradora', ancho: 170, celda: (f) => f.nombreAseg ?? '—', ordenar: (f) => f.nombreAseg?.toLowerCase(), titleDe: (f) => f.nombreAseg ?? undefined },
    {
      id: 'empresa',
      titulo: 'Empresa aseguradora',
      ancho: 230,
      celda: (f) => (f.empresaNombre ? `${f.empresaNombre}${f.empresaNit ? ` · ${f.empresaNit}` : ''}` : '—'),
      ordenar: (f) => f.empresaNombre?.toLowerCase(),
      titleDe: (f) => (f.empresaNombre ? `${f.empresaNombre} · ${f.empresaNit ?? ''}` : undefined),
    },
    { id: 'interm', titulo: 'Intermediario', ancho: 160, celda: (f) => f.nombreInterm ?? '—', ordenar: (f) => f.nombreInterm?.toLowerCase() },
    { id: 'sub', titulo: 'Subtotal', ancho: 120, alinear: 'der', celda: (f) => <span className="num">{fmtDinero(f.subtotal)}</span>, ordenar: (f) => f.subtotal },
    { id: 'iva', titulo: 'IVA', ancho: 100, alinear: 'der', celda: (f) => <span className="num">{fmtDinero(f.iva)}</span>, ordenar: (f) => f.iva },
    { id: 'total', titulo: 'Total', ancho: 120, alinear: 'der', celda: (f) => <span className="num">{fmtDinero(f.total)}</span>, ordenar: (f) => f.total },
    { id: 'neto', titulo: 'A consignar', ancho: 125, alinear: 'der', celda: (f) => <span className="num font-semibold">{fmtDinero(f.neto)}</span>, ordenar: (f) => f.neto },
    { id: 'estado', titulo: 'Estado', ancho: 105, celda: (f) => <EstadoFacturaEtiqueta estado={f.estado} />, ordenar: (f) => f.estado },
  ]

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo="Facturas"
        subtitulo="Cuentas de cobro de los reportes de comisiones"
        volver="/"
        acciones={
          <>
            {admin && (
              <Boton variante="secundario" tamano="sm" onClick={() => navigate('/facturas/ajustes')}>
                <Settings2 />
                Ajustes
              </Boton>
            )}
            <Boton variante="fantasma" tamano="icono" title="Actualizar" onClick={refrescar} disabled={facturas.isFetching || lineas.isFetching}>
              <RefreshCw className={facturas.isFetching || lineas.isFetching ? 'animate-spin' : ''} />
            </Boton>
          </>
        }
      />
      <Contenido className="flex min-h-0 max-w-none flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip activo={vista === 'facturas'} onClick={() => setVista('facturas')}>
            <ReceiptText />
            Facturas
          </Chip>
          <Chip activo={vista === 'porfacturar'} onClick={() => setVista('porfacturar')}>
            <FilePlus2 />
            Por facturar ({grupos.length})
          </Chip>
        </div>

        {vista === 'facturas' ? (
          <>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
              <Input
                className="pl-9"
                aria-label="Buscar facturas"
                placeholder="Buscar por número, aseguradora, empresa, NIT o fecha…"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip activo={estado == null} onClick={() => setEstado(null)}>
                Todas
              </Chip>
              {ESTADOS_FACTURA.map((e) => (
                <Chip key={e} activo={estado === e} onClick={() => setEstado(e)}>
                  {NOMBRE_ESTADO_FACTURA[e]}
                </Chip>
              ))}
              {!facturas.isPending && !facturas.isError && (
                <span className="ml-auto text-[12px] text-ink-soft">
                  {fmtNum(filtradas.length)} {filtradas.length === 1 ? 'factura' : 'facturas'}
                  {(facturas.data?.length ?? 0) >= LIMITE_FACTURAS ? ` (las ${fmtNum(LIMITE_FACTURAS)} más recientes)` : ''}
                </span>
              )}
            </div>
            {facturas.isError ? (
              <MensajeError
                error={
                  <div className="flex items-center gap-3">
                    <span className="flex-1">
                      {mensajeAmigable(facturas.error, 'No se pudieron cargar las facturas')} Si es la primera vez, falta aplicar la migración <b>facturas</b>.
                    </span>
                    <Boton tamano="sm" variante="secundario" onClick={() => void facturas.refetch()}>
                      Reintentar
                    </Boton>
                  </div>
                }
              />
            ) : facturas.isPending ? (
              <Cargando texto="Cargando facturas…" />
            ) : (
              <Tabla
                className="min-h-[320px] flex-1"
                filas={filtradas}
                columnas={columnas}
                clave={(f) => f.id}
                claveAnchos="facturas"
                ordenInicial={{ columna: 'fecha', asc: false }}
                alHacerClic={(f) => navigate(`/facturas/${f.id}`)}
                vacio={<Vacio titulo="No hay facturas con estos filtros." detalle="Cree una desde la pestaña Por facturar." />}
              />
            )}
          </>
        ) : lineas.isError ? (
          <MensajeError error={mensajeAmigable(lineas.error, 'No se pudieron cargar las líneas por facturar')} />
        ) : lineas.isPending ? (
          <Cargando texto="Buscando líneas sin factura…" />
        ) : grupos.length === 0 ? (
          <Vacio titulo="No hay líneas por facturar." detalle="Todas las líneas de los reportes ya están en una factura." />
        ) : (
          <div className="flex flex-col gap-2 pb-6">
            {grupos.map((g) => (
              <Tarjeta key={g.reporteId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold">
                    Reporte #{g.reporteId} · {nombreAseg(g.asegId)}
                  </div>
                  <div className="text-[12.5px] text-ink-soft">
                    {nombreInterm(g.intermId)} · {g.fecha ? fmtFecha(aFecha(g.fecha)) : 'sin fecha'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-ink-soft">{g.lineas === 1 ? '1 línea sin factura' : `${g.lineas} líneas sin factura`}</div>
                  <div className="num text-[14px] font-bold">{fmtDinero(g.comision)}</div>
                </div>
                <Boton variante="verde" tamano="sm" onClick={() => setCreando(g)} disabled={g.asegId == null}>
                  <FilePlus2 />
                  Crear factura
                </Boton>
              </Tarjeta>
            ))}
          </div>
        )}
      </Contenido>

      {creando && creando.asegId != null && (
        <DialogoCrearFactura
          reporteId={creando.reporteId}
          asegId={creando.asegId}
          intermId={creando.intermId}
          onCerrar={() => setCreando(null)}
          onCreada={(id) => {
            setCreando(null)
            refrescar()
            navigate(`/facturas/${id}`)
          }}
        />
      )}
    </div>
  )
}
