import type { AbonoLite, CalidadDatos, Dim, FiltrosDash, MotorDash, PolizaMotor, Resultado } from './motor'
import { fmtCompacto, fmtEntero } from './formato'
import { DashColors } from './colores'
import type { FilaRanking } from './graficos'
import { ticketDe } from './motor'

export type Pestana = 'resumen' | 'produccion' | 'clientes' | 'cartera' | 'renovaciones' | 'metas'

export const PESTANAS: Array<{ id: Pestana; texto: string }> = [
  { id: 'resumen', texto: 'Resumen' },
  { id: 'produccion', texto: 'Producción' },
  { id: 'clientes', texto: 'Clientes y asesores' },
  { id: 'cartera', texto: 'Cartera y recaudo' },
  { id: 'renovaciones', texto: 'Renovaciones' },
  { id: 'metas', texto: 'Metas' },
]

/** Lo que reciben todas las pestañas del dashboard. */
export interface CtxDash {
  r: Resultado
  f: FiltrosDash
  motor: MotorDash
  polizas: PolizaMotor[]
  /** null si los pagos no se pudieron cargar. */
  abonos: AbonoLite[] | null
  calidad: CalidadDatos
  /** Pólizas por revisar (borradores y de carga masiva); null si no se supo. */
  casos: number | null
  /** Filtra por el valor (o quita el filtro si ya estaba elegido). */
  alternarDim: (d: Dim, valor: string) => void
  cambiarFiltros: (fn: (f: FiltrosDash) => FiltrosDash) => void
  irA: (p: Pestana) => void
  periodoTxt: string
  compTxt: string
}

export type Medida = 'prima' | 'n' | 'comision'

/** Filas de ranking de una dimensión, con su color fijo por entidad. */
export function filasDim(r: Resultado, d: Dim, medida: Medida = 'prima'): FilaRanking[] {
  return r.porDim[d]
    .map((g) => ({
      nombre: g.nombre,
      valor: medida === 'n' ? g.n : medida === 'comision' ? g.comision : g.prima,
      color: DashColors.de(g.nombre),
      detalle: `${fmtEntero(g.n)} pólizas · ticket ${fmtCompacto(ticketDe(g))}`,
      valorTexto: medida === 'n' ? fmtEntero(g.n) : undefined,
    }))
    .sort((a, b) => b.valor - a.valor)
}
