import { colapsarAnexos } from '@/datos/grupoPolizaLogica'

/** Lo mínimo de una póliza que necesita la ficha del cliente. */
export interface PolCliente {
  id: number
  nro: string | null
  asegId: number | null
  ramoId: number | null
  nombreRamo: string | null
  nombreAseg: string | null
  /** Inicio y fin de vigencia (AAAA-MM-DD o con hora). */
  fini: string | null
  fin: string | null
  prima: number | null
  valor: number | null
  bien: string | null
  obs: string | null
}

export type PolColapsada = PolCliente & { anexos: number; placas: string[]; vigente: boolean }

const dia = (v: string | null | undefined) => (v ?? '').slice(0, 10)

/** Vigente = el fin de vigencia es hoy o después. Sin fecha de fin no se da por vigente. */
export const esVigente = (fin: string | null, hoyISO: string) => dia(fin) !== '' && dia(fin) >= hoyISO

/** Pólizas del cliente con los anexos de una misma vigencia en una sola fila; la vigente primero, luego por fin descendente. */
export function polizasDelCliente(pols: PolCliente[], hoyISO: string): PolColapsada[] {
  const filas = pols.map((p) => ({ ...p, fin: p.fin }))
  return colapsarAnexos(filas)
    .map((p) => ({ ...p, vigente: esVigente(p.fin, hoyISO) }))
    .sort((a, b) => Number(b.vigente) - Number(a.vigente) || dia(b.fin).localeCompare(dia(a.fin)) || b.id - a.id)
}

export interface ResumenCliente {
  vigentes: number
  vencidas: number
  primaVigente: number
  valorVigente: number
  /** Año de la primera póliza (null si ninguna tiene fecha). */
  desde: number | null
  anios: number
  aseguradoras: number
}

export function resumenCliente(pols: PolCliente[], hoyISO: string): ResumenCliente {
  const col = polizasDelCliente(pols, hoyISO)
  // La prima y el valor suman TODAS las filas de la vigencia (cada anexo puede sumar o restar).
  const vig = pols.filter((p) => esVigente(p.fin, hoyISO))
  const inicios = pols.map((p) => dia(p.fini)).filter(Boolean).sort()
  const desde = inicios.length ? Number(inicios[0].slice(0, 4)) : null
  return {
    vigentes: col.filter((p) => p.vigente).length,
    vencidas: col.filter((p) => !p.vigente).length,
    primaVigente: vig.reduce((s, p) => s + (p.prima ?? 0), 0),
    valorVigente: vig.reduce((s, p) => s + (p.valor ?? 0), 0),
    desde,
    anios: desde == null ? 0 : Math.max(0, Number(hoyISO.slice(0, 4)) - desde),
    aseguradoras: new Set(col.filter((p) => p.vigente && p.asegId != null).map((p) => p.asegId)).size,
  }
}

export type EstadoRamo = 'vigente' | 'vencido' | 'sin'

export interface CoberturaRamo {
  ramoId: number
  nombre: string
  estado: EstadoRamo
}

/** Por cada ramo activo del catálogo: si el cliente lo tiene vigente, lo tuvo y venció, o nunca lo tuvo. Venta cruzada. */
export function coberturaPorRamo(pols: PolCliente[], ramos: { id: number; nombre_ramo: string; estado_ramo?: boolean }[], hoyISO: string): CoberturaRamo[] {
  const vigentes = new Set<number>()
  const tuvo = new Set<number>()
  for (const p of pols) {
    if (p.ramoId == null) continue
    tuvo.add(p.ramoId)
    if (esVigente(p.fin, hoyISO)) vigentes.add(p.ramoId)
  }
  const orden: Record<EstadoRamo, number> = { vigente: 0, vencido: 1, sin: 2 }
  return ramos
    .filter((r) => r.estado_ramo !== false || tuvo.has(r.id))
    .map((r) => ({ ramoId: r.id, nombre: r.nombre_ramo, estado: (vigentes.has(r.id) ? 'vigente' : tuvo.has(r.id) ? 'vencido' : 'sin') as EstadoRamo }))
    .sort((a, b) => orden[a.estado] - orden[b.estado] || a.nombre.localeCompare(b.nombre, 'es'))
}

export interface EventoLinea {
  /** AAAA-MM-DD */
  fecha: string
  tipo: 'inicio' | 'vence' | 'vencio'
  texto: string
  polizaId: number
}

/** Línea de tiempo (lo más reciente primero): inicio de cada vigencia y su vencimiento (pasado o próximo). */
export function lineaDeTiempo(pols: PolCliente[], hoyISO: string, limite = 40): EventoLinea[] {
  const ev: EventoLinea[] = []
  for (const p of polizasDelCliente(pols, hoyISO)) {
    const que = [p.nombreRamo ?? 'Póliza', p.nro ? `(${p.nro})` : ''].filter(Boolean).join(' ')
    if (dia(p.fini)) ev.push({ fecha: dia(p.fini), tipo: 'inicio', texto: `Inicia ${que}`, polizaId: p.id })
    if (dia(p.fin)) {
      const pasado = dia(p.fin) < hoyISO
      ev.push({ fecha: dia(p.fin), tipo: pasado ? 'vencio' : 'vence', texto: `${pasado ? 'Venció' : 'Vence'} ${que}`, polizaId: p.id })
    }
  }
  return ev.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.polizaId - b.polizaId).slice(0, limite)
}
