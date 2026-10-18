// Port de test/ui/dashboard_motor_test.dart (Flutter).
import { describe, expect, it } from 'vitest'
import { MotorDash, nuevosFiltros, type AbonoLite, type PolizaMotor } from './motor'

const D = (y: number, m: number, d: number) => new Date(y, m - 1, d)

function pol(
  id: number,
  o: {
    prima: number
    exp: Date
    fin?: Date
    ini?: Date
    cliente?: number
    ramo?: number
    aseg?: string
    asesorN?: string
    asesor?: number
    estado?: string
    pagada?: number
  },
): PolizaMotor {
  const cliente = o.cliente ?? 1
  const ramo = o.ramo ?? 1
  return {
    id,
    nroPoliza: null,
    primaPoliza: o.prima,
    fexpPoliza: o.exp,
    finiPoliza: o.ini ?? o.exp,
    ffinPoliza: o.fin ?? D(o.exp.getFullYear() + 1, o.exp.getMonth() + 1, o.exp.getDate()),
    clienteId: cliente,
    nombreCliente: `Cliente ${cliente}`,
    ramoId: ramo,
    nombreRamo: `Ramo ${ramo}`,
    nombreProd: null,
    nombreAseg: o.aseg ?? 'Sura',
    asesorId: o.asesor ?? 1,
    nombreAsesor: o.asesorN ?? 'Ana',
    fcreado: null,
    estadoPolizaId: o.estado ?? 'I',
    vlrprimapagadaPoliza: o.pagada ?? 0,
  }
}

const hoy = D(2026, 10, 5)
const polizas = [
  pol(1, { prima: 1000, exp: D(2026, 9, 10), pagada: 400 }),
  pol(2, { prima: 3000, exp: D(2026, 9, 20), cliente: 2, aseg: 'Axa' }),
  pol(3, { prima: 500, exp: D(2026, 8, 5), cliente: 3, asesorN: 'Beto', asesor: 2 }),
  pol(4, { prima: 9999, exp: D(2026, 9, 15), estado: 'A', cliente: 4 }),
  // Venció en agosto y la renovó una póliza que arranca en septiembre
  pol(5, { prima: 700, exp: D(2025, 8, 20), fin: D(2026, 8, 20), cliente: 5 }),
  pol(6, { prima: 800, exp: D(2026, 8, 25), ini: D(2026, 8, 25), cliente: 5 }),
  // Venció en agosto sin renovar
  pol(7, { prima: 600, exp: D(2025, 8, 10), fin: D(2026, 8, 10), cliente: 6 }),
]
const abonos: AbonoLite[] = [
  { idPoliza: 1, fecha: D(2026, 9, 12), prima: 400, comision: 40 },
  { idPoliza: 3, fecha: D(2026, 8, 6), prima: 500, comision: 50 },
]
const motor = new MotorDash(polizas, abonos, hoy)

describe('motor del dashboard', () => {
  it('totales del mes y exclusión de anuladas', () => {
    const r = motor.calcular(nuevosFiltros(D(2026, 9, 1), D(2026, 9, 30)))
    expect(r.actual.n).toBe(2)
    expect(r.actual.prima).toBe(4000)
    expect(r.actual.clientes).toBe(2)
    expect(r.actual.recaudo).toBe(400)
    expect(r.actual.comision).toBe(40)
    // Anterior = agosto completo
    expect(r.comp!.desde).toEqual(D(2026, 8, 1))
    expect(r.comp!.prima).toBe(500 + 800)
  })

  it('incluir anuladas y filtro por aseguradora', () => {
    let f = nuevosFiltros(D(2026, 9, 1), D(2026, 9, 30), { incluirAnuladas: true })
    expect(motor.calcular(f).actual.prima).toBe(4000 + 9999)
    f = { ...f, aseg: 'Axa', incluirAnuladas: false }
    const r = motor.calcular(f)
    expect(r.actual.prima).toBe(3000)
    expect(r.actual.recaudo).toBe(0)
  })

  it('cartera de lo emitido: saldo = prima - pagada', () => {
    const r = motor.calcular(nuevosFiltros(D(2026, 9, 1), D(2026, 9, 30)))
    expect(r.carteraPrima).toBe(4000)
    expect(r.carteraPagada).toBe(400)
    expect(r.carteraSaldo).toBe(3600)
  })

  it('renovación estimada por cliente y ramo', () => {
    const r = motor.calcular(nuevosFiltros(D(2026, 8, 1), D(2026, 8, 31)))
    expect(r.renBase).toBe(2) // pólizas 5 y 7 vencieron en agosto
    expect(r.renRenovadas).toBe(1)
    expect(r.tasaRenovacion).toBe(0.5)
    expect(r.sinRenovar90.map((e) => e.p.id)).toContain(7)
  })

  it('nuevos vs recurrentes', () => {
    const r = motor.calcular(nuevosFiltros(D(2026, 9, 1), D(2026, 9, 30)))
    expect(r.clientesNuevos).toBe(2)
    expect(r.clientesRecurrentes).toBe(0)
  })

  it('reales del año para metas', () => {
    const r = motor.realesAnio(2026)
    expect(r.prima[8]).toBe(4000) // septiembre
    expect(r.polizas[8]).toBe(2)
    expect(r.comision[7]).toBe(50)
    expect(motor.realesAnio(2026, 2).prima[7]).toBe(500)
  })

  it('rango de comparación del año anterior', () => {
    const rc = MotorDash.rangoComparacion(D(2026, 1, 1), D(2026, 3, 31), 'anioAnterior')!
    expect(rc[0]).toEqual(D(2025, 1, 1))
    expect(rc[1]).toEqual(D(2025, 3, 31))
  })
})
