// Exportación del tablero a Excel (mismas 5 hojas de la app Flutter). Las
// fechas van como fechas reales de Excel (se pueden ordenar y filtrar) y los
// montos como números.

import * as XLSX from 'xlsx'
import type { CellObject, WorkSheet } from 'xlsx'
import { agrupar, diasParaVencer, type Dimension, type FilaReporte } from './calculos'

const FMT_FECHA = 'dd/mm/yyyy'
const FMT_FECHA_HORA = 'dd/mm/yyyy hh:mm'
const FMT_DINERO = '#,##0.##'

const EPOCA_EXCEL = Date.UTC(1899, 11, 30)

/** Número de serie de Excel para el día y la hora (locales) de [d]. */
export function serialExcel(d: Date, conHora = false): number {
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), conHora ? d.getHours() : 0, conHora ? d.getMinutes() : 0, conHora ? d.getSeconds() : 0)
  return (utc - EPOCA_EXCEL) / 86_400_000
}

type Celda = CellObject | string | number | null

const fecha = (d: Date | null): Celda => (d ? { t: 'n', v: serialExcel(d), z: FMT_FECHA } : null)
const fechaHora = (d: Date | null): Celda => (d ? { t: 'n', v: serialExcel(d, true), z: FMT_FECHA_HORA } : null)
const dinero = (n: number | null | undefined): Celda => (n == null ? null : { t: 'n', v: n, z: FMT_DINERO })
const texto = (s: string | null | undefined): Celda => s ?? ''

function hoja(filas: Celda[][], anchos: number[]): WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(filas)
  ws['!cols'] = anchos.map((wch) => ({ wch }))
  return ws
}

function hojaGrupo(filas: FilaReporte[], dim: Dimension, titulo: string): WorkSheet {
  return hoja(
    [
      [titulo, 'Pólizas', 'Prima Total'],
      ...agrupar(filas, dim, true).map((g) => [g.nombre, g.cantidad, dinero(g.prima)]),
    ],
    [40, 10, 18],
  )
}

export function construirLibro(filas: FilaReporte[], porVencer90: FilaReporte[], hoy: Date): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    wb,
    hoja(
      [
        [
          'Cód', 'Nro Póliza', 'Bien Asegurado', 'Cliente', 'Doc. Cliente', 'Aseguradora', 'Ramo', 'Producto',
          'F. Inicio', 'F. Vencimiento', 'Prima', 'Valor Póliza', 'Valor Asegurado', 'F. Expedición', 'Asesor',
          'F. Registro', 'F. Ult. Mod', 'Usuario',
        ],
        ...filas.map((r) => {
          const p = r.p
          return [
            p.id,
            texto(p.nro_poliza),
            texto(p.bien_asegurado),
            texto(p.nombre_cliente),
            texto(p.doc_cliente),
            texto(p.nombre_aseg),
            texto(p.nombre_ramo),
            texto(p.nombre_prod),
            fecha(r.fini),
            fecha(r.ffin),
            dinero(r.prima),
            dinero(p.valor_poliza ?? 0),
            dinero(p.vlraseg_poliza),
            fecha(r.fexp),
            texto(p.nombre_asesor),
            fechaHora(r.fcreado),
            fechaHora(r.fultmod),
            texto(p.apodo_usuario),
          ]
        }),
      ],
      [8, 18, 28, 34, 16, 24, 20, 24, 12, 13, 14, 14, 16, 13, 24, 16, 16, 12],
    ),
    'Pólizas',
  )
  XLSX.utils.book_append_sheet(wb, hojaGrupo(filas, 'aseg', 'Aseguradora'), 'Por Aseguradora')
  XLSX.utils.book_append_sheet(wb, hojaGrupo(filas, 'ramo', 'Ramo'), 'Por Ramo')
  XLSX.utils.book_append_sheet(wb, hojaGrupo(filas, 'asesor', 'Asesor'), 'Por Asesor')
  XLSX.utils.book_append_sheet(
    wb,
    hoja(
      [
        ['Cód', 'Nro Póliza', 'Cliente', 'Aseguradora', 'Ramo', 'Producto', 'F. Vencimiento', 'Días restantes', 'Prima', 'Asesor'],
        ...porVencer90.map((r) => [
          r.p.id,
          texto(r.p.nro_poliza),
          texto(r.p.nombre_cliente),
          texto(r.p.nombre_aseg),
          texto(r.p.nombre_ramo),
          texto(r.p.nombre_prod),
          fecha(r.ffin),
          diasParaVencer(r, hoy),
          dinero(r.prima),
          texto(r.p.nombre_asesor),
        ]),
      ],
      [8, 18, 34, 24, 20, 24, 13, 13, 14, 24],
    ),
    'Vencimientos 90 días',
  )
  return wb
}

const dos = (n: number) => String(n).padStart(2, '0')

/** Genera y descarga polizas_AAAAMMDD_HHMM.xlsx. */
export function descargarExcel(filas: FilaReporte[], porVencer90: FilaReporte[], hoy: Date) {
  const wb = construirLibro(filas, porVencer90, hoy)
  const n = new Date()
  const nombre = `polizas_${n.getFullYear()}${dos(n.getMonth() + 1)}${dos(n.getDate())}_${dos(n.getHours())}${dos(n.getMinutes())}.xlsx`
  XLSX.writeFile(wb, nombre, { compression: true })
}
