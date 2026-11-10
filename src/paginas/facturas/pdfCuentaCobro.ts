// PDF de la cuenta de cobro de una factura. Va dirigida a la empresa (razón social y NIT con
// las que se factura) y deja claro de qué aseguradora son las comisiones: nombre, NIT y la
// clave de intermediario con que Rueda Serrano está inscrita ante ella. Incluye el detalle
// de las pólizas, los totales con sus retenciones y el valor en letras.

import type { jsPDF } from 'jspdf'
import { comisionDeLinea, numeroFactura, type Factura } from '@/datos/facturasLogica'
import type { AbonoPoliza } from '@/datos/pagos'
import { aFecha } from '@/lib/fechas'
import { pesosEnLetras } from '@/lib/letras'
import { fmtPct } from '@/lib/numeros'
import {
  AZUL,
  BLANCO,
  BORDE,
  GRIS,
  GRIS_CLARO,
  MARGEN,
  MARGEN_INFERIOR,
  TINTA,
  Y_CONTENIDO,
  altoPagina,
  anchoPagina,
  anchoUtil,
  bloqueInfo,
  dinero,
  divisor,
  encabezadosYPies,
  fecha,
  finalY,
  nuevoDocumento,
  tabla,
  texto,
  type FilaInfo,
  type LogoPdf,
} from '@/paginas/comisiones/pdf'

// Datos fijos de quien cobra (los mismos del software anterior).
export const NIT_AGENCIA = '63.362.817-2'
export const CONTACTO_AGENCIA = ['Celular: 3153729644', 'Correo: lstellaserranom@yahoo.com', 'Bucaramanga - Colombia']

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "11 de noviembre de 2026" */
export function fechaLarga(iso: string | null | undefined): string {
  const d = aFecha(iso)
  return d ? `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}` : '—'
}

/** Reportes de comisión que cubre la factura, de menor a mayor ("#12, #13"). */
export function reportesDeLineas(lineas: AbonoPoliza[]): number[] {
  return [...new Set(lineas.map((l) => l.idrep_pago).filter((r): r is number => r != null))].sort((a, b) => a - b)
}

/** Rango de fechas de pago de las líneas ("01/10/2026 – 31/10/2026"), o '' si no hay fechas. */
export function periodoDeLineas(lineas: AbonoPoliza[]): string {
  const f = lineas.map((l) => l.fecha_pago?.slice(0, 10)).filter((x): x is string => !!x).sort()
  if (f.length === 0) return ''
  const a = fecha(f[0])
  const b = fecha(f[f.length - 1])
  return a === b ? a : `${a} – ${b}`
}

/** Nombre de archivo: "Cuenta_de_cobro_2-2731_COLPATRIA". */
export const nombreArchivoCuentaCobro = (f: Factura) =>
  `Cuenta_de_cobro_${numeroFactura(f.prefijo, f.numFactura)}_${(f.nombreAseg ?? '').trim().split(/\s+/)[0] ?? ''}`.replace(/_$/, '')

function espacio(doc: jsPDF, y: number, alto: number) {
  if (y + alto > altoPagina(doc) - MARGEN_INFERIOR) {
    doc.addPage()
    return Y_CONTENIDO
  }
  return y
}

export function pdfCuentaCobro({ factura: f, lineas, logo }: { factura: Factura; lineas: AbonoPoliza[]; logo: LogoPdf | null }): jsPDF {
  const doc = nuevoDocumento()
  const ancho = anchoUtil(doc)
  const numero = numeroFactura(f.prefijo, f.numFactura)
  const reportes = reportesDeLineas(lineas)
  const periodo = periodoDeLineas(lineas)

  let y = Y_CONTENIDO
  divisor(doc, y)

  // Título, número y fecha
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...AZUL)
  doc.text('CUENTA DE COBRO', MARGEN, y + 17)
  doc.setFontSize(13)
  doc.text(`N° ${numero}`, anchoPagina(doc) - MARGEN, y + 17, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRIS)
  doc.text(`Bucaramanga, ${fechaLarga(f.fecha)}`, anchoPagina(doc) - MARGEN, y + 31, { align: 'right' })
  if (f.estado === 'N') {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0xc6, 0x28, 0x28)
    doc.text('ANULADA', MARGEN, y + 31)
  }
  doc.setTextColor(...TINTA)
  y += 44

  // Quién debe y quién cobra, lado a lado
  const mitad = (ancho - 12) / 2
  const deudor: FilaInfo[] = [
    ['Razón social', f.empresaNombre ?? '—'],
    ['NIT', f.empresaNit ?? '—'],
    ['Aseguradora', f.nombreAseg ?? '—'],
    ...(f.asegNit && f.asegNit !== f.empresaNit ? ([['NIT aseguradora', f.asegNit]] as FilaInfo[]) : []),
  ]
  const acreedor: FilaInfo[] = [
    ['Intermediario', f.nombreInterm ?? '—'],
    ['Agencia', 'Rueda Serrano Asesores de Seguros'],
    ['NIT', NIT_AGENCIA],
    ['Clave intermediario', f.asegClave ?? '—'],
  ]
  const yIzq = bloqueInfo(doc, y, 'DEBE (EMPRESA)', deudor, { izquierda: MARGEN, ancho: mitad })
  const yDer = bloqueInfo(doc, y, 'DEBE A', acreedor, { izquierda: MARGEN + mitad + 12, ancho: mitad })
  y = Math.max(yIzq, yDer) + 12

  // Valor en letras
  y = espacio(doc, y, 70)
  const letras = pesosEnLetras(f.total)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  const lineasLetras = doc.splitTextToSize(`LA SUMA DE: ${letras}  (${dinero(f.total)})`, ancho - 20) as string[]
  const altoCaja = lineasLetras.length * 13 + 14
  doc.setFillColor(...GRIS_CLARO)
  doc.setDrawColor(...BORDE)
  doc.rect(MARGEN, y, ancho, altoCaja, 'FD')
  doc.setTextColor(...AZUL)
  doc.text(lineasLetras, MARGEN + 10, y + 17)
  doc.setTextColor(...TINTA)
  y += altoCaja + 10

  // Concepto
  const partesConcepto = [
    `COMISIONES de la aseguradora ${f.nombreAseg ?? '—'}`,
    reportes.length ? `según ${reportes.length === 1 ? 'el reporte' : 'los reportes'} ${reportes.map((r) => `#${r}`).join(', ')}` : '',
    periodo ? `con pagos del ${periodo}` : '',
  ].filter(Boolean)
  y = texto(doc, `POR CONCEPTO DE: ${partesConcepto.join(', ')}.`, y, 'negrita') + 4
  if (f.observacion) y = texto(doc, `Observación: ${f.observacion}`, y, 'cuerpo') + 4
  y += 6

  // Detalle de las pólizas
  y = espacio(doc, y, 60)
  y = texto(doc, `DETALLE (${lineas.length} ${lineas.length === 1 ? 'línea' : 'líneas'})`, y, 'h2') + 6
  const subtotalLineas = lineas.reduce((s, l) => s + comisionDeLinea(l), 0)
  y = tabla(doc, y, {
    styles: { fontSize: 8, cellPadding: { horizontal: 4, vertical: 3 }, overflow: 'linebreak', textColor: TINTA, lineColor: BORDE, lineWidth: 0.5 },
    head: [['Rep.', 'Póliza', 'Cliente', 'Ramo / Producto', 'Prima', '%', 'Comisión']],
    body: lineas.map((l) => [
      l.idrep_pago != null ? `#${l.idrep_pago}` : '—',
      l.nro_poliza ?? '—',
      [l.nombre_cliente ?? '—', l.doc_cliente].filter(Boolean).join('\n'),
      [l.nombre_ramo, l.nombre_prod].filter(Boolean).join(' · ') || '—',
      dinero(l.vlrabono_prima),
      fmtPct(l.porccomision ?? 0),
      dinero(comisionDeLinea(l)),
    ]),
    foot: [['', '', '', 'SUBTOTAL COMISIONES', '', '', dinero(subtotalLineas)]],
    columnStyles: {
      0: { cellWidth: 34 },
      1: { cellWidth: 62 },
      4: { cellWidth: 62, halign: 'right' },
      5: { cellWidth: 40, halign: 'right' },
      6: { cellWidth: 66, halign: 'right' },
    },
  }) + 14

  // Totales (a la derecha)
  const filas: string[][] = [['Subtotal comisiones', dinero(f.subtotal)]]
  if (f.iva || f.ivaPct) filas.push([`IVA (${fmtPct(f.ivaPct)})`, dinero(f.iva)])
  filas.push(['TOTAL CUENTA DE COBRO', dinero(f.total)])
  if (f.retefuente) filas.push([`(-) Retención en la fuente (${fmtPct(f.retefuentePct)})`, dinero(f.retefuente)])
  if (f.ica) filas.push([`(-) Retención de ICA (${fmtPct(f.icaPct, 3)})`, dinero(f.ica)])
  if (f.reteiva) filas.push([`(-) Retención de IVA (${fmtPct(f.reteivaPct)} del IVA)`, dinero(f.reteiva)])
  filas.push(['VALOR A CONSIGNAR', dinero(f.neto)])
  const anchoTot = 300
  y = espacio(doc, y, filas.length * 18 + 10)
  const indiceTotal = filas.findIndex((x) => x[0].startsWith('TOTAL'))
  const indiceNeto = filas.length - 1
  y = tabla(doc, y, {
    theme: 'grid',
    alternateRowStyles: {},
    margin: { top: Y_CONTENIDO, bottom: MARGEN_INFERIOR, left: anchoPagina(doc) - MARGEN - anchoTot, right: MARGEN },
    tableWidth: anchoTot,
    body: filas,
    columnStyles: { 0: { cellWidth: 200 }, 1: { cellWidth: 100, halign: 'right', font: 'courier' } },
    didParseCell: (d) => {
      if (d.section !== 'body') return
      if (d.row.index === indiceTotal) {
        d.cell.styles.fontStyle = 'bold'
        d.cell.styles.fillColor = GRIS_CLARO
      }
      if (d.row.index === indiceNeto) {
        d.cell.styles.fontStyle = 'bold'
        d.cell.styles.fillColor = AZUL
        d.cell.styles.textColor = BLANCO
      }
    },
  })
  y = finalY(doc) + 8
  y = texto(doc, `Son: ${pesosEnLetras(f.neto)} a consignar.`, y, 'pequeno')

  // Firma y datos de contacto (juntos, sin partirse entre páginas)
  y = espacio(doc, y + 30, 100)
  const xFirma = MARGEN
  doc.setDrawColor(...TINTA)
  doc.setLineWidth(0.7)
  doc.line(xFirma, y + 34, xFirma + 230, y + 34)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...TINTA)
  doc.text(f.nombreInterm ?? 'Intermediario', xFirma, y + 47)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRIS)
  doc.setFontSize(8)
  doc.text(`NIT ${NIT_AGENCIA}`, xFirma, y + 59)
  doc.text(CONTACTO_AGENCIA, xFirma, y + 72, { lineHeightFactor: 1.35 })

  encabezadosYPies(doc, logo)
  return doc
}
