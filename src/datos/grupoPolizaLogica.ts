// Una "póliza" completa es la aseguradora más su número base. Cada renovación (vigencia) y cada anexo es una
// fila aparte con el mismo número base y distinto último segmento ("400-40-994000012539-5": base 994000012539,
// anexo 5). Aquí se reconoce ese grupo, sus vigencias y sus anexos, y las placas de todos sus vehículos.

import { placasDePoliza } from '@/lib/placa'

const sinCeros = (s: string) => s.replace(/^0+/, '') || s

/** Segmentos alfanuméricos de un número de póliza. */
const segmentos = (nro: string) => nro.toUpperCase().split(/[^0-9A-Z]+/).filter(Boolean)

/**
 * Número base: el segmento más largo del número (mínimo 5 caracteres, igual que el cruce de comisiones).
 * "3001-4411030-0" → 4411030 · "101004014-0" → 101004014 · "400-40-994000012539" → 994000012539.
 */
export function nucleoPoliza(nro: string | null | undefined): string | null {
  if (!nro) return null
  const mayor = segmentos(nro).reduce((m, s) => (s.length > m.length ? s : m), '')
  return mayor.length >= 5 ? sinCeros(mayor) : null
}

/** Anexo: el último segmento si es distinto del número base; '' si la póliza se registró sin anexo. */
export function anexoDe(nro: string | null | undefined): string {
  const nucleo = nucleoPoliza(nro)
  if (!nro || !nucleo) return ''
  const segs = segmentos(nro)
  const ultimo = segs[segs.length - 1]
  return segs.length > 1 && sinCeros(ultimo) !== nucleo ? sinCeros(ultimo) : ''
}

/** Clave del grupo: aseguradora + número base (null si no hay número usable). */
export function claveGrupo(asegId: number | null | undefined, nro: string | null | undefined): string | null {
  const n = nucleoPoliza(nro)
  return n && asegId != null ? `${asegId}|${n}` : null
}

export interface FilaGrupo {
  id: number
  nro: string | null
  /** Fin de vigencia, AAAA-MM-DD (las filas con el mismo fin son la misma vigencia). */
  fin: string | null
  bien: string | null
  obs: string | null
}

export interface Vigencia<T extends FilaGrupo> {
  /** Fin de la vigencia ('' si no tiene). */
  fin: string
  /** Fila principal (el anexo más alto) y las demás de la misma vigencia. */
  filas: T[]
  /** Placas de todos los vehículos de la vigencia (la original y sus anexos). */
  placas: string[]
}

const numAnexo = (nro: string | null) => {
  const a = anexoDe(nro)
  return a === '' ? -1 : /^[0-9]+$/.test(a) ? Number(a) : 1e9
}

/** Vigencias de un grupo, la más reciente primero; dentro de cada una, la original y luego sus anexos. */
export function vigenciasDe<T extends FilaGrupo>(filas: T[]): Vigencia<T>[] {
  const porFin = new Map<string, T[]>()
  for (const f of filas) {
    const k = (f.fin ?? '').slice(0, 10)
    porFin.set(k, [...(porFin.get(k) ?? []), f])
  }
  return [...porFin]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([fin, fs]) => {
      const ordenadas = [...fs].sort((a, b) => numAnexo(a.nro) - numAnexo(b.nro) || a.id - b.id)
      const placas = [...new Set(ordenadas.flatMap((f) => placasDePoliza(f.bien, f.obs)))]
      return { fin, filas: ordenadas, placas }
    })
}

/**
 * Colapsa en una sola fila las que son anexos de la misma vigencia (mismo grupo y mismo fin): queda la de
 * mayor anexo, con cuántos anexos tiene y las placas de todos. Las filas sin grupo quedan como están.
 */
export function colapsarAnexos<T extends FilaGrupo & { asegId: number | null }>(filas: T[]): (T & { anexos: number; placas: string[] })[] {
  const grupos = new Map<string, T[]>()
  const sueltas: T[] = []
  for (const f of filas) {
    const g = claveGrupo(f.asegId, f.nro)
    if (!g) sueltas.push(f)
    else grupos.set(`${g}|${(f.fin ?? '').slice(0, 10)}`, [...(grupos.get(`${g}|${(f.fin ?? '').slice(0, 10)}`) ?? []), f])
  }
  const colapsadas = [...grupos.values()].map((fs) => {
    const orden = [...fs].sort((a, b) => numAnexo(a.nro) - numAnexo(b.nro) || a.id - b.id)
    const principal = orden[orden.length - 1]
    return { ...principal, anexos: fs.length - 1, placas: [...new Set(orden.flatMap((f) => placasDePoliza(f.bien, f.obs)))] }
  })
  const lista = [...colapsadas, ...sueltas.map((f) => ({ ...f, anexos: 0, placas: placasDePoliza(f.bien, f.obs) }))]
  // Se conserva el orden en que llegaron las filas originales.
  const orden = new Map(filas.map((f, i) => [f.id, i]))
  return lista.sort((a, b) => (orden.get(a.id) ?? 0) - (orden.get(b.id) ?? 0))
}
