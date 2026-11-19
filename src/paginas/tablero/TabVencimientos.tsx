import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AlarmClock, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { Boton } from '@/components/ui/button'
import { Aviso } from '@/components/ui/basicos'
import { Tabla, type Columna } from '@/components/ui/tabla'
import { fmtDinero } from '@/lib/numeros'
import { fmtFecha } from '@/lib/fechas'
import { nombreBien } from '@/lib/placa'
import { mensajeAmigable } from '@/lib/errores'
import { semaforo, textoDias, type Semaforo } from '@/datos/vencimientosLogica'
import { type FilaReporte } from '@/paginas/reportes/calculos'
import { fmtEntero } from '@/paginas/dashboard/formato'
import { ES_PRUEBAS } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { PropsTab } from './comun'
import { diasVence, filtrarTablero, rangoVencimiento, totales, valorDe } from './logica'

const GRUPOS: { sem: Semaforo; texto: string; clase: string }[] = [
  { sem: 'vencida', texto: 'vencidas', clase: 'bg-danger text-white' },
  { sem: 'rojo', texto: 'urgentes (15 días o menos)', clase: 'bg-danger-soft text-danger' },
  { sem: 'ambar', texto: 'próximas (16 a 30)', clase: 'bg-warning-soft text-warning-ink' },
  { sem: 'verde', texto: 'con tiempo (más de 30)', clase: 'bg-green-soft text-green-ink' },
]
const TONO: Record<Semaforo, string> = { vencida: 'text-danger', rojo: 'text-danger', ambar: 'text-warning-ink', verde: 'text-green-ink' }
const bienDe = (r: FilaReporte) => nombreBien(r.p.bien_asegurado, r.p.nombre_ramo, r.p.nombre_prod) ?? ''

/** Pólizas por vencer: la ventana se elige arriba en "F. vencimiento" (sin elegirla, los siguientes 12 meses). */
export default function TabVencimientos({ todas, filtros, hoy }: PropsTab) {
  const navigate = useNavigate()
  const [sem, setSem] = useState<Semaforo | null>(null)
  const [exportando, setExportando] = useState(false)
  const sinVentana = !filtros.ffinRel && !filtros.ffinRango.desde && !filtros.ffinRango.hasta

  // Misma lista de pólizas con los filtros de arriba; si no hay ventana de vencimiento, la de 12 meses.
  const filas = useMemo(() => {
    const f = sinVentana ? { ...filtros, ffinRel: { sentido: 'siguiente' as const, n: 12, unidad: 'meses' as const } } : filtros
    return filtrarTablero(todas, f, hoy)
      .filter((r) => r.ffin)
      .sort((a, b) => a.ffin!.getTime() - b.ffin!.getTime())
  }, [todas, filtros, hoy, sinVentana])

  const cuenta = (s: Semaforo) => filas.filter((r) => semaforo(diasVence(r, hoy) ?? 0) === s).length
  const visibles = useMemo(() => (sem ? filas.filter((r) => semaforo(diasVence(r, hoy) ?? 0) === sem) : filas), [filas, sem, hoy])
  const t = useMemo(() => totales(visibles), [visibles])

  const columnas: Columna<FilaReporte>[] = useMemo(
    () => [
      {
        id: 'dias',
        titulo: 'Vence',
        ancho: 130,
        celda: (r) => {
          const d = diasVence(r, hoy) ?? 0
          return <span className={cn('font-semibold', TONO[semaforo(d)])}>{textoDias(d)}</span>
        },
        ordenar: (r) => diasVence(r, hoy) ?? 0,
      },
      { id: 'ffin', titulo: 'F. Venc.', ancho: 100, celda: (r) => <span className="num">{fmtFecha(r.ffin)}</span>, ordenar: (r) => r.ffin?.getTime() ?? 0 },
      { id: 'cliente', titulo: 'Cliente', ancho: 260, celda: (r) => <span className="truncate">{r.p.nombre_cliente ?? '—'}</span>, ordenar: (r) => (r.p.nombre_cliente ?? '').toLowerCase(), titleDe: (r) => r.p.nombre_cliente ?? undefined },
      { id: 'bien', titulo: 'Bien asegurado', ancho: 200, celda: (r) => <span className="truncate">{bienDe(r) || '—'}</span>, ordenar: (r) => bienDe(r).toLowerCase(), titleDe: (r) => r.p.bien_asegurado ?? undefined },
      { id: 'id', titulo: 'Código', ancho: 80, celda: (r) => <span className="num">{r.p.id}</span>, ordenar: (r) => r.p.id },
      { id: 'nro', titulo: 'Nro. póliza', ancho: 170, celda: (r) => <span className="num truncate">{r.p.nro_poliza ?? 'sin número'}</span>, ordenar: (r) => r.p.nro_poliza ?? '' },
      { id: 'aseg', titulo: 'Aseguradora', ancho: 150, celda: (r) => <span className="truncate">{r.p.nombre_aseg ?? '—'}</span>, ordenar: (r) => (r.p.nombre_aseg ?? '').toLowerCase() },
      { id: 'ramo', titulo: 'Ramo', ancho: 150, celda: (r) => <span className="truncate">{r.p.nombre_ramo ?? '—'}</span>, ordenar: (r) => (r.p.nombre_ramo ?? '').toLowerCase() },
      { id: 'asesor', titulo: 'Asesor', ancho: 150, celda: (r) => <span className="truncate">{r.p.nombre_asesor ?? '—'}</span>, ordenar: (r) => (r.p.nombre_asesor ?? '').toLowerCase() },
      { id: 'tel', titulo: 'Teléfono', ancho: 130, celda: (r) => <span className="num">{r.p.tel_cliente ?? '—'}</span> },
      { id: 'valor', titulo: 'Valor póliza', ancho: 130, alinear: 'der', celda: (r) => <span className="num">{fmtDinero(valorDe(r))}</span>, ordenar: valorDe },
      { id: 'prima', titulo: 'Prima', ancho: 130, alinear: 'der', celda: (r) => <span className="num">{fmtDinero(r.prima)}</span>, ordenar: (r) => r.prima },
    ],
    [hoy],
  )

  const exportar = async () => {
    setExportando(true)
    await new Promise((r) => setTimeout(r, 50))
    try {
      const { descargarExcel } = await import('@/paginas/reportes/excel')
      const rv = rangoVencimiento(filtros, hoy)
      const dias = rv.hasta ? Math.max(0, Math.round((rv.hasta.getTime() - hoy.getTime()) / 86_400_000)) : 365
      descargarExcel(visibles, visibles, hoy, `Vencimientos ${dias} días`)
      toast.success('Excel generado correctamente.')
    } catch (e) {
      toast.error(`Error al exportar: ${mensajeAmigable(e)}`)
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {sinVentana && (
        <Aviso tono="navy" icono={<AlarmClock />}>
          Mostrando los <b>siguientes 12 meses</b>. Cambie la ventana en el filtro "F. vencimiento" de arriba (por ejemplo, "Siguientes 30 días" o "Anteriores 30 días" para las ya vencidas).
        </Aviso>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {GRUPOS.map((g) => (
          <button
            key={g.sem}
            type="button"
            aria-pressed={sem === g.sem}
            onClick={() => setSem(sem === g.sem ? null : g.sem)}
            className={cn('inline-flex h-8 items-center rounded-full px-3 text-[12.5px] font-semibold transition-all', g.clase, sem === g.sem ? 'ring-2 ring-ink/50' : sem ? 'opacity-50' : '')}
          >
            {fmtEntero(cuenta(g.sem))} {g.texto}
          </button>
        ))}
        {ES_PRUEBAS && (
          <Link to="/polizas/vencimientos" className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line-strong px-3 text-[13px] font-semibold text-navy hover:bg-muted">
            <AlarmClock className="size-4" /> Abrir seguimiento (llamadas y estados)
          </Link>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-[13px]">
        <span><b className="num">{fmtEntero(t.registros)}</b> registros</span>
        <span>Valor póliza <b className="num">{fmtDinero(t.valor)}</b></span>
        <span>Prima <b className="num">{fmtDinero(t.prima)}</b></span>
        <Boton variante="verde" tamano="sm" className="ml-auto" onClick={exportar} cargando={exportando}>
          {!exportando && <FileSpreadsheet />}
          Exportar a Excel
        </Boton>
      </div>
      <div className="h-[calc(100dvh-27rem)] min-h-[340px]">
        <Tabla
          filas={visibles}
          columnas={columnas}
          clave={(r) => r.p.id}
          alHacerClic={(r) => navigate(`/polizas/${r.p.id}`)}
          altoFila={40}
          claveAnchos="tablero-vencimientos"
          ordenInicial={{ columna: 'ffin', asc: true }}
          vacio="No hay pólizas por vencer en esta ventana."
        />
      </div>
    </div>
  )
}
