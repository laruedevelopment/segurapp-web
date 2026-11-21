import { ES_AMBIENTE_PRUEBAS } from '@/lib/ambiente'
import { etiquetaOrigen, etiquetaOrigenCorta } from '@/paginas/polizas/formulario/origen'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { Boton } from '@/components/ui/button'
import { Tabla, type Columna } from '@/components/ui/tabla'
import { fmtDinero } from '@/lib/numeros'
import { fmtFecha } from '@/lib/fechas'
import { nombreBien } from '@/lib/placa'
import { mensajeAmigable } from '@/lib/errores'
import { type FilaReporte } from '@/paginas/reportes/calculos'
import { fmtEntero } from '@/paginas/dashboard/formato'
import type { PropsTab } from './comun'
import { filasHojaVencimientos, nombreHojaVencimientos, totales, valorDe } from './logica'

const bienDe = (r: FilaReporte) => nombreBien(r.p.bien_asegurado, r.p.nombre_ramo, r.p.nombre_prod, r.p.obs_poliza) ?? ''

/** Detalle de pólizas (la página "Detalle" del Power BI), con búsqueda, total y exportación a Excel. */
export default function TabPolizas({ filas, filtros, hoy }: PropsTab) {
  const navigate = useNavigate()
  const [exportando, setExportando] = useState(false)
  const t = useMemo(() => totales(filas), [filas])

  const columnas: Columna<FilaReporte>[] = useMemo(
    () => [
      { id: 'fini', titulo: 'F. Inicio', ancho: 100, celda: (r) => <span className="num">{r.fini ? fmtFecha(r.fini) : '—'}</span>, ordenar: (r) => r.fini?.getTime() ?? 0 },
      { id: 'ffin', titulo: 'F. Vencim.', ancho: 100, celda: (r) => <span className="num">{r.ffin ? fmtFecha(r.ffin) : '—'}</span>, ordenar: (r) => r.ffin?.getTime() ?? 0 },
      { id: 'cliente', titulo: 'Cliente', ancho: 260, celda: (r) => <span className="truncate">{r.p.nombre_cliente ?? '—'}</span>, ordenar: (r) => (r.p.nombre_cliente ?? '').toLowerCase(), titleDe: (r) => r.p.nombre_cliente ?? undefined },
      { id: 'bien', titulo: 'Bien asegurado', ancho: 200, celda: (r) => <span className="truncate">{bienDe(r) || '—'}</span>, ordenar: (r) => bienDe(r).toLowerCase(), titleDe: (r) => r.p.bien_asegurado ?? undefined },
      { id: 'id', titulo: 'Código', ancho: 80, celda: (r) => <span className="num">{r.p.id}</span>, ordenar: (r) => r.p.id },
      { id: 'nro', titulo: 'Nro. póliza', ancho: 170, celda: (r) => <span className="num truncate">{r.p.nro_poliza ?? 'sin número'}</span>, ordenar: (r) => r.p.nro_poliza ?? '' },
      { id: 'aseg', titulo: 'Aseguradora', ancho: 150, celda: (r) => <span className="truncate">{r.p.nombre_aseg ?? '—'}</span>, ordenar: (r) => (r.p.nombre_aseg ?? '').toLowerCase() },
      { id: 'ramo', titulo: 'Ramo', ancho: 150, celda: (r) => <span className="truncate">{r.p.nombre_ramo ?? '—'}</span>, ordenar: (r) => (r.p.nombre_ramo ?? '').toLowerCase() },
      { id: 'prod', titulo: 'Producto', ancho: 170, celda: (r) => <span className="truncate">{r.p.nombre_prod ?? '—'}</span>, ordenar: (r) => (r.p.nombre_prod ?? '').toLowerCase() },
      { id: 'asesor', titulo: 'Asesor', ancho: 150, celda: (r) => <span className="truncate">{r.p.nombre_asesor ?? '—'}</span>, ordenar: (r) => (r.p.nombre_asesor ?? '').toLowerCase() },
      ...(ES_AMBIENTE_PRUEBAS
        ? [{ id: 'origen', titulo: 'Origen', ancho: 90, celda: (r: FilaReporte) => <span title={etiquetaOrigen(r.p.origen)}>{etiquetaOrigenCorta(r.p.origen)}</span>, ordenar: (r: FilaReporte) => r.p.origen ?? '' }]
        : []),
      { id: 'valor', titulo: 'Valor póliza', ancho: 130, alinear: 'der', celda: (r) => <span className="num">{fmtDinero(valorDe(r))}</span>, ordenar: valorDe },
      { id: 'prima', titulo: 'Prima', ancho: 130, alinear: 'der', celda: (r) => <span className="num">{fmtDinero(r.prima)}</span>, ordenar: (r) => r.prima },
    ],
    [],
  )

  const exportar = async () => {
    setExportando(true)
    await new Promise((r) => setTimeout(r, 50))
    try {
      const { descargarExcel } = await import('@/paginas/reportes/excel')
      descargarExcel(filas, filasHojaVencimientos(filas, filtros, hoy), hoy, nombreHojaVencimientos())
      toast.success('Excel generado correctamente.')
    } catch (e) {
      toast.error(`Error al exportar: ${mensajeAmigable(e)}`)
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-[13px]">
        <span><b className="num">{fmtEntero(t.registros)}</b> registros</span>
        <span>Valor póliza <b className="num">{fmtDinero(t.valor)}</b></span>
        <span>Prima <b className="num">{fmtDinero(t.prima)}</b></span>
        <Boton variante="verde" tamano="sm" className="ml-auto" onClick={exportar} cargando={exportando} title="Exportar a Excel lo que está filtrado">
          {!exportando && <FileSpreadsheet />}
          Exportar a Excel
        </Boton>
      </div>
      <div className="h-[calc(100dvh-24rem)] min-h-[360px]">
        <Tabla
          filas={filas}
          columnas={columnas}
          clave={(r) => r.p.id}
          alHacerClic={(r) => navigate(`/polizas/${r.p.id}`)}
          altoFila={40}
          claveAnchos="tablero-polizas"
          ordenInicial={{ columna: 'fini', asc: false }}
          vacio="Ninguna póliza coincide con los filtros."
        />
      </div>
    </div>
  )
}
