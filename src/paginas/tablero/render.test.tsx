// Prueba de humo: cada pestaña y cada filtro se dibujan sin errores con datos de ejemplo.
import { describe, expect, it, vi } from 'vitest'

// El cliente de Supabase exige claves en el entorno; aquí no se usa.
vi.mock('@/lib/supabase', () => ({ ES_PRUEBAS: true, db: {}, APP_ENV: 'dev' }))
// Pagos de ejemplo para la pestaña de cartera.
vi.mock('@/datos/dashboard', () => ({
  useAbonosDashboard: () => ({
    isPending: false,
    isError: false,
    data: [{ idPoliza: 1, fecha: new Date(2026, 9, 5), prima: 1000, comision: 100 }],
  }),
}))

import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import type { PolizaLista } from '@/lib/tipos'
import { prepararFilas } from '@/paginas/reportes/calculos'
import { FiltroAnioMes } from './FiltroAnioMes'
import { FiltroFechas } from './FiltroFechas'
import { FiltroMulti } from './FiltroMulti'
import TabPolizas from './TabPolizas'
import TabProduccion from './TabProduccion'
import TabCartera from './TabCartera'
import TabResumen from './TabResumen'
import TabVencimientos from './TabVencimientos'
import { FILTROS_TABLERO_VACIOS, arbolAnioMes, filtrarTablero, opcionesTablero } from './logica'
import type { PropsTab } from './comun'

const HOY = new Date(2026, 10, 19)
const pol = (id: number, d: Partial<PolizaLista>) => ({ id, estado_poliza_id: 'I', valor_poliza: 1000 * id, prima_poliza: 800 * id, ...d }) as PolizaLista
const todas = prepararFilas([
  pol(1, { nombre_ramo: 'SOAT', nombre_aseg: 'ESTADO', nombre_cliente: 'ANA', bien_asegurado: 'ABC123', fini_poliza: '2026-03-10', ffin_poliza: '2026-12-10' }),
  pol(2, { nombre_ramo: 'HOGAR', nombre_aseg: 'SURA', nombre_cliente: 'LUIS', fini_poliza: '2025-06-15', ffin_poliza: '2026-11-25' }),
  pol(3, { nombre_ramo: 'LIVIANOS', nombre_aseg: 'SURA', nombre_cliente: 'ZOE', bien_asegurado: 'MAZDA KTL356', fini_poliza: '2024-01-01', ffin_poliza: '2026-09-01' }),
])
const props = (): PropsTab => ({ filas: filtrarTablero(todas, FILTROS_TABLERO_VACIOS, HOY), todas, filtros: FILTROS_TABLERO_VACIOS, cambiar: () => {}, hoy: HOY })
const dibujar = (el: React.ReactElement) => renderToString(<MemoryRouter>{el}</MemoryRouter>)

describe('pestañas del tablero', () => {
  it('Resumen', () => {
    const h = dibujar(<TabResumen {...props()} />)
    expect(h).toContain('Valor póliza')
    expect(h).toContain('Evolución por año de inicio')
  })
  it('Producción', () => {
    const h = dibujar(<TabProduccion {...props()} />)
    expect(h).toContain('Aseguradora')
    expect(h).toContain('Valor póliza por ramo')
  })
  it('Pólizas', () => {
    expect(dibujar(<TabPolizas {...props()} />)).toContain('Exportar a Excel')
  })
  it('Cartera y comisiones', () => {
    const h = dibujar(<TabCartera {...props()} />)
    expect(h).toContain('Por recaudar')
    expect(h).toContain('Rentabilidad por aseguradora')
    expect(h).toContain('Antigüedad de la cartera')
  })
  it('Vencimientos', () => {
    const h = dibujar(<TabVencimientos {...props()} />)
    expect(h).toContain('siguientes 12 meses')
  })
})

describe('filtros', () => {
  it('se dibujan cerrados', () => {
    const o = opcionesTablero(todas, FILTROS_TABLERO_VACIOS, HOY, 'ramo')
    expect(dibujar(<FiltroMulti etiqueta="Ramo" opciones={o} seleccion={['SOAT']} onCambio={() => {}} />)).toContain('>SOAT<')
    expect(dibujar(<FiltroAnioMes etiqueta="Inicio" arbol={arbolAnioMes(todas)} anios={[2026]} meses={[]} onCambio={() => {}} />)).toContain('1 año')
    const f = dibujar(
      <FiltroFechas etiqueta="F. vencimiento" rango={{ desde: null, hasta: null }} onRango={() => {}} relativa={{ sentido: 'siguiente', n: 12, unidad: 'meses' }} onRelativa={() => {}} />,
    )
    expect(f).toContain('Siguientes 12 meses')
  })
})
