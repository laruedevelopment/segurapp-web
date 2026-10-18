// Clasificación de los grupos de pólizas con número repetido.
// Réplica de lib/ui/pagina_polizas_duplicadas.dart de la app Flutter.

export type TipoGrupo = 'identicas' | 'distintaPrimaOVigencia' | 'distintoCliente'

export const TIPOS_GRUPO: readonly TipoGrupo[] = ['identicas', 'distintaPrimaOVigencia', 'distintoCliente']

export const ETIQUETA_TIPO: Record<TipoGrupo, string> = {
  identicas: 'Idénticas',
  distintaPrimaOVigencia: 'Distinta prima o vigencia',
  distintoCliente: 'Distinto cliente',
}

export const AYUDA_TIPO: Record<TipoGrupo, string> = {
  identicas: 'Mismo cliente, prima y vigencia: casi seguro la misma póliza cargada dos veces.',
  distintaPrimaOVigencia:
    'Mismo cliente pero distinta prima o vigencia: puede ser una renovación, un anexo o un error.',
  distintoCliente: 'Clientes distintos con el mismo número: probablemente un número o un cliente mal digitado.',
}

/** Campos de una póliza que intervienen en la clasificación. */
export interface PolizaClasificable {
  estado_poliza_id: string | null
  cliente_id: number | null
  prima_poliza: number | null
  fini_poliza: string | null
  ffin_poliza: string | null
}

export const estaAnulada = (p: Pick<PolizaClasificable, 'estado_poliza_id'>) => p.estado_poliza_id === 'A'

export const polizasActivas = <T extends PolizaClasificable>(g: readonly T[]): T[] => g.filter((p) => !estaAnulada(p))

/** Resuelto = ya quedó una sola póliza activa (las demás están anuladas). */
export const grupoResuelto = (g: readonly PolizaClasificable[]) => polizasActivas(g).length < 2

/**
 * Cómo se parecen las pólizas activas del grupo (si ya no hay dos activas, se
 * comparan todas): distinto cliente > distinta prima o vigencia > idénticas.
 */
export function tipoDeGrupo(g: readonly PolizaClasificable[]): TipoGrupo {
  const activas = polizasActivas(g)
  const base = activas.length >= 2 ? activas : g
  if (new Set(base.map((p) => p.cliente_id)).size > 1) return 'distintoCliente'
  const primas = new Set(base.map((p) => p.prima_poliza))
  const vigencias = new Set(base.map((p) => `${p.fini_poliza}|${p.ffin_poliza}`))
  if (primas.size > 1 || vigencias.size > 1) return 'distintaPrimaOVigencia'
  return 'identicas'
}

export interface ResumenGrupos<T> {
  /** Grupos con 2 o más pólizas activas. */
  pendientes: T[]
  /** Cantidad de grupos ya resueltos. */
  resueltos: number
  /** Los que se listan: pendientes, o todos si se incluyen los resueltos. */
  base: T[]
  conteo: Record<TipoGrupo, number>
  /** `base` filtrado por el chip elegido. */
  visibles: T[]
  totalPolizas: number
}

/** Filtros y conteos de los chips de la pantalla. */
export function resumirGrupos<T extends readonly PolizaClasificable[]>(
  grupos: readonly T[],
  incluirResueltos: boolean,
  filtro: TipoGrupo | null,
): ResumenGrupos<T> {
  const pendientes = grupos.filter((g) => !grupoResuelto(g))
  const base = incluirResueltos ? [...grupos] : pendientes
  const conteo: Record<TipoGrupo, number> = { identicas: 0, distintaPrimaOVigencia: 0, distintoCliente: 0 }
  for (const g of base) conteo[tipoDeGrupo(g)]++
  const visibles = base.filter((g) => filtro == null || tipoDeGrupo(g) === filtro)
  return {
    pendientes,
    resueltos: grupos.length - pendientes.length,
    base,
    conteo,
    visibles,
    totalPolizas: visibles.reduce((s, g) => s + g.length, 0),
  }
}
