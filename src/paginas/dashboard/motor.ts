// Cálculo puro (sin React ni red) del Dashboard gerencial: recibe las pólizas
// y los pagos en memoria y devuelve agregados listos para graficar. Es el
// mismo cálculo de lib/ui/dashboard/dashboard_motor.dart de la app Flutter
// (con sus pruebas portadas en motor.test.ts y motor.bordes.test.ts).

import { aFecha, aFechaHora, diasEntre } from '@/lib/fechas'
import type { PolizaLista } from '@/lib/tipos'

export type Comparar = 'periodoAnterior' | 'anioAnterior' | 'ninguno'

export type Dim = 'aseguradora' | 'ramo' | 'producto' | 'asesor' | 'cliente'
export const DIMS: Dim[] = ['aseguradora', 'ramo', 'producto', 'asesor', 'cliente']

export const etiquetaDim = (d: Dim): string =>
  ({ aseguradora: 'Aseguradora', ramo: 'Ramo', producto: 'Producto', asesor: 'Asesor', cliente: 'Cliente' })[d]

/** Pago mínimo que necesita el dashboard (se cruza en memoria con las pólizas). */
export interface AbonoLite {
  idPoliza: number
  fecha: Date | null
  prima: number
  comision: number
}

/** La póliza con solo lo que usa el dashboard y las fechas ya convertidas. */
export interface PolizaMotor {
  id: number
  nroPoliza: string | null
  clienteId: number | null
  nombreCliente: string | null
  ramoId: number | null
  nombreRamo: string | null
  nombreProd: string | null
  nombreAseg: string | null
  asesorId: number | null
  nombreAsesor: string | null
  primaPoliza: number
  fexpPoliza: Date | null
  finiPoliza: Date | null
  ffinPoliza: Date | null
  fcreado: Date | null
  estadoPolizaId: string | null
  vlrprimapagadaPoliza: number | null
}

const aNumero = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Fila de la lista de pólizas → la que usa el motor (se hace una sola vez). */
export function aPolizaMotor(p: PolizaLista): PolizaMotor {
  return {
    id: p.id,
    nroPoliza: p.nro_poliza,
    clienteId: p.cliente_id,
    nombreCliente: p.nombre_cliente,
    ramoId: p.ramo_id,
    nombreRamo: p.nombre_ramo,
    nombreProd: p.nombre_prod,
    nombreAseg: p.nombre_aseg,
    asesorId: p.asesor_id,
    nombreAsesor: p.nombre_asesor,
    primaPoliza: aNumero(p.prima_poliza),
    fexpPoliza: aFecha(p.fexp_poliza),
    finiPoliza: aFecha(p.fini_poliza),
    ffinPoliza: aFecha(p.ffin_poliza),
    fcreado: (() => {
      const d = aFechaHora(p.fcreado)
      return d ? soloDia(d) : null
    })(),
    estadoPolizaId: p.estado_poliza_id,
    vlrprimapagadaPoliza: p.vlrprimapagada_poliza == null ? null : aNumero(p.vlrprimapagada_poliza),
  }
}

export function claveDim(p: PolizaMotor, d: Dim): string {
  switch (d) {
    case 'aseguradora':
      return p.nombreAseg ?? 'Sin aseguradora'
    case 'ramo':
      return p.nombreRamo ?? 'Sin ramo'
    case 'producto':
      return p.nombreProd ?? 'Sin producto'
    case 'asesor':
      return p.nombreAsesor ?? 'Sin asesor'
    case 'cliente':
      return p.nombreCliente ?? 'Sin cliente'
  }
}

export const soloDia = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const sumarDias = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const antes = (a: Date, b: Date) => a.getTime() < b.getTime()
const despues = (a: Date, b: Date) => a.getTime() > b.getTime()

/**
 * Fecha con la que se cuenta la producción de una póliza: expedición; si no
 * hay, inicio de vigencia; si no, fecha de registro.
 */
export function fechaProduccion(p: PolizaMotor): Date | null {
  return p.fexpPoliza ?? p.finiPoliza ?? (p.fcreado ? soloDia(p.fcreado) : null)
}

export const mesIdx = (d: Date): number => d.getFullYear() * 12 + d.getMonth()

/** Filtros globales del dashboard (inmutables: la pantalla crea uno nuevo al cambiar). */
export interface FiltrosDash {
  desde: Date
  hasta: Date
  comparar: Comparar
  aseg: string | null
  ramo: string | null
  prod: string | null
  asesor: string | null
  cliente: string | null
  incluirAnuladas: boolean
  /** 0 = todas, 1 = vigentes, 2 = vencidas. */
  estado: 0 | 1 | 2
}

export function nuevosFiltros(desde: Date, hasta: Date, parcial: Partial<FiltrosDash> = {}): FiltrosDash {
  return {
    desde,
    hasta,
    comparar: 'periodoAnterior',
    aseg: null,
    ramo: null,
    prod: null,
    asesor: null,
    cliente: null,
    incluirAnuladas: false,
    estado: 0,
    ...parcial,
  }
}

export function valorDe(f: FiltrosDash, d: Dim): string | null {
  switch (d) {
    case 'aseguradora':
      return f.aseg
    case 'ramo':
      return f.ramo
    case 'producto':
      return f.prod
    case 'asesor':
      return f.asesor
    case 'cliente':
      return f.cliente
  }
}

export function poner(f: FiltrosDash, d: Dim, v: string | null): FiltrosDash {
  switch (d) {
    case 'aseguradora':
      return { ...f, aseg: v }
    case 'ramo':
      return { ...f, ramo: v }
    case 'producto':
      return { ...f, prod: v }
    case 'asesor':
      return { ...f, asesor: v }
    case 'cliente':
      return { ...f, cliente: v }
  }
}

export const nDimensiones = (f: FiltrosDash): number =>
  [f.aseg, f.ramo, f.prod, f.asesor, f.cliente].filter((e) => e != null).length

export interface Grupo {
  nombre: string
  n: number
  prima: number
  comision: number
  recaudo: number
}

export const ticketDe = (g: { n: number; prima: number }): number => (g.n === 0 ? 0 : g.prima / g.n)

/** Agregados de un período (el actual o el de comparación). */
export interface Agregado {
  desde: Date
  hasta: Date
  polizas: PolizaMotor[]
  n: number
  ticket: number
  clientes: number
  prima: number
  comision: number
  recaudo: number
  primaMes: number[]
  nMes: number[]
  comisionMes: number[]
  recaudoMes: number[]
}

export interface ClienteTop {
  nombre: string
  n: number
  prima: number
}

export interface FilaPoliza {
  p: PolizaMotor
  valor: number
  dias: number
}

/** (cantidad, prima). */
export type Cantidad = [number, number]

export interface Resultado {
  filtros: FiltrosDash
  actual: Agregado
  comp: Agregado | null
  meses: Date[]
  porDim: Record<Dim, Grupo[]>

  // Clientes
  clientesTop: ClienteTop[]
  pareto: number[] // % acumulado del top-N de clientes
  concentracionTop10: number
  clientesNuevos: number
  clientesRecurrentes: number
  primaNuevos: number
  primaRecurrentes: number

  // Cartera (de lo emitido en el período)
  carteraSaldo: number
  carteraPagada: number
  carteraPrima: number
  aging: Array<[string, number]>
  deudores: ClienteTop[]

  // Renovaciones
  renBase: number
  renRenovadas: number
  renPorAseg: Grupo[]
  renPorAsesor: Grupo[] // n = base, prima = renovadas
  mesesFuturos: Date[]
  venceN: number[]
  vencePrima: number[]
  porRenovar30: FilaPoliza[]
  sinRenovar90: FilaPoliza[]
  vence30: Cantidad
  vence60: Cantidad
  vence90: Cantidad
  sinRenovar90Tot: Cantidad

  // Matriz aseguradora × ramo
  matrizFilas: string[]
  matrizCols: string[]
  matriz: Record<string, number>

  /** Renovadas ÷ base; null si ninguna venció en el período. */
  tasaRenovacion: number | null
}

export interface CalidadDatos {
  total: number
  sinAsesor: number
  sinRamo: number
  sinVencimiento: number
  sinPrima: number
  sinCliente: number
  problemas: number
}

export type IndicadorClave = 'prima' | 'polizas' | 'comision' | 'recaudo'
export type RealesAnio = Record<IndicadorClave, number[]>

export const ETIQUETAS_AGING = ['Sin iniciar', '0–30 días', '31–60 días', '61–90 días', '91–180 días', 'Más de 180'] as const

interface Acum {
  nombre: string
  n: number
  prima: number
}

const ordenarPorPrima = <T extends { prima: number }>(l: T[]): T[] => l.sort((a, b) => b.prima - a.prima)

export class MotorDash {
  readonly polizas: PolizaMotor[]
  readonly abonos: AbonoLite[] | null
  readonly hoy: Date

  private _porId: Map<number, PolizaMotor> | null = null
  private _renIdx: Map<string, Array<[number, Date]>> | null = null
  private _primeraFecha: Map<string, Date> | null = null

  constructor(polizas: PolizaMotor[], abonos: AbonoLite[] | null, hoy?: Date) {
    this.polizas = polizas
    this.abonos = abonos
    this.hoy = soloDia(hoy ?? new Date())
  }

  // ── Índices ────────────────────────────────────────────────────────────

  static claveCliente(p: PolizaMotor): string {
    return p.clienteId != null ? `c${p.clienteId}` : `n${p.nombreCliente ?? p.id}`
  }

  private get porId(): Map<number, PolizaMotor> {
    if (!this._porId) this._porId = new Map(this.polizas.map((p) => [p.id, p]))
    return this._porId
  }

  private get renIdx(): Map<string, Array<[number, Date]>> {
    if (!this._renIdx) {
      const m = new Map<string, Array<[number, Date]>>()
      for (const p of this.polizas) {
        if (p.estadoPolizaId === 'A' || p.clienteId == null) continue
        const f = p.finiPoliza
        if (!f) continue
        const k = `${p.clienteId}|${p.ramoId ?? 0}`
        const l = m.get(k)
        if (l) l.push([p.id, f])
        else m.set(k, [[p.id, f]])
      }
      this._renIdx = m
    }
    return this._renIdx
  }

  private get primeraFecha(): Map<string, Date> {
    if (!this._primeraFecha) {
      const m = new Map<string, Date>()
      for (const p of this.polizas) {
        if (p.estadoPolizaId === 'A') continue
        const f = fechaProduccion(p)
        if (!f) continue
        const k = MotorDash.claveCliente(p)
        const a = m.get(k)
        if (!a || antes(f, a)) m.set(k, f)
      }
      this._primeraFecha = m
    }
    return this._primeraFecha
  }

  /**
   * ¿Existe otra póliza del mismo cliente y ramo que arranca cerca del fin de
   * esta? Es una estimación: el sistema no guarda "renueva a".
   */
  renovada(p: PolizaMotor): boolean {
    if (p.clienteId == null || !p.ffinPoliza) return false
    const lista = this.renIdx.get(`${p.clienteId}|${p.ramoId ?? 0}`)
    if (!lista) return false
    const fin = p.ffinPoliza
    const lo = sumarDias(fin, -45)
    const hi = sumarDias(fin, 180)
    const ini = p.finiPoliza
    for (const [id, f] of lista) {
      if (id === p.id) continue
      if (ini && !despues(f, ini)) continue
      if (!antes(f, lo) && !despues(f, hi)) return true
    }
    return false
  }

  // ── Filtros ────────────────────────────────────────────────────────────

  private pasaDims(p: PolizaMotor, f: FiltrosDash): boolean {
    if (f.aseg != null && claveDim(p, 'aseguradora') !== f.aseg) return false
    if (f.ramo != null && claveDim(p, 'ramo') !== f.ramo) return false
    if (f.prod != null && claveDim(p, 'producto') !== f.prod) return false
    if (f.asesor != null && claveDim(p, 'asesor') !== f.asesor) return false
    if (f.cliente != null && claveDim(p, 'cliente') !== f.cliente) return false
    return true
  }

  private pasaPoliza(p: PolizaMotor, f: FiltrosDash): boolean {
    if (!f.incluirAnuladas && p.estadoPolizaId === 'A') return false
    if (!this.pasaDims(p, f)) return false
    if (f.estado === 1 && (!p.ffinPoliza || antes(p.ffinPoliza, this.hoy))) return false
    if (f.estado === 2 && (!p.ffinPoliza || !antes(p.ffinPoliza, this.hoy))) return false
    return true
  }

  private static enRango(d: Date | null, desde: Date, hasta: Date): d is Date {
    return d != null && !antes(d, desde) && !despues(d, hasta)
  }

  /** Rango contra el que se compara [desde]–[hasta]. */
  static rangoComparacion(desde: Date, hasta: Date, c: Comparar): [Date, Date] | null {
    switch (c) {
      case 'ninguno':
        return null
      case 'anioAnterior': {
        // 29 de febrero → 28 en un año no bisiesto (no se desborda a marzo).
        const mismoDia = (d: Date) => {
          const ultimo = new Date(d.getFullYear() - 1, d.getMonth() + 1, 0).getDate()
          return new Date(d.getFullYear() - 1, d.getMonth(), Math.min(d.getDate(), ultimo))
        }
        return [mismoDia(desde), mismoDia(hasta)]
      }
      case 'periodoAnterior': {
        const mesesCompletos =
          desde.getDate() === 1 && hasta.getDate() === new Date(hasta.getFullYear(), hasta.getMonth() + 1, 0).getDate()
        if (mesesCompletos) {
          const n = mesIdx(hasta) - mesIdx(desde) + 1
          return [new Date(desde.getFullYear(), desde.getMonth() - n, 1), new Date(desde.getFullYear(), desde.getMonth(), 0)]
        }
        const dias = diasEntre(desde, hasta) + 1
        const h = sumarDias(desde, -1)
        return [sumarDias(h, -(dias - 1)), h]
      }
    }
  }

  // ── Cálculo principal ──────────────────────────────────────────────────

  private agregar(f: FiltrosDash, desde: Date, hasta: Date): Agregado {
    const nMeses = mesIdx(hasta) - mesIdx(desde) + 1
    const base = mesIdx(desde)
    const primaMes: number[] = new Array(nMeses).fill(0)
    const nMes: number[] = new Array(nMeses).fill(0)
    const comMes: number[] = new Array(nMeses).fill(0)
    const recMes: number[] = new Array(nMeses).fill(0)
    const lista: PolizaMotor[] = []
    const clientes = new Set<string>()
    let prima = 0
    let com = 0
    let rec = 0

    for (const p of this.polizas) {
      if (!this.pasaPoliza(p, f)) continue
      const d = fechaProduccion(p)
      if (!MotorDash.enRango(d, desde, hasta)) continue
      lista.push(p)
      clientes.add(MotorDash.claveCliente(p))
      prima += p.primaPoliza
      const i = mesIdx(d) - base
      primaMes[i] += p.primaPoliza
      nMes[i] += 1
    }
    const ab = this.abonos
    if (ab) {
      const sinDims = nDimensiones(f) === 0
      for (const a of ab) {
        if (!MotorDash.enRango(a.fecha, desde, hasta)) continue
        const p = this.porId.get(a.idPoliza)
        if (p == null ? !sinDims : !this.pasaDims(p, f)) continue
        const i = mesIdx(a.fecha) - base
        rec += a.prima
        com += a.comision
        recMes[i] += a.prima
        comMes[i] += a.comision
      }
    }
    const n = lista.length
    return {
      desde,
      hasta,
      polizas: lista,
      n,
      ticket: n === 0 ? 0 : prima / n,
      clientes: clientes.size,
      prima,
      comision: com,
      recaudo: rec,
      primaMes,
      nMes,
      comisionMes: comMes,
      recaudoMes: recMes,
    }
  }

  /**
   * Valores distintos de una dimensión entre las pólizas del período que
   * pasan los DEMÁS filtros (para poder cambiar de un valor a otro sin
   * quitar antes el filtro). Siempre incluye el valor elegido.
   */
  opciones(f: FiltrosDash, d: Dim): string[] {
    if (despues(f.desde, f.hasta)) f = { ...f, desde: f.hasta, hasta: f.desde }
    const sinEste = poner(f, d, null)
    const s = new Set<string>()
    for (const p of this.polizas) {
      if (!this.pasaPoliza(p, sinEste)) continue
      if (!MotorDash.enRango(fechaProduccion(p), f.desde, f.hasta)) continue
      s.add(claveDim(p, d))
    }
    const act = valorDe(f, d)
    if (act != null) s.add(act)
    return [...s].sort((a, b) => a.localeCompare(b, 'es'))
  }

  calcular(filtros: FiltrosDash): Resultado {
    let f = filtros
    // Un rango con "desde" después de "hasta" se interpreta al revés en vez
    // de romper el cálculo.
    if (despues(f.desde, f.hasta)) f = { ...f, desde: f.hasta, hasta: f.desde }
    const hoy = this.hoy
    const actual = this.agregar(f, f.desde, f.hasta)
    const rc = MotorDash.rangoComparacion(f.desde, f.hasta, f.comparar)
    const comp = rc == null ? null : this.agregar(f, rc[0], rc[1])
    const nMeses = actual.primaMes.length
    const meses: Date[] = []
    for (let i = 0; i < nMeses; i++) meses.push(new Date(f.desde.getFullYear(), f.desde.getMonth() + i, 1))

    // Grupos por dimensión (producción del período + comisión/recaudo).
    const porDim = {} as Record<Dim, Grupo[]>
    for (const d of DIMS) {
      const m = new Map<string, Grupo>()
      const grupo = (nombre: string) => {
        let g = m.get(nombre)
        if (!g) {
          g = { nombre, n: 0, prima: 0, comision: 0, recaudo: 0 }
          m.set(nombre, g)
        }
        return g
      }
      for (const p of actual.polizas) {
        const g = grupo(claveDim(p, d))
        g.n++
        g.prima += p.primaPoliza
      }
      if (this.abonos) {
        for (const a of this.abonos) {
          if (!MotorDash.enRango(a.fecha, f.desde, f.hasta)) continue
          const p = this.porId.get(a.idPoliza)
          if (!p || !this.pasaDims(p, f)) continue
          const g = grupo(claveDim(p, d))
          g.comision += a.comision
          g.recaudo += a.prima
        }
      }
      porDim[d] = ordenarPorPrima([...m.values()])
    }

    // Clientes: top, Pareto, concentración y nuevos vs recurrentes.
    const cli = new Map<string, Acum>()
    for (const p of actual.polizas) {
      const k = MotorDash.claveCliente(p)
      let a = cli.get(k)
      if (!a) {
        a = { nombre: p.nombreCliente ?? 'Sin cliente', n: 0, prima: 0 }
        cli.set(k, a)
      }
      a.n++
      a.prima += p.primaPoliza
    }
    const ordenados = ordenarPorPrima([...cli.values()])
    const totalPrima = actual.prima
    const pareto: number[] = []
    let acum = 0
    for (const c of ordenados.slice(0, 50)) {
      acum += c.prima
      pareto.push(totalPrima === 0 ? 0 : (acum / totalPrima) * 100)
    }
    const top10 = ordenados.slice(0, 10).reduce((s, c) => s + c.prima, 0)
    let nNuevos = 0
    let nRec = 0
    let pNuevos = 0
    let pRec = 0
    for (const [k, v] of cli) {
      const primera = this.primeraFecha.get(k)
      if (primera && !antes(primera, f.desde)) {
        nNuevos++
        pNuevos += v.prima
      } else {
        nRec++
        pRec += v.prima
      }
    }

    // Cartera de lo emitido en el período.
    let cPrima = 0
    let cPagada = 0
    let cSaldo = 0
    const aging = new Map<string, number>(ETIQUETAS_AGING.map((e) => [e, 0]))
    const deud = new Map<string, Acum>()
    for (const p of actual.polizas) {
      if (p.estadoPolizaId === 'A' || p.primaPoliza <= 0) continue
      const pagada = Math.min(Math.max(p.vlrprimapagadaPoliza ?? 0, 0), p.primaPoliza)
      const saldo = p.primaPoliza - pagada
      cPrima += p.primaPoliza
      cPagada += pagada
      if (saldo <= 0) continue
      cSaldo += saldo
      const ini = p.finiPoliza ?? fechaProduccion(p) ?? hoy
      const dias = diasEntre(ini, hoy)
      const k =
        dias < 0
          ? 'Sin iniciar'
          : dias <= 30
            ? '0–30 días'
            : dias <= 60
              ? '31–60 días'
              : dias <= 90
                ? '61–90 días'
                : dias <= 180
                  ? '91–180 días'
                  : 'Más de 180'
      aging.set(k, (aging.get(k) ?? 0) + saldo)
      const ck = MotorDash.claveCliente(p)
      let d = deud.get(ck)
      if (!d) {
        d = { nombre: p.nombreCliente ?? 'Sin cliente', n: 0, prima: 0 }
        deud.set(ck, d)
      }
      d.n++
      d.prima += saldo
    }
    const deudores = ordenarPorPrima([...deud.values()])
      .slice(0, 10)
      .map((e) => ({ nombre: e.nombre, n: e.n, prima: e.prima }))

    // Renovaciones. Las pólizas que vencieron dentro del período (y ya
    // pasaron) son la base; cuenta cuántas tienen una póliza que las sigue.
    let renBase = 0
    let renOk = 0
    const renAseg = new Map<string, Grupo>()
    const renAsesor = new Map<string, Grupo>()
    const fa: FiltrosDash = { ...f, estado: 0 }
    const sinRen: FilaPoliza[] = []
    const por30: FilaPoliza[] = []
    const hasta30 = sumarDias(hoy, 30)
    const hasta60 = sumarDias(hoy, 60)
    const hasta90 = sumarDias(hoy, 90)
    const desde90 = sumarDias(hoy, -90)
    const futuros: Date[] = []
    for (let i = 0; i < 12; i++) futuros.push(new Date(hoy.getFullYear(), hoy.getMonth() + i, 1))
    const venceN: number[] = new Array(12).fill(0)
    const vencePrima: number[] = new Array(12).fill(0)
    let v30 = 0
    let v60 = 0
    let v90 = 0
    let p30 = 0
    let p60 = 0
    let p90 = 0
    let sr = 0
    let srPrima = 0
    const mes0 = mesIdx(hoy)
    const grupoRen = (m: Map<string, Grupo>, nombre: string) => {
      let g = m.get(nombre)
      if (!g) {
        g = { nombre, n: 0, prima: 0, comision: 0, recaudo: 0 }
        m.set(nombre, g)
      }
      return g
    }

    for (const p of this.polizas) {
      if (!this.pasaPoliza(p, fa)) continue
      const fin = p.ffinPoliza
      if (!fin) continue
      if (MotorDash.enRango(fin, f.desde, f.hasta) && antes(fin, hoy)) {
        renBase++
        const ok = this.renovada(p)
        if (ok) renOk++
        const ga = grupoRen(renAseg, claveDim(p, 'aseguradora'))
        const gs = grupoRen(renAsesor, claveDim(p, 'asesor'))
        ga.n++
        gs.n++
        if (ok) {
          ga.prima += 1
          gs.prima += 1
        }
      }
      if (!antes(fin, hoy)) {
        const i = mesIdx(fin) - mes0
        if (i >= 0 && i < 12) {
          venceN[i] += 1
          vencePrima[i] += p.primaPoliza
        }
        const dias = diasEntre(hoy, fin)
        if (!despues(fin, hasta30)) {
          v30++
          p30 += p.primaPoliza
          por30.push({ p, valor: p.primaPoliza, dias })
        } else if (!despues(fin, hasta60)) {
          v60++
          p60 += p.primaPoliza
        } else if (!despues(fin, hasta90)) {
          v90++
          p90 += p.primaPoliza
        }
      } else if (!antes(fin, desde90) && !this.renovada(p)) {
        sr++
        srPrima += p.primaPoliza
        sinRen.push({ p, valor: p.primaPoliza, dias: diasEntre(fin, hoy) })
      }
    }
    por30.sort((a, b) => a.dias - b.dias)
    sinRen.sort((a, b) => b.valor - a.valor)

    // Matriz aseguradora × ramo (top 8 × top 8 por prima).
    const topAseg = porDim.aseguradora.slice(0, 8).map((g) => g.nombre)
    const topRamo = porDim.ramo.slice(0, 8).map((g) => g.nombre)
    const setAseg = new Set(topAseg)
    const setRamo = new Set(topRamo)
    const matriz: Record<string, number> = {}
    for (const p of actual.polizas) {
      const a = claveDim(p, 'aseguradora')
      const r = claveDim(p, 'ramo')
      if (!setAseg.has(a) || !setRamo.has(r)) continue
      matriz[`${a}||${r}`] = (matriz[`${a}||${r}`] ?? 0) + p.primaPoliza
    }

    const ordenarRen = (m: Map<string, Grupo>) => [...m.values()].sort((a, b) => b.n - a.n)

    return {
      filtros: f,
      actual,
      comp,
      meses,
      porDim,
      clientesTop: ordenados.slice(0, 15).map((e) => ({ nombre: e.nombre, n: e.n, prima: e.prima })),
      pareto,
      concentracionTop10: totalPrima === 0 ? 0 : (top10 / totalPrima) * 100,
      clientesNuevos: nNuevos,
      clientesRecurrentes: nRec,
      primaNuevos: pNuevos,
      primaRecurrentes: pRec,
      carteraSaldo: cSaldo,
      carteraPagada: cPagada,
      carteraPrima: cPrima,
      aging: [...aging.entries()],
      deudores,
      renBase,
      renRenovadas: renOk,
      renPorAseg: ordenarRen(renAseg),
      renPorAsesor: ordenarRen(renAsesor),
      mesesFuturos: futuros,
      venceN,
      vencePrima,
      porRenovar30: por30.slice(0, 40),
      sinRenovar90: sinRen.slice(0, 40),
      vence30: [v30, p30],
      vence60: [v60, p60],
      vence90: [v90, p90],
      sinRenovar90Tot: [sr, srPrima],
      matrizFilas: topAseg,
      matrizCols: topRamo,
      matriz,
      tasaRenovacion: renBase === 0 ? null : renOk / renBase,
    }
  }

  // ── Metas ──────────────────────────────────────────────────────────────

  /**
   * Real mes a mes (12 posiciones) de un año, para toda la agencia o un
   * asesor ([asesorId]).
   */
  realesAnio(anio: number, asesorId?: number | null): RealesAnio {
    const r: RealesAnio = {
      prima: new Array(12).fill(0),
      polizas: new Array(12).fill(0),
      comision: new Array(12).fill(0),
      recaudo: new Array(12).fill(0),
    }
    for (const p of this.polizas) {
      if (p.estadoPolizaId === 'A') continue
      if (asesorId != null && p.asesorId !== asesorId) continue
      const d = fechaProduccion(p)
      if (!d || d.getFullYear() !== anio) continue
      r.prima[d.getMonth()] += p.primaPoliza
      r.polizas[d.getMonth()] += 1
    }
    if (this.abonos) {
      for (const a of this.abonos) {
        const d = a.fecha
        if (!d || d.getFullYear() !== anio) continue
        if (asesorId != null && this.porId.get(a.idPoliza)?.asesorId !== asesorId) continue
        r.comision[d.getMonth()] += a.comision
        r.recaudo[d.getMonth()] += a.prima
      }
    }
    return r
  }

  // ── Calidad de datos ───────────────────────────────────────────────────

  calidad(): CalidadDatos {
    let total = 0
    let sinAsesor = 0
    let sinRamo = 0
    let sinVencimiento = 0
    let sinPrima = 0
    let sinCliente = 0
    for (const p of this.polizas) {
      if (p.estadoPolizaId === 'A') continue
      total++
      if (p.asesorId == null) sinAsesor++
      if (p.ramoId == null) sinRamo++
      if (!p.ffinPoliza) sinVencimiento++
      if (p.primaPoliza <= 0) sinPrima++
      if (p.clienteId == null) sinCliente++
    }
    return {
      total,
      sinAsesor,
      sinRamo,
      sinVencimiento,
      sinPrima,
      sinCliente,
      problemas: sinAsesor + sinRamo + sinVencimiento + sinPrima + sinCliente,
    }
  }

  /** Rango (mín, máx) de fechas de producción: para el preset "Todo". */
  rangoTotal(): [Date, Date] | null {
    let lo: Date | null = null
    let hi: Date | null = null
    for (const p of this.polizas) {
      const d = fechaProduccion(p)
      if (!d) continue
      if (!lo || antes(d, lo)) lo = d
      if (!hi || despues(d, hi)) hi = d
    }
    return lo && hi ? [lo, hi] : null
  }
}

/** Variación porcentual; null si no hay base de comparación. */
export function variacion(actual: number, previo: number | null | undefined): number | null {
  if (previo == null || previo === 0) return null
  return ((actual - previo) / Math.abs(previo)) * 100
}

/** (clientes con pólizas vigentes, de esos cuántos tienen un solo ramo). */
export function ventaCruzada(polizas: PolizaMotor[], hoy: Date): [number, number] {
  const m = new Map<string, Set<number>>()
  for (const p of polizas) {
    if (p.estadoPolizaId === 'A' || !p.ffinPoliza || antes(p.ffinPoliza, hoy)) continue
    const k = MotorDash.claveCliente(p)
    const s = m.get(k)
    if (s) s.add(p.ramoId ?? 0)
    else m.set(k, new Set([p.ramoId ?? 0]))
  }
  let uno = 0
  for (const s of m.values()) if (s.size === 1) uno++
  return [m.size, uno]
}

// ── Metas ─────────────────────────────────────────────────────────────────

/** Meta mensual de un indicador, para toda la agencia (asesorId = 0) o un asesor. */
export interface Meta {
  anio: number
  mes: number
  indicador: IndicadorClave
  asesorId: number
  valor: number
}

export interface IndicadorMeta {
  clave: IndicadorClave
  nombre: string
  monetario: boolean
}

export const INDICADORES_META: IndicadorMeta[] = [
  { clave: 'prima', nombre: 'Prima emitida', monetario: true },
  { clave: 'polizas', nombre: 'Pólizas emitidas', monetario: false },
  { clave: 'comision', nombre: 'Comisión recibida', monetario: true },
  { clave: 'recaudo', nombre: 'Recaudo de prima', monetario: true },
]

/** Meta del indicador en un mes (suma si hubiera repetidas) para la agencia (0) o un asesor. */
export function metaDe(metas: Meta[] | null | undefined, ind: IndicadorClave, mes: number, asesorId: number): number {
  if (!metas) return 0
  let s = 0
  for (const m of metas) if (m.indicador === ind && m.mes === mes && m.asesorId === asesorId) s += m.valor
  return s
}

/** Fracción del año / mes ya transcurrida, para la marca de ritmo de las metas. */
export function fraccionesMeta(anioMetas: number, hoy: Date): { mesRef: number; fracMes: number; fracAnio: number } {
  const esActual = anioMetas === hoy.getFullYear()
  const mesRef = esActual ? hoy.getMonth() + 1 : anioMetas < hoy.getFullYear() ? 12 : 1
  const diasMes = new Date(anioMetas, mesRef, 0).getDate()
  const fracMes = esActual ? hoy.getDate() / diasMes : anioMetas < hoy.getFullYear() ? 1 : 0
  const fracAnio = esActual
    ? (diasEntre(new Date(hoy.getFullYear(), 0, 1), hoy) + 1) /
      (diasEntre(new Date(hoy.getFullYear(), 0, 1), new Date(hoy.getFullYear(), 11, 31)) + 1)
    : anioMetas < hoy.getFullYear()
      ? 1
      : 0
  return { mesRef, fracMes, fracAnio }
}

/** Reparte un total anual en 12 partes enteras; el último mes absorbe el redondeo. */
export function repartirEnMeses(total: number): number[] {
  const base = Math.floor(total / 12)
  const out: number[] = []
  let acum = 0
  for (let m = 0; m < 12; m++) {
    out.push(m === 11 ? total - acum : base)
    acum += base
  }
  return out
}
