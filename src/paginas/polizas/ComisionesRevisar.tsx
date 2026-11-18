import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Aviso, Cargando, MensajeError, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { CLAVE_COMISIONES_REVISAR, listarComisionesSospechosas } from '@/datos/comisionesRevision'
import { causaAmigable } from '@/lib/errores'
import { aFecha, fmtFecha } from '@/lib/fechas'
import { fmtDinero, fmtPct } from '@/lib/numeros'

/** Pólizas con un % de comisión sin lógica (mayor a 100 % o negativo), para que el personal las revise. */
export default function ComisionesRevisar() {
  const consulta = useQuery({ queryKey: CLAVE_COMISIONES_REVISAR, queryFn: listarComisionesSospechosas, refetchOnMount: 'always' })
  const filas = consulta.data ?? []

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo="Comisiones por revisar"
        subtitulo="Pólizas con un % de comisión mayor a 100 %"
        volver="/"
        acciones={
          <Boton variante="fantasma" tamano="icono" title="Recargar" onClick={() => void consulta.refetch()} disabled={consulta.isFetching}>
            <RefreshCw className={consulta.isFetching ? 'animate-spin' : ''} />
          </Boton>
        }
      />
      <Contenido className="flex max-w-5xl flex-col gap-4">
        {consulta.isError && !consulta.data ? (
          <MensajeError error={causaAmigable(consulta.error, 'No se pudieron cargar las pólizas')} />
        ) : consulta.isPending ? (
          <Cargando texto="Buscando comisiones…" />
        ) : filas.length === 0 ? (
          <Vacio icono={<CheckCircle2 className="text-green" />} titulo="No hay pólizas con un % de comisión mayor a 100 %." />
        ) : (
          <>
            <Aviso>
              Una comisión no puede pasar del 100 % de la base. Abra cada póliza y corrija el % de comisión (y, si hace falta, el % del producto en
              Catálogos → Productos). La app no cambia nada por su cuenta.
            </Aviso>
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full text-[13px]">
                <thead className="bg-surface-2 text-left text-ink-soft">
                  <tr>
                    <th className="px-3 py-2">Póliza</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2">Expedición</th>
                    <th className="px-3 py-2 text-right">Prima</th>
                    <th className="px-3 py-2 text-right">% Com.</th>
                    <th className="px-3 py-2 text-right">Comisión</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((p) => (
                    <tr key={p.id} className="border-t border-line">
                      <td className="px-3 py-2">
                        <Link to={`/polizas/${p.id}`} className="num font-medium text-navy underline-offset-2 hover:underline">
                          {p.nro_poliza ?? `#${p.id}`}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{p.cliente?.nombre_cliente ?? '—'}</td>
                      <td className="px-3 py-2">{p.producto?.nombre_prod ?? '—'}</td>
                      <td className="px-3 py-2">{fmtFecha(aFecha(p.fexp_poliza))}</td>
                      <td className="num px-3 py-2 text-right">{fmtDinero(p.prima_poliza ?? 0)}</td>
                      <td className="num px-3 py-2 text-right font-bold text-danger">{fmtPct(p.porccom_poliza)}</td>
                      <td className="num px-3 py-2 text-right">{fmtDinero(p.vlrcom_poliza ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[12px] text-ink-soft">{filas.length} {filas.length === 1 ? 'póliza' : 'pólizas'} (máximo 500).</p>
          </>
        )}
      </Contenido>
    </div>
  )
}
