// Port de test/ui/dashboard_motor_bordes_test.dart (Flutter): fronteras,
// datos vacíos, rangos raros, cartera, renovaciones, metas y recaudo.
import { describe, expect, it } from 'vitest'
import { MotorDash, fechaProduccion, nuevosFiltros, sumarDias, type AbonoLite, type Comparar, type PolizaMotor } from './motor'

const D = (y: number, m: number, d: number) => new Date(y, m - 1, d)

interface OpcionesPol {
  prima?: number
  exp?: Date | null
  ini?: Date | null
  fin?: Date | null
  cliente?: number | null
  ramo?: number | null
  estado?: string
  pagada?: number | null
  asesor?: number | null
  creado?: Date | null
}

function pol(id: number, o: OpcionesPol = {}): PolizaMotor {
  const cliente = o.cliente === undefined ? 1 : o.cliente
  const ramo = o.ramo === undefined ? 1 : o.ramo
  const asesor = o.asesor === undefined ? 1 : o.asesor
  return {
    id,
    nroPoliza: null,
    primaPoliza: o.prima ?? 1000,
    fexpPoliza: o.exp ?? null,
    finiPoliza: o.ini ?? null,
    ffinPoliza: o.fin ?? null,
    clienteId: cliente,
    nombreCliente: cliente == null ? null : `Cliente ${cliente}`,
    ramoId: ramo,
    nombreRamo: ramo == null ? null : `Ramo ${ramo}`,
    nombreProd: null,
    nombreAseg: 'Sura',
    asesorId: asesor,
    nombreAsesor: asesor == null ? null : `Asesor ${asesor}`,
    fcreado: o.creado ?? null,
    estadoPolizaId: o.estado ?? 'I',
    vlrprimapagadaPoliza: o.pagada ?? null,
  }
}

const hoy = D(2026, 10, 14)
const filtro = (desde: Date, hasta: Date, comparar: Comparar = 'ninguno', resto: Parameters<typeof nuevosFiltros>[2] = {}) =>
  nuevosFiltros(desde, hasta, { comparar, ...resto })

describe('rangoComparacion', () => {
  it('un solo día compara contra el día anterior', () => {
    const r = MotorDash.rangoComparacion(D(2026, 10, 14), D(2026, 10, 14), 'periodoAnterior')!
    expect(r[0]).toEqual(D(2026, 10, 13))
    expect(r[1]).toEqual(D(2026, 10, 13))
  })

  it('un solo día 1 de mes no se confunde con mes completo', () => {
    const r = MotorDash.rangoComparacion(D(2026, 3, 1), D(2026, 3, 1), 'periodoAnterior')!
    expect(r[0]).toEqual(D(2026, 2, 28))
    expect(r[1]).toEqual(D(2026, 2, 28))
  })

  it('trimestre que cruza el año (nov-ene) -> 3 meses previos', () => {
    const r = MotorDash.rangoComparacion(D(2025, 11, 1), D(2026, 1, 31), 'periodoAnterior')!
    expect(r[0]).toEqual(D(2025, 8, 1))
    expect(r[1]).toEqual(D(2025, 10, 31))
  })

  it('enero completo -> diciembre del año anterior', () => {
    const r = MotorDash.rangoComparacion(D(2026, 1, 1), D(2026, 1, 31), 'periodoAnterior')!
    expect(r[0]).toEqual(D(2025, 12, 1))
    expect(r[1]).toEqual(D(2025, 12, 31))
  })

  it('marzo completo -> febrero (28 o 29 días)', () => {
    const r = MotorDash.rangoComparacion(D(2024, 3, 1), D(2024, 3, 31), 'periodoAnterior')!
    expect(r[0]).toEqual(D(2024, 2, 1))
    expect(r[1]).toEqual(D(2024, 2, 29))
  })

  it('rango arbitrario de 30 días cruzando fin de año', () => {
    const r = MotorDash.rangoComparacion(D(2026, 1, 10), D(2026, 2, 8), 'periodoAnterior')!
    expect(r[1]).toEqual(D(2026, 1, 9))
    expect(r[0]).toEqual(D(2025, 12, 11))
  })

  it('ninguno -> null', () => {
    expect(MotorDash.rangoComparacion(D(2026, 1, 1), D(2026, 1, 2), 'ninguno')).toBeNull()
  })

  it('año anterior de un rango normal', () => {
    const r = MotorDash.rangoComparacion(D(2026, 9, 1), D(2026, 9, 30), 'anioAnterior')!
    expect(r[0]).toEqual(D(2025, 9, 1))
    expect(r[1]).toEqual(D(2025, 9, 30))
  })

  // Un 29 de febrero se desbordaría a 1-mar del año anterior (no bisiesto).
  it('año anterior de febrero bisiesto completo no desborda a marzo', () => {
    const r = MotorDash.rangoComparacion(D(2024, 2, 1), D(2024, 2, 29), 'anioAnterior')!
    expect(r[0]).toEqual(D(2023, 2, 1))
    expect(r[1]).toEqual(D(2023, 2, 28))
  })
})

describe('calcular con datos vacíos / bordes', () => {
  it('sin pólizas ni abonos: todo en cero y sin división por cero', () => {
    const m = new MotorDash([], null, hoy)
    const r = m.calcular(nuevosFiltros(D(2026, 9, 1), D(2026, 9, 30)))
    expect(r.actual.n).toBe(0)
    expect(r.actual.ticket).toBe(0)
    expect(r.actual.prima).toBe(0)
    expect(r.pareto).toEqual([])
    expect(r.concentracionTop10).toBe(0)
    expect(r.tasaRenovacion).toBeNull()
    expect(r.matriz).toEqual({})
    expect(r.comp).not.toBeNull()
    expect(r.comp!.n).toBe(0)
    expect(r.venceN.length).toBe(12)
    expect(m.rangoTotal()).toBeNull()
    expect(m.calidad().total).toBe(0)
  })

  it('abonos null: recaudo y comisión en 0', () => {
    const m = new MotorDash([pol(1, { exp: D(2026, 9, 5) })], null, hoy)
    const r = m.calcular(nuevosFiltros(D(2026, 9, 1), D(2026, 9, 30)))
    expect(r.actual.recaudo).toBe(0)
    expect(r.actual.comision).toBe(0)
  })

  it('período de un solo día incluye pólizas de ese día y nada más', () => {
    const m = new MotorDash(
      [pol(1, { exp: D(2026, 9, 14) }), pol(2, { exp: D(2026, 9, 15) }), pol(3, { exp: D(2026, 9, 13) })],
      null,
      hoy,
    )
    const r = m.calcular(nuevosFiltros(D(2026, 9, 14), D(2026, 9, 14)))
    expect(r.actual.n).toBe(1)
    expect(r.actual.primaMes.length).toBe(1)
    expect(r.comp!.n).toBe(1) // 13-sep
    expect(r.meses).toEqual([D(2026, 9, 1)])
  })

  it('rango que cruza el año: un bucket por mes y meses con año correcto', () => {
    const m = new MotorDash(
      [
        pol(1, { prima: 100, exp: D(2025, 12, 31) }),
        pol(2, { prima: 200, exp: D(2026, 1, 1) }),
        pol(3, { prima: 400, exp: D(2026, 2, 28) }),
      ],
      null,
      hoy,
    )
    const r = m.calcular(filtro(D(2025, 12, 1), D(2026, 2, 28)))
    expect(r.actual.primaMes).toEqual([100, 200, 400])
    expect(r.actual.nMes).toEqual([1, 1, 1])
    expect(r.meses).toEqual([D(2025, 12, 1), D(2026, 1, 1), D(2026, 2, 1)])
    expect(r.comp).toBeNull()
  })

  it('mismo mes de distinto año no se mezcla en los buckets', () => {
    const m = new MotorDash(
      [pol(1, { prima: 100, exp: D(2025, 9, 10) }), pol(2, { prima: 300, exp: D(2026, 9, 10) })],
      null,
      hoy,
    )
    const r = m.calcular(filtro(D(2026, 9, 1), D(2026, 9, 30), 'anioAnterior'))
    expect(r.actual.prima).toBe(300)
    expect(r.comp!.prima).toBe(100)
  })

  it('fecha de producción cae a inicio de vigencia y luego a fcreado', () => {
    const conIni = pol(1, { ini: D(2026, 9, 3) })
    // 4-sep-2026 12:00 UTC: en cualquier zona horaria sigue siendo el 4 (o el 3 tarde) local; se usa mediodía local
    const conCreado = pol(2, { creado: new Date(2026, 8, 4, 7, 0) })
    const sinNada = pol(3)
    expect(fechaProduccion(conIni)).toEqual(D(2026, 9, 3))
    expect(fechaProduccion(conCreado)).not.toBeNull()
    expect(fechaProduccion(sinNada)).toBeNull()
    const m = new MotorDash([conIni, conCreado, sinNada], null, hoy)
    const r = m.calcular(filtro(D(2026, 9, 1), D(2026, 9, 30)))
    expect(r.actual.n).toBe(2) // la que no tiene ninguna fecha queda fuera
    expect(m.calidad().total).toBe(3)
  })

  it('póliza en el último y primer día del rango (límites inclusivos)', () => {
    const m = new MotorDash(
      [
        pol(1, { exp: D(2026, 9, 1) }),
        pol(2, { exp: D(2026, 9, 30) }),
        pol(3, { exp: D(2026, 8, 31) }),
        pol(4, { exp: D(2026, 10, 1) }),
      ],
      null,
      hoy,
    )
    const r = m.calcular(filtro(D(2026, 9, 1), D(2026, 9, 30)))
    expect(new Set(r.actual.polizas.map((p) => p.id))).toEqual(new Set([1, 2]))
  })

  // Rango invertido (desde > hasta en meses distintos): no debe lanzar.
  it('rango invertido no lanza excepción', () => {
    const m = new MotorDash([pol(1, { exp: D(2026, 9, 5) })], null, hoy)
    expect(() => m.calcular(filtro(D(2026, 11, 1), D(2026, 8, 1)))).not.toThrow()
  })

  it('rango invertido se interpreta al revés (septiembre–octubre)', () => {
    const m = new MotorDash([pol(1, { exp: D(2026, 9, 5) })], null, hoy)
    const r = m.calcular(filtro(D(2026, 10, 1), D(2026, 9, 1)))
    expect(r.actual.n).toBe(1)
  })
})

describe('clientes y filtros', () => {
  it('clientes sin clienteId con mismo nombre se agrupan; sin nombre no', () => {
    const a = pol(1, { cliente: null, exp: D(2026, 9, 5) })
    const b = pol(2, { cliente: null, exp: D(2026, 9, 6) })
    // sin nombre -> clave por id de póliza: dos distintos
    expect(MotorDash.claveCliente(a)).not.toBe(MotorDash.claveCliente(b))
    const r = new MotorDash([a, b], null, hoy).calcular(filtro(D(2026, 9, 1), D(2026, 9, 30)))
    expect(r.actual.clientes).toBe(2)
    expect(r.clientesTop[0].nombre).toBe('Sin cliente')
  })

  it('filtro por dimensión "Sin asesor" encuentra pólizas sin asesor', () => {
    const m = new MotorDash([pol(1, { exp: D(2026, 9, 5), asesor: null }), pol(2, { exp: D(2026, 9, 5) })], null, hoy)
    const r = m.calcular(filtro(D(2026, 9, 1), D(2026, 9, 30), 'ninguno', { asesor: 'Sin asesor' }))
    expect(r.actual.n).toBe(1)
  })

  it('concentración top10 = 100% con menos de 10 clientes', () => {
    const m = new MotorDash(
      [pol(1, { prima: 100, exp: D(2026, 9, 5), cliente: 1 }), pol(2, { prima: 300, exp: D(2026, 9, 5), cliente: 2 })],
      null,
      hoy,
    )
    const r = m.calcular(filtro(D(2026, 9, 1), D(2026, 9, 30)))
    expect(r.concentracionTop10).toBeCloseTo(100, 9)
    expect(r.pareto[r.pareto.length - 1]).toBeCloseTo(100, 9)
    expect(r.pareto[0]).toBeCloseTo(75, 9)
  })

  it('cliente nuevo: su primera póliza el primer día del período cuenta nuevo', () => {
    const m = new MotorDash(
      [
        pol(1, { exp: D(2026, 9, 1), cliente: 1 }),
        pol(2, { exp: D(2026, 8, 31), cliente: 2 }),
        pol(3, { exp: D(2026, 9, 10), cliente: 2 }),
      ],
      null,
      hoy,
    )
    const r = m.calcular(filtro(D(2026, 9, 1), D(2026, 9, 30)))
    expect(r.clientesNuevos).toBe(1)
    expect(r.clientesRecurrentes).toBe(1)
  })
})

describe('cartera', () => {
  it('pagado mayor que la prima se recorta; sin pagado = todo saldo', () => {
    const m = new MotorDash(
      [
        pol(1, { prima: 1000, exp: D(2026, 9, 5), pagada: 5000 }),
        pol(2, { prima: 500, exp: D(2026, 9, 5), pagada: null }),
        pol(3, { prima: 0, exp: D(2026, 9, 5) }),
        pol(4, { prima: -200, exp: D(2026, 9, 5) }),
      ],
      null,
      hoy,
    )
    const r = m.calcular(filtro(D(2026, 9, 1), D(2026, 9, 30)))
    expect(r.carteraPrima).toBe(1500)
    expect(r.carteraPagada).toBe(1000)
    expect(r.carteraSaldo).toBe(500)
  })

  it('aging: frontera de 30/60/90/180 días y vigencia futura', () => {
    const base = D(2026, 10, 14)
    const atras = (d: number) => sumarDias(base, -d)
    const m = new MotorDash(
      [
        pol(1, { prima: 1, exp: atras(30), ini: atras(30) }),
        pol(2, { prima: 10, exp: atras(31), ini: atras(31) }),
        pol(3, { prima: 100, exp: atras(60), ini: atras(60) }),
        pol(4, { prima: 1000, exp: atras(90), ini: atras(90) }),
        pol(5, { prima: 10000, exp: atras(180), ini: atras(180) }),
        pol(6, { prima: 100000, exp: atras(181), ini: atras(181) }),
        pol(7, { prima: 1000000, exp: atras(1), ini: sumarDias(base, 5) }),
      ],
      null,
      hoy,
    )
    const r = m.calcular(filtro(atras(200), base))
    const a = Object.fromEntries(r.aging)
    expect(a['0–30 días']).toBe(1)
    expect(a['31–60 días']).toBe(110)
    expect(a['61–90 días']).toBe(1000)
    expect(a['91–180 días']).toBe(10000)
    expect(a['Más de 180']).toBe(100000)
    expect(a['Sin iniciar']).toBe(1000000)
  })
})

describe('renovaciones', () => {
  it('póliza que vence hoy NO es base de renovación (aún vigente)', () => {
    const m = new MotorDash([pol(1, { exp: D(2025, 10, 14), fin: D(2026, 10, 14) })], null, hoy)
    const r = m.calcular(filtro(D(2026, 10, 1), D(2026, 10, 31)))
    expect(r.renBase).toBe(0)
    expect(r.vence30[0]).toBe(1)
  })

  it('vence ayer sí es base y queda sin renovar (últimos 90 días)', () => {
    const m = new MotorDash([pol(1, { exp: D(2025, 10, 13), fin: D(2026, 10, 13) })], null, hoy)
    const r = m.calcular(filtro(D(2026, 10, 1), D(2026, 10, 31)))
    expect(r.renBase).toBe(1)
    expect(r.renRenovadas).toBe(0)
    expect(r.tasaRenovacion).toBe(0)
    expect(r.sinRenovar90Tot[0]).toBe(1)
    expect(r.sinRenovar90[0].dias).toBe(1)
  })

  it('ventanas de vencimiento 30/60/90: fronteras inclusivas', () => {
    const d = (n: number) => sumarDias(hoy, n)
    const m = new MotorDash(
      [
        pol(1, { fin: d(30), exp: d(-335) }),
        pol(2, { fin: d(31), exp: d(-334) }),
        pol(3, { fin: d(60), exp: d(-305) }),
        pol(4, { fin: d(61), exp: d(-304) }),
        pol(5, { fin: d(90), exp: d(-275) }),
        pol(6, { fin: d(91), exp: d(-274) }),
      ],
      null,
      hoy,
    )
    const r = m.calcular(filtro(D(2026, 10, 1), D(2026, 10, 31)))
    expect(r.vence30[0]).toBe(1)
    expect(r.vence60[0]).toBe(2)
    expect(r.vence90[0]).toBe(2)
  })

  it('renovada: ventana -45/+180 días, inclusive, y no cuenta anuladas', () => {
    const fin = D(2026, 6, 30)
    const base = pol(1, { exp: D(2025, 6, 30), ini: D(2025, 6, 30), fin })
    const conSiguiente = (ini: Date, o: { estado?: string; ramo?: number; cliente?: number } = {}) => {
      const m = new MotorDash(
        [base, pol(2, { exp: ini, ini, fin: sumarDias(ini, 365), estado: o.estado ?? 'I', ramo: o.ramo ?? 1, cliente: o.cliente ?? 1 })],
        null,
        hoy,
      )
      return m.renovada(base)
    }
    expect(conSiguiente(sumarDias(fin, -45))).toBe(true)
    expect(conSiguiente(sumarDias(fin, -46))).toBe(false)
    expect(conSiguiente(sumarDias(fin, 180))).toBe(true)
    expect(conSiguiente(sumarDias(fin, 181))).toBe(false)
    expect(conSiguiente(fin, { estado: 'A' })).toBe(false)
    expect(conSiguiente(fin, { ramo: 2 })).toBe(false)
    expect(conSiguiente(fin, { cliente: 2 })).toBe(false)
  })

  it('sin clienteId o sin fecha fin nunca se considera renovada', () => {
    const sinCliente = pol(1, { cliente: null, exp: D(2025, 1, 1), fin: D(2026, 1, 1) })
    const sinFin = pol(2, { exp: D(2025, 1, 1) })
    const m = new MotorDash([sinCliente, sinFin], null, hoy)
    expect(m.renovada(sinCliente)).toBe(false)
    expect(m.renovada(sinFin)).toBe(false)
  })

  it('dos pólizas gemelas (mismo cliente, ramo y fechas) no se renuevan entre sí', () => {
    const a = pol(1, { exp: D(2025, 6, 1), ini: D(2025, 6, 1), fin: D(2026, 6, 1) })
    const b = pol(2, { exp: D(2025, 6, 1), ini: D(2025, 6, 1), fin: D(2026, 6, 1) })
    const m = new MotorDash([a, b], null, hoy)
    expect(m.renovada(a)).toBe(false)
    expect(m.renovada(b)).toBe(false)
  })

  it('el filtro de estado (vigentes) no afecta la base de renovaciones', () => {
    const m = new MotorDash([pol(1, { exp: D(2025, 9, 1), fin: D(2026, 9, 1) })], null, hoy)
    const r = m.calcular(filtro(D(2026, 9, 1), D(2026, 9, 30), 'ninguno', { estado: 1 }))
    expect(r.renBase).toBe(1)
  })

  it('vencimientos de los 12 meses futuros cruzan el año correctamente', () => {
    const m = new MotorDash(
      [pol(1, { exp: D(2026, 1, 1), fin: D(2027, 1, 20) }), pol(2, { exp: D(2026, 1, 1), fin: D(2027, 9, 20) })],
      null,
      hoy,
    )
    const r = m.calcular(filtro(D(2026, 10, 1), D(2026, 10, 31)))
    expect(r.mesesFuturos[0]).toEqual(D(2026, 10, 1))
    expect(r.mesesFuturos[3]).toEqual(D(2027, 1, 1))
    expect(r.venceN[3]).toBe(1)
    expect(r.venceN[11]).toBe(1) // sep-2027 es el último de los 12 meses
    expect(r.venceN.reduce((s, v) => s + v, 0)).toBe(2)
  })
})

describe('metas: realesAnio', () => {
  it('12 posiciones, excluye anuladas, filtra por asesor y por año', () => {
    const ab: AbonoLite[] = [
      { idPoliza: 1, fecha: D(2026, 1, 1), prima: 10, comision: 1 },
      { idPoliza: 5, fecha: D(2026, 12, 31), prima: 20, comision: 2 },
      { idPoliza: 1, fecha: D(2025, 12, 31), prima: 40, comision: 4 },
      { idPoliza: 99, fecha: D(2026, 5, 1), prima: 80, comision: 8 },
      { idPoliza: 1, fecha: null, prima: 160, comision: 16 },
    ]
    const m = new MotorDash(
      [
        pol(1, { prima: 100, exp: D(2026, 1, 31) }),
        pol(2, { prima: 200, exp: D(2026, 12, 31) }),
        pol(3, { prima: 400, exp: D(2025, 12, 31) }),
        pol(4, { prima: 800, exp: D(2026, 3, 1), estado: 'A' }),
        pol(5, { prima: 1600, exp: D(2026, 3, 1), asesor: 2 }),
      ],
      ab,
      hoy,
    )
    const todo = m.realesAnio(2026)
    expect(todo.prima.length).toBe(12)
    expect(todo.prima[0]).toBe(100)
    expect(todo.prima[11]).toBe(200)
    expect(todo.prima[2]).toBe(1600) // la anulada no cuenta
    expect(todo.polizas[2]).toBe(1)
    expect(todo.recaudo[0]).toBe(10)
    expect(todo.recaudo[11]).toBe(20)
    expect(todo.recaudo[4]).toBe(80) // abono de póliza desconocida cuenta en agencia

    const a2 = m.realesAnio(2026, 2)
    expect(a2.prima[2]).toBe(1600)
    expect(a2.prima[0]).toBe(0)
    expect(a2.recaudo[4]).toBe(0) // póliza desconocida no es de ningún asesor
    expect(a2.recaudo[11]).toBe(20)
  })

  it('año sin datos devuelve ceros', () => {
    const r = new MotorDash([], null, hoy).realesAnio(2030)
    for (const l of Object.values(r)) {
      expect(l.length).toBe(12)
      expect(l.every((v) => v === 0)).toBe(true)
    }
  })
})

describe('recaudo / abonos', () => {
  // INCONSISTENCIA conocida (igual que en Flutter, donde la prueba está omitida):
  // el recaudo no aplica el filtro de estado (vigentes/vencidas) a los abonos.
  it.skip('abono de póliza anulada o fuera del filtro de estado', () => {
    const m = new MotorDash(
      [
        pol(1, { exp: D(2026, 9, 5), fin: D(2027, 9, 5) }),
        pol(2, { exp: D(2025, 1, 5), fin: D(2026, 1, 5) }), // vencida
      ],
      [
        { idPoliza: 1, fecha: D(2026, 9, 6), prima: 100, comision: 10 },
        { idPoliza: 2, fecha: D(2026, 9, 6), prima: 200, comision: 20 },
      ],
      hoy,
    )
    const r = m.calcular(filtro(D(2026, 9, 1), D(2026, 9, 30), 'ninguno', { estado: 1 }))
    expect(r.actual.n).toBe(1)
    expect(r.actual.recaudo).toBe(100)
  })

  it('abono el último día del rango y el día siguiente', () => {
    const m = new MotorDash(
      [pol(1, { exp: D(2026, 9, 5) })],
      [
        { idPoliza: 1, fecha: D(2026, 9, 30), prima: 1, comision: 0 },
        { idPoliza: 1, fecha: D(2026, 10, 1), prima: 2, comision: 0 },
      ],
      hoy,
    )
    const r = m.calcular(filtro(D(2026, 9, 1), D(2026, 9, 30)))
    expect(r.actual.recaudo).toBe(1)
  })
})
