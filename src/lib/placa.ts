// Pólizas de vehículos: el "nombre" del bien asegurado es solo la placa.

/** Interruptor de la placa como nombre (activo en todos los ambientes desde la Etapa A). */
export const USA_PLACA_COMO_NOMBRE = true

// Carro/camión: ABC123 · moto: ABC12D · remolque/semirremolque: R12345 / S12345.
const FORMAS_PLACA = [String.raw`\b([A-Z]{3})[\s-]?(\d{3})\b`, String.raw`\b([A-Z]{3})[\s-]?(\d{2})([A-Z])\b`, String.raw`\b([RS])[\s-]?(\d{5})\b`]

/**
 * TODAS las placas colombianas que aparecen en el texto (en mayúsculas, sin separadores, sin repetir y en el
 * orden en que aparecen). Una póliza colectiva trae varios vehículos: cada placa debe poder buscarse.
 */
export function extraerPlacas(texto: string | null | undefined): string[] {
  const t = (texto ?? '').toUpperCase()
  const halladas: { i: number; placa: string }[] = []
  for (const forma of FORMAS_PLACA) {
    for (const m of t.matchAll(new RegExp(forma, 'g'))) halladas.push({ i: m.index ?? 0, placa: m.slice(1).join('') })
  }
  halladas.sort((a, b) => a.i - b.i)
  return [...new Set(halladas.map((h) => h.placa))]
}

/** La primera placa del texto, o null. */
export const extraerPlaca = (texto: string | null | undefined): string | null => extraerPlacas(texto)[0] ?? null

const SOLO_VEHICULO = /autom|veh[ií]cul|moto|camion|camión|pesad|liviano|taxi|\bbus\b|buseta|tracto|remolque|volqueta|soat|\bcarro/i
const TODO_RIESGO = /todo\s+riesgo/i
const NO_VEHICULO = /maquinaria|construcc|equipo|contratista|da[ñn]o\s+material|electr|cumplimiento|garant/i

/** ¿El ramo o producto es de vehículos? */
export function esRamoVehiculo(ramo: string | null | undefined, producto?: string | null): boolean {
  const t = `${ramo ?? ''} ${producto ?? ''}`
  if (NO_VEHICULO.test(t) && !SOLO_VEHICULO.test(t)) return false
  return SOLO_VEHICULO.test(t) || (TODO_RIESGO.test(t) && !NO_VEHICULO.test(t))
}

/**
 * Placas de una póliza: las del bien asegurado y las de las observaciones (en las colectivas el bien dice
 * "COLECTIVA" y las placas van en observaciones: "KSW194 - KTK168 - KTL356").
 */
export const placasDePoliza = (bien: string | null | undefined, obs?: string | null): string[] => extraerPlacas(`${bien ?? ''} ${obs ?? ''}`)

/**
 * Lo que se muestra como bien asegurado: si es un vehículo, todas sus placas ("Colectiva · A · B · C" si es
 * colectiva); si no, el texto tal cual.
 */
export function nombreBien(bien: string | null | undefined, ramo?: string | null, producto?: string | null, obs?: string | null): string | null {
  const b = (bien ?? '').trim()
  if (!b) return null
  if (!USA_PLACA_COMO_NOMBRE) return b
  const placas = esRamoVehiculo(ramo, producto) ? placasDePoliza(b, obs) : []
  if (!placas.length) return b
  return (/colectiv|flota/i.test(b) ? 'Colectiva · ' : '') + placas.join(' · ')
}
