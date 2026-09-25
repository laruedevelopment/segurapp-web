import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import type { PolizaLista } from '@/lib/tipos'
import { construirLibro, serialExcel } from './excel'
import {
  FILTROS_VACIOS,
  agrupar,
  clasificar,
  contarFiltrosActivos,
  enRango,
  filtrar,
  opcionesDe,
  porVencer,
  prepararFilas,
  rangoDias,
  rangoMes,
} from './calculos'

let sig = 1
function pol(d: Partial<PolizaLista>): PolizaLista {
  return {
    id: sig++, nro_poliza: null, cliente_id: null, asesor_id: null, ramo_id: null, producto_id: null, aseg_id: null,
    fexp_poliza: null, fini_poliza: null, ffin_poliza: null, prima_poliza: null, valor_poliza: null,
    vlraseg_poliza: null, porccom_poliza: null, bien_asegurado: null, fcreado: null, fultmod: null,
    estado_poliza_id: null, vlrprimapagada_poliza: null, usuario_id: null,
    nombre_cliente: null, doc_cliente: null, tipodoc_cliente: null, tel_cliente: null,
    nombre_asesor: null, nombre_ramo: null, nombre_prod: null, nombre_aseg: null,
    nombre_usuario: null, apodo_usuario: null,
    ...d,
  }
}

const HOY = new Date(2026, 8, 25)

describe('enRango', () => {
  const r = { desde: new Date(2026, 8, 1), hasta: new Date(2026, 8, 30) }
  it('incluye el día "hasta" completo y nada del siguiente', () => {
    expect(enRango(new Date(2026, 8, 30), r)).toBe(true)
    expect(enRango(new Date(2026, 8, 30, 23, 59), r)).toBe(true)
    expect(enRango(new Date(2026, 9, 1), r)).toBe(false)
    expect(enRango(new Date(2026, 8, 1), r)).toBe(true)
    expect(enRango(new Date(2026, 7, 31, 23, 59), r)).toBe(false)
  })
  it('sin fecha no entra si hay rango; sin rango entra todo', () => {
    expect(enRango(null, r)).toBe(false)
    expect(enRango(null, { desde: null, hasta: null })).toBe(true)
  })
  it('próximos 30 días no incluye el día 31', () => {
    const r30 = rangoDias(HOY, 0, 30)
    expect(enRango(new Date(2026, 9, 25), r30)).toBe(true)
    expect(enRango(new Date(2026, 9, 26), r30)).toBe(false)
  })
  it('este mes', () => {
    expect(rangoMes(HOY).hasta).toEqual(new Date(2026, 8, 30))
  })
})

describe('filtrar y clasificar', () => {
  const filas = prepararFilas([
    pol({ nombre_aseg: 'SURA', ffin_poliza: '2026-09-25T00:00:00+00:00', prima_poliza: 0.1 }),
    pol({ nombre_aseg: 'SURA', ffin_poliza: '2026-09-24T00:00:00+00:00', prima_poliza: 0.2 }),
    pol({ nombre_aseg: null, ffin_poliza: '2026-12-31T00:00:00+00:00', prima_poliza: 0.2 }),
    pol({ nombre_aseg: 'BOLÍVAR', ffin_poliza: '2027-01-01T00:00:00+00:00', prima_poliza: 1000, estado_poliza_id: 'A' }),
    pol({ nombre_aseg: 'ALLIANZ', ffin_poliza: null, prima_poliza: 5, nombre_cliente: 'Pérez Juan', doc_cliente: '9001234567' }),
  ])

  it('excluye anuladas salvo que se pidan', () => {
    expect(filtrar(filas, FILTROS_VACIOS, HOY)).toHaveLength(4)
    expect(filtrar(filas, { ...FILTROS_VACIOS, incluirAnuladas: true }, HOY)).toHaveLength(5)
  })

  it('suma exacta de primas y vigentes/vencidas', () => {
    const c = clasificar(filtrar(filas, FILTROS_VACIOS, HOY), HOY)
    expect(c.primaTotal).toBe(5.5)
    expect(c.vigentes).toBe(2) // la que vence hoy sigue vigente
    expect(c.vencidas).toHaveLength(1)
    expect(c.sinFfin).toHaveLength(1)
  })

  it('el grupo "Sin aseguradora" se puede filtrar', () => {
    const r = filtrar(filas, { ...FILTROS_VACIOS, aseg: 'Sin aseguradora' }, HOY)
    expect(r).toHaveLength(1)
    expect(opcionesDe(filas, FILTROS_VACIOS, 'aseg')).toEqual(['ALLIANZ', 'BOLÍVAR', 'SURA', 'Sin aseguradora'])
  })

  it('cliente por documento con puntos', () => {
    expect(filtrar(filas, { ...FILTROS_VACIOS, cliente: '900.123' }, HOY)).toHaveLength(1)
  })

  it('estados', () => {
    expect(filtrar(filas, { ...FILTROS_VACIOS, estado: 'vencidas' }, HOY)).toHaveLength(1)
    expect(filtrar(filas, { ...FILTROS_VACIOS, estado: 'sinFecha' }, HOY)).toHaveLength(1)
    expect(filtrar(filas, { ...FILTROS_VACIOS, estado: 'vigentes' }, HOY)).toHaveLength(2)
  })

  it('por vencer en días, ambos extremos incluidos', () => {
    expect(porVencer(filas, HOY, 0, 30).map((r) => r.p.ffin_poliza?.slice(0, 10))).toEqual(['2026-09-25'])
    expect(porVencer(filas, HOY, 97, 97)).toHaveLength(1)
  })

  it('agrupar por cantidad y por prima', () => {
    const f = filtrar(filas, FILTROS_VACIOS, HOY)
    expect(agrupar(f, 'aseg', false)[0]).toEqual({ nombre: 'SURA', cantidad: 2, prima: 0.3 })
    expect(agrupar(f, 'aseg', true)[0].nombre).toBe('ALLIANZ')
  })

  it('cuenta filtros activos', () => {
    expect(contarFiltrosActivos(FILTROS_VACIOS)).toBe(0)
    expect(contarFiltrosActivos({ ...FILTROS_VACIOS, aseg: 'X', incluirAnuladas: true, ffin: rangoDias(HOY, 0, 30) })).toBe(3)
  })
})

describe('excel', () => {
  it('fechas como número de serie con formato y montos como número', () => {
    expect(serialExcel(new Date(2026, 8, 25))).toBe(46290)
    const filas = prepararFilas([
      pol({ id: 7, nro_poliza: '123', ffin_poliza: '2026-10-05T00:00:00+00:00', prima_poliza: 1500.5, fcreado: '2026-09-01T15:30:00Z' }),
    ])
    const wb = construirLibro(filas, filas, HOY)
    expect(wb.SheetNames).toEqual(['Pólizas', 'Por Aseguradora', 'Por Ramo', 'Por Asesor', 'Vencimientos 90 días'])
    const ws = wb.Sheets['Pólizas']
    expect(ws['J2']).toMatchObject({ t: 'n', v: serialExcel(new Date(2026, 9, 5)), z: 'dd/mm/yyyy' })
    expect(ws['K2']).toMatchObject({ t: 'n', v: 1500.5 })
    expect(ws['I2']).toBeUndefined()
    const v = wb.Sheets['Vencimientos 90 días']
    expect(v['H2']).toMatchObject({ t: 'n', v: 10 })
    // Se puede escribir sin errores.
    expect(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }).byteLength).toBeGreaterThan(0)
  })
})
