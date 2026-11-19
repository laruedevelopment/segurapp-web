// Pólizas de vehículos: el "nombre" del bien asegurado es solo la placa.

/** Interruptor: la placa como nombre solo está activa en la copia de pruebas por ahora. */
// (Se lee el ambiente directo: así este archivo no exige las claves de Supabase en las pruebas.)
export const USA_PLACA_COMO_NOMBRE = ((import.meta.env.VITE_APP_ENV as string | undefined) ?? 'dev') !== 'prod'

// Carro/camión: ABC123 · moto: ABC12D · remolque/semirremolque: R12345 / S12345.
const PLACAS = [/\b([A-Z]{3})[\s-]?(\d{3})\b/, /\b([A-Z]{3})[\s-]?(\d{2})([A-Z])\b/, /\b([RS])[\s-]?(\d{5})\b/]

/** Primera placa colombiana que aparece en el texto, en mayúsculas y sin separadores (o null). */
export function extraerPlaca(texto: string | null | undefined): string | null {
  const t = (texto ?? '').toUpperCase()
  let mejor: { i: number; placa: string } | null = null
  for (const re of PLACAS) {
    const m = re.exec(t)
    if (m && (!mejor || m.index < mejor.i)) mejor = { i: m.index, placa: m.slice(1).join('') }
  }
  return mejor?.placa ?? null
}

const SOLO_VEHICULO = /autom|veh[ií]cul|moto|camion|camión|pesad|liviano|taxi|\bbus\b|buseta|tracto|remolque|volqueta|soat|\bcarro/i
const TODO_RIESGO = /todo\s+riesgo/i
const NO_VEHICULO = /maquinaria|construcc|equipo|contratista|da[ñn]o\s+material|electr|cumplimiento|garant/i

/** ¿El ramo o producto es de vehículos? */
export function esRamoVehiculo(ramo: string | null | undefined, producto?: string | null): boolean {
  const t = `${ramo ?? ''} ${producto ?? ''}`
  if (NO_VEHICULO.test(t) && !SOLO_VEHICULO.test(t)) return false
  return SOLO_VEHICULO.test(t) || (TODO_RIESGO.test(t) && !NO_VEHICULO.test(t))
}

/** Lo que se muestra como bien asegurado: la placa si es un vehículo y hay placa; si no, el texto tal cual. */
export function nombreBien(bien: string | null | undefined, ramo?: string | null, producto?: string | null): string | null {
  const b = (bien ?? '').trim()
  if (!b) return null
  if (!USA_PLACA_COMO_NOMBRE) return b
  return (esRamoVehiculo(ramo, producto) ? extraerPlaca(b) : null) ?? b
}
