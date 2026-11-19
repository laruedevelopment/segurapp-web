import { lazy, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, FilterX, RefreshCw } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Aviso, Cargando, Chip, MensajeError } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { Input } from '@/components/ui/campos'
import { Diferida } from '@/components/layout/guardas'
import { usePolizasTodas, useProgresoPolizas } from '@/datos/usePolizas'
import { aFecha, aISO, fmtFechaHora, hoy as hoyLocal } from '@/lib/fechas'
import { causaAmigable } from '@/lib/errores'
import { fmtEntero } from '@/paginas/dashboard/formato'
import { prepararFilas, type EstadoVigencia } from '@/paginas/reportes/calculos'
import { cn } from '@/lib/utils'
import { FiltroAnioMes } from './FiltroAnioMes'
import { FiltroFechas } from './FiltroFechas'
import { FiltroMulti } from './FiltroMulti'
import type { PropsTab } from './comun'
import {
  DIMENSIONES,
  FILTROS_TABLERO_VACIOS,
  arbolAnioMes,
  contarActivos,
  filtrarTablero,
  opcionesTablero,
  totales,
  type FiltrosTablero,
} from './logica'

const TabResumen = lazy(() => import('./TabResumen'))
const TabProduccion = lazy(() => import('./TabProduccion'))
const TabPolizas = lazy(() => import('./TabPolizas'))
const TabVencimientos = lazy(() => import('./TabVencimientos'))

type Pestana = 'resumen' | 'produccion' | 'polizas' | 'vencimientos'
const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: 'resumen', texto: 'Resumen' },
  { id: 'produccion', texto: 'Producción' },
  { id: 'polizas', texto: 'Pólizas' },
  { id: 'vencimientos', texto: 'Vencimientos' },
]
const ESTADOS: { id: EstadoVigencia; texto: string }[] = [
  { id: 'todas', texto: 'Todas' },
  { id: 'vigentes', texto: 'Vigentes' },
  { id: 'vencidas', texto: 'Vencidas' },
  { id: 'sinFecha', texto: 'Sin fecha' },
]
const ATAJOS_VENC = [
  { texto: '30 días', relativa: { sentido: 'siguiente', n: 30, unidad: 'dias' } },
  { texto: '60 días', relativa: { sentido: 'siguiente', n: 60, unidad: 'dias' } },
  { texto: '3 meses', relativa: { sentido: 'siguiente', n: 3, unidad: 'meses' } },
  { texto: '12 meses', relativa: { sentido: 'siguiente', n: 12, unidad: 'meses' } },
  { texto: 'Ya vencidas (30 días)', relativa: { sentido: 'anterior', n: 30, unidad: 'dias' } },
] as const

/** Texto con espera: el valor "confirmado" llega 250 ms después de la última tecla. */
function useTextoConEspera(valor: string, onConfirmar: (v: string) => void) {
  const [texto, setTexto] = useState(valor)
  useEffect(() => setTexto(valor), [valor])
  useEffect(() => {
    if (texto.trim() === valor.trim()) return
    const t = setTimeout(() => onConfirmar(texto.trim()), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto])
  return [texto, setTexto] as const
}

/**
 * Tablero gerencial unificado: recrea el Power BI de la agencia (valor póliza por dimensión,
 * detalle por inicio, vencimientos con fecha relativa) y suma lo mejor de Reportes y del Dashboard.
 */
export default function Tablero() {
  const consulta = usePolizasTodas()
  const progreso = useProgresoPolizas()
  const [filtros, setFiltros] = useState<FiltrosTablero>(FILTROS_TABLERO_VACIOS)
  const cambiar = (p: Partial<FiltrosTablero>) => setFiltros((f) => ({ ...f, ...p }))
  const [pestana, setPestana] = useState<Pestana>('resumen')
  const [busqueda, setBusqueda] = useTextoConEspera(filtros.busqueda, (v) => cambiar({ busqueda: v }))
  const [bien, setBien] = useTextoConEspera(filtros.bien, (v) => cambiar({ bien: v }))

  const claveHoy = aISO(hoyLocal())!
  const hoy = useMemo(() => aFecha(claveHoy)!, [claveHoy])

  const todas = useMemo(() => prepararFilas(consulta.data?.polizas ?? []), [consulta.data])
  const filas = useMemo(() => filtrarTablero(todas, filtros, hoy), [todas, filtros, hoy])
  const t = useMemo(() => totales(filas), [filas])
  const opciones = useMemo(
    () => Object.fromEntries(DIMENSIONES.map((d) => [d.id, opcionesTablero(todas, filtros, hoy, d.id)])) as Record<(typeof DIMENSIONES)[number]['id'], { nombre: string; n: number }[]>,
    [todas, filtros, hoy],
  )
  const arbol = useMemo(() => arbolAnioMes(filtrarTablero(todas, { ...filtros, anios: [], meses: [] }, hoy)), [todas, filtros, hoy])
  const activos = contarActivos(filtros)
  const limpiar = () => setFiltros(FILTROS_TABLERO_VACIOS)
  const props: PropsTab = { filas, todas, filtros, cambiar, hoy }

  if (consulta.isError && !consulta.data) {
    return (
      <div className="flex h-full flex-col">
        <EncabezadoPagina titulo="Tablero gerencial" volver="/" />
        <Contenido>
          <MensajeError error={causaAmigable(consulta.error, 'No se pudieron cargar las pólizas')} />
          <Boton className="mt-3" onClick={() => void consulta.refetch()}>Reintentar</Boton>
        </Contenido>
      </div>
    )
  }
  if (!consulta.data) {
    return (
      <div className="flex h-full flex-col">
        <EncabezadoPagina titulo="Tablero gerencial" volver="/" />
        <Cargando texto={progreso > 0 ? `Cargando el historial de pólizas… ${fmtEntero(progreso)}` : 'Cargando el historial de pólizas…'} />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo="Tablero gerencial"
        subtitulo={
          <span>
            {consulta.data.cargadasEn && <>Datos cargados {fmtFechaHora(consulta.data.cargadasEn)} · </>}
            {fmtEntero(filas.length)} de {fmtEntero(todas.length)} pólizas
          </span>
        }
        volver="/"
        acciones={
          <Boton variante="fantasma" tamano="icono" title="Recargar los datos" onClick={() => void consulta.refetch()} disabled={consulta.isFetching}>
            <RefreshCw className={consulta.isFetching ? 'animate-spin' : ''} />
          </Boton>
        }
      />
      <Contenido className="flex max-w-[1500px] flex-col gap-3">
        {consulta.isFetching && <Aviso tono="navy">Recargando las pólizas… {fmtEntero(progreso)}</Aviso>}
        {consulta.isError && <Aviso icono={<AlertTriangle />}>No se pudieron recargar los datos. Se muestran los cargados antes.</Aviso>}

        {/* Filtros: los mismos para todas las pestañas */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3">
          <FiltroAnioMes etiqueta="Inicio (año/mes)" arbol={arbol} anios={filtros.anios} meses={filtros.meses} onCambio={(anios, meses) => cambiar({ anios, meses })} />
          <FiltroFechas etiqueta="F. inicio" rango={filtros.fini} onRango={(r) => cambiar({ fini: r })} />
          <FiltroFechas
            etiqueta="F. vencimiento"
            rango={filtros.ffinRango}
            onRango={(r) => cambiar({ ffinRango: r })}
            relativa={filtros.ffinRel}
            onRelativa={(r) => cambiar({ ffinRel: r })}
            atajos={[...ATAJOS_VENC].map((a) => ({ texto: a.texto, relativa: { ...a.relativa } }))}
          />
          {DIMENSIONES.map((d) => (
            <FiltroMulti key={d.id} etiqueta={d.texto} opciones={opciones[d.id]} seleccion={filtros[d.id]} onCambio={(v) => cambiar({ [d.id]: v } as Partial<FiltrosTablero>)} />
          ))}
          <Input className="h-9 w-48" placeholder="Bien asegurado (placa…)" value={bien} onChange={(e) => setBien(e.target.value)} aria-label="Buscar por bien asegurado" />
          <Input className="h-9 w-52" placeholder="Buscar en todo (póliza, doc…)" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Búsqueda general" />
          <div className="flex flex-wrap items-center gap-1.5">
            {ESTADOS.map((e) => (
              <Chip key={e.id} activo={filtros.estado === e.id} onClick={() => cambiar({ estado: e.id })}>{e.texto}</Chip>
            ))}
            <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] text-ink-soft">
              <input type="checkbox" className="size-4 accent-navy" checked={filtros.incluirAnuladas} onChange={(e) => cambiar({ incluirAnuladas: e.target.checked })} />
              Incluir anuladas
            </label>
          </div>
          {activos > 0 && (
            <Boton variante="fantasma" tamano="sm" className="ml-auto" onClick={limpiar}>
              <FilterX /> Limpiar ({activos})
            </Boton>
          )}
        </div>

        {/* Totales siempre visibles (como las dos tarjetas del Power BI) */}
        <div className="flex flex-wrap gap-3">
          <Total titulo="Valor póliza" valor={`$ ${fmtEntero(t.valor)}`} />
          <Total titulo="Prima" valor={`$ ${fmtEntero(t.prima)}`} />
          <Total titulo="Registros" valor={fmtEntero(t.registros)} />
        </div>

        <div role="tablist" aria-label="Secciones del tablero" className="flex gap-1 overflow-x-auto border-b border-line">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={pestana === p.id}
              onClick={() => setPestana(p.id)}
              className={cn(
                'shrink-0 border-b-2 px-4 py-2.5 text-[14px] font-semibold transition-colors',
                pestana === p.id ? 'border-navy text-navy' : 'border-transparent text-ink-soft hover:text-ink',
              )}
            >
              {p.texto}
            </button>
          ))}
        </div>

        <Diferida>
          {pestana === 'resumen' && <TabResumen {...props} />}
          {pestana === 'produccion' && <TabProduccion {...props} />}
          {pestana === 'polizas' && <TabPolizas {...props} />}
          {pestana === 'vencimientos' && <TabVencimientos {...props} />}
        </Diferida>
      </Contenido>
    </div>
  )
}

function Total({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="min-w-[10rem] flex-1 rounded-xl border border-line bg-surface px-4 py-3 text-center">
      <div className="num text-[22px] font-extrabold text-navy">{valor}</div>
      <div className="text-[13px] text-ink-soft">{titulo}</div>
    </div>
  )
}
