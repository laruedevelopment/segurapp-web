import { describe, expect, it } from 'vitest'
import type { PolizaLista } from '@/lib/tipos'
import { prepararFilas } from '@/paginas/reportes/calculos'
import {
  FILTROS_TABLERO_VACIOS as V,
  agruparTablero, arbolAnioMes, contarActivos, filtrarTablero, opcionesTablero, rangoRelativo, textoRelativa, totales,
} from './logica'

const HOY = new Date(2026, 10, 19)
let sig = 1
const pol = (d: Partial<PolizaLista>) => ({ id: sig++, estado_poliza_id: 'I', valor_poliza: 0, prima_poliza: 0, ...d }) as PolizaLista
const filas = prepararFilas([
  pol({ nombre_ramo: 'SOAT', nombre_aseg: 'ESTADO', nombre_cliente: 'ANA', fini_poliza: '2025-03-10', ffin_poliza: '2026-03-10', valor_poliza: 100, prima_poliza: 80 }),
  pol({ nombre_ramo: 'SOAT', nombre_aseg: 'SURA', nombre_cliente: 'LUIS', fini_poliza: '2026-12-01', ffin_poliza: '2027-12-01', valor_poliza: 300, prima_poliza: 250, bien_asegurado: 'ABC123' }),
  pol({ nombre_ramo: 'HOGAR', nombre_aseg: 'ESTADO', nombre_cliente: 'ANA', fini_poliza: '2026-06-15', ffin_poliza: '2026-12-10', valor_poliza: 600, prima_poliza: 500 }),
  pol({ nombre_ramo: null, nombre_aseg: 'ESTADO', nombre_cliente: 'ZOE', fini_poliza: '2026-06-20', ffin_poliza: '2026-11-25', valor_poliza: 50, prima_poliza: 40, estado_poliza_id: 'A' }),
])

describe('rangoRelativo', () => {
  it('siguiente 12 meses = igual que Power BI', () => {
    const r = rangoRelativo({ sentido: 'siguiente', n: 12, unidad: 'meses' }, HOY)
    expect([r.desde, r.hasta]).toEqual([new Date(2026, 10, 19), new Date(2027, 10, 18)])
  })
  it('siguiente 30 días, anterior 7 días', () => {
    expect(rangoRelativo({ sentido: 'siguiente', n: 30, unidad: 'dias' }, HOY).hasta).toEqual(new Date(2026, 11, 18))
    const a = rangoRelativo({ sentido: 'anterior', n: 7, unidad: 'dias' }, HOY)
    expect([a.desde, a.hasta]).toEqual([new Date(2026, 10, 12), new Date(2026, 10, 18)])
  })
  it('fin de mes no se desborda', () => {
    expect(rangoRelativo({ sentido: 'siguiente', n: 1, unidad: 'meses' }, new Date(2026, 0, 31)).hasta).toEqual(new Date(2026, 1, 27))
  })
  it('este mes / este año / esta semana', () => {
    const m = rangoRelativo({ sentido: 'este', n: 1, unidad: 'meses' }, HOY)
    expect([m.desde, m.hasta]).toEqual([new Date(2026, 10, 1), new Date(2026, 10, 30)])
    expect(rangoRelativo({ sentido: 'este', n: 1, unidad: 'anios' }, HOY).hasta).toEqual(new Date(2026, 11, 31))
    expect(rangoRelativo({ sentido: 'este', n: 1, unidad: 'semanas' }, HOY).desde).toEqual(new Date(2026, 10, 16))
  })
  it('texto', () => {
    expect(textoRelativa({ sentido: 'siguiente', n: 12, unidad: 'meses' })).toBe('Siguientes 12 meses')
    expect(textoRelativa({ sentido: 'este', n: 1, unidad: 'anios' })).toBe('Este año')
  })
})

describe('filtrarTablero', () => {
  it('sin filtros excluye anuladas', () => {
    expect(filtrarTablero(filas, V, HOY)).toHaveLength(3)
    expect(filtrarTablero(filas, { ...V, incluirAnuladas: true }, HOY)).toHaveLength(4)
  })
  it('selección múltiple por dimensión', () => {
    expect(filtrarTablero(filas, { ...V, aseg: ['SURA', 'ESTADO'] }, HOY)).toHaveLength(3)
    expect(filtrarTablero(filas, { ...V, ramo: ['SOAT'], aseg: ['ESTADO'] }, HOY)).toHaveLength(1)
    expect(filtrarTablero(filas, { ...V, cliente: ['ANA'] }, HOY)).toHaveLength(2)
  })
  it('año y mes de inicio', () => {
    expect(filtrarTablero(filas, { ...V, anios: [2026] }, HOY)).toHaveLength(2)
    expect(filtrarTablero(filas, { ...V, meses: ['2025-03'] }, HOY)).toHaveLength(1)
    expect(filtrarTablero(filas, { ...V, anios: [2025], meses: ['2026-12'] }, HOY)).toHaveLength(2)
  })
  it('vencimiento relativo y por rango', () => {
    const f = filtrarTablero(filas, { ...V, ffinRel: { sentido: 'siguiente', n: 1, unidad: 'meses' } }, HOY)
    expect(f.map((r) => r.p.nombre_ramo)).toEqual(['HOGAR'])
    expect(filtrarTablero(filas, { ...V, ffinRango: { desde: new Date(2027, 0, 1), hasta: null } }, HOY)).toHaveLength(1)
  })
  it('bien asegurado y búsqueda, sin tildes', () => {
    expect(filtrarTablero(filas, { ...V, bien: 'abc' }, HOY)).toHaveLength(1)
    expect(filtrarTablero(filas, { ...V, busqueda: 'luís' }, HOY)).toHaveLength(1)
  })
  it('estado vigentes / vencidas', () => {
    expect(filtrarTablero(filas, { ...V, estado: 'vigentes' }, HOY)).toHaveLength(2)
    expect(filtrarTablero(filas, { ...V, estado: 'vencidas' }, HOY)).toHaveLength(1)
  })
})

describe('opciones, árbol y agrupación', () => {
  it('opciones cruzadas: el filtro de la propia dimensión no se aplica', () => {
    const o = opcionesTablero(filas, { ...V, ramo: ['SOAT'], aseg: ['SURA'] }, HOY, 'aseg')
    expect(o.map((x) => x.nombre)).toEqual(['ESTADO', 'SURA'])
    expect(o.find((x) => x.nombre === 'ESTADO')?.n).toBe(1)
  })
  it('árbol año → mes, más reciente primero', () => {
    const a = arbolAnioMes(filas)
    expect(a.map((x) => x.anio)).toEqual([2026, 2025])
    expect(a[0].meses.map((m) => m.clave)).toEqual(['2026-06', '2026-12'])
  })
  it('agrupa con peso y ordena por la medida', () => {
    const f = filtrarTablero(filas, V, HOY)
    const g = agruparTablero(f, 'ramo')
    expect(g.map((x) => x.nombre)).toEqual(['HOGAR', 'SOAT'])
    expect(g[0]).toMatchObject({ valor: 600, registros: 1 })
    expect(g[0].pesoValor).toBeCloseTo(0.6)
    expect(agruparTablero(f, 'ramo', 'registros')[0].nombre).toBe('SOAT')
    expect(totales(f)).toEqual({ registros: 3, valor: 1000, prima: 830 })
  })
  it('cuenta filtros activos', () => {
    expect(contarActivos(V)).toBe(0)
    expect(contarActivos({ ...V, aseg: ['X'], ramo: ['Y'], anios: [2026], bien: 'a' })).toBe(4)
  })
})
