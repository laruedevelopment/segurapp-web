// PDF del estado de cuenta (por póliza y por reporte) y del comprobante de
// pago de un abono. Réplica de lib/utils/generador_pdf.dart de la app Flutter:
// encabezado con el logo en cada página, "Página X de N", bloques de
// información, resumen e historial con totales (los anulados no suman).

import { jsPDF } from 'jspdf'
import { autoTable, type CellHookData, type UserOptions } from 'jspdf-autotable'
import { etiquetaEstadoPago, type AbonoPoliza, type ReportePago } from '@/datos/pagos'
import { aFecha, aFechaHora, fmtFecha, fmtFechaHora } from '@/lib/fechas'
import { fmtDinero, fmtDoc } from '@/lib/numeros'
import {
  calcularSaldo,
  calcularTotales,
  comisionAbono,
  esAnulado,
  etiquetaSaldo,
  fmtPct1,
  nombreArchivoPdf,
} from './estado-cuenta-calculos'

// ── Colores corporativos (mismos de Flutter) ────────────────────────────────
type RGB = [number, number, number]
const AZUL: RGB = [0x1c, 0x48, 0x70]
const AZUL_CLARO: RGB = [0x2e, 0x5f, 0x8c]
const VERDE: RGB = [0x1e, 0x9b, 0x4e]
const GRIS: RGB = [0x61, 0x61, 0x61]
const GRIS_CLARO: RGB = [0xf5, 0xf5, 0xf5]
const BORDE: RGB = [0xdd, 0xdd, 0xdd]
const TINTA: RGB = [0x1b, 0x24, 0x30]
const BLANCO: RGB = [255, 255, 255]
const ANULADO: RGB = [0x9e, 0x9e, 0x9e]

// ── Página A4 en puntos, márgenes de 36 como en Flutter ─────────────────────
const MARGEN = 36
const ALTO_ENCABEZADO = 48
const Y_CONTENIDO = MARGEN + ALTO_ENCABEZADO
const MARGEN_INFERIOR = MARGEN + 16
const LADO_MAX_LOGO = 320

export type FilaInfo = [etiqueta: string, valor: string]

export interface LogoPdf {
  dataUrl: string
  ancho: number
  alto: number
}

const dinero = (n: number | null | undefined) => fmtDinero(n ?? 0)
const fecha = (v: string | null | undefined) => fmtFecha(aFecha(v))

/**
 * Carga public/logo.png como data URL (con su tamaño para no deformarlo).
 * Si falla, el PDF sale sin logo, igual que en Flutter.
 */
export async function cargarLogoPdf(): Promise<LogoPdf | null> {
  try {
    const resp = await fetch(`${import.meta.env.BASE_URL}logo.png`)
    if (!resp.ok) return null
    const blob = await resp.blob()
    const dataUrl = await new Promise<string>((res, rej) => {
      const lector = new FileReader()
      lector.onload = () => res(String(lector.result))
      lector.onerror = () => rej(lector.error)
      lector.readAsDataURL(blob)
    })
    const img = new Image()
    img.src = dataUrl
    await img.decode()
    const ancho = img.naturalWidth || 1
    const alto = img.naturalHeight || 1
    // El logo original es muy grande (3482 × 2447): sin reducirlo, cada PDF
    // pesaría más de 30 MB. En el PDF ocupa 40 pt; 320 px sobran para imprimir.
    const escala = Math.min(1, LADO_MAX_LOGO / Math.max(ancho, alto))
    const lienzo = document.createElement('canvas')
    lienzo.width = Math.max(1, Math.round(ancho * escala))
    lienzo.height = Math.max(1, Math.round(alto * escala))
    const ctx = lienzo.getContext('2d')
    if (!ctx) return null
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height)
    return { dataUrl: lienzo.toDataURL('image/png'), ancho: lienzo.width, alto: lienzo.height }
  } catch {
    return null
  }
}

// ── Piezas comunes ──────────────────────────────────────────────────────────

function nuevoDocumento() {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TINTA)
  return doc
}

const anchoPagina = (doc: jsPDF) => doc.internal.pageSize.getWidth()
const altoPagina = (doc: jsPDF) => doc.internal.pageSize.getHeight()
const anchoUtil = (doc: jsPDF) => anchoPagina(doc) - 2 * MARGEN
const finalY = (doc: jsPDF) => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? Y_CONTENIDO

/** Encabezado de empresa (logo + nombre) y pie "Página X de N" en todas las páginas. */
function encabezadosYPies(doc: jsPDF, logo: LogoPdf | null) {
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    let x = MARGEN
    if (logo) {
      // Cabe en un cuadro de 40 × 40 sin deformarse.
      const escala = Math.min(40 / logo.ancho, 40 / logo.alto)
      const w = logo.ancho * escala
      const h = logo.alto * escala
      // Mismo alias en todas las páginas: la imagen se incrusta una sola vez.
      doc.addImage(logo.dataUrl, 'PNG', MARGEN + (40 - w) / 2, MARGEN + (40 - h) / 2, w, h, 'logo', 'FAST')
      x += 52
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...AZUL)
    doc.text('Rueda Serrano Asesores de Seguros', x, MARGEN + 17)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GRIS)
    doc.text('SegurApp – Sistema de Gestión de Pólizas', x, MARGEN + 30)

    doc.setFontSize(8)
    doc.text(`Página ${i} de ${total}`, anchoPagina(doc) - MARGEN, altoPagina(doc) - MARGEN + 8, { align: 'right' })
  }
  doc.setTextColor(...TINTA)
}

function divisor(doc: jsPDF, y: number) {
  doc.setDrawColor(...AZUL_CLARO)
  doc.setLineWidth(1)
  doc.line(MARGEN, y, anchoPagina(doc) - MARGEN, y)
}

/** Texto que salta de página si no cabe. Devuelve la nueva Y. */
function texto(doc: jsPDF, t: string, y: number, estilo: 'h1' | 'h2' | 'negrita' | 'cuerpo' | 'pequeno') {
  const e = {
    h1: { tam: 16, negrita: true, color: AZUL },
    h2: { tam: 12, negrita: true, color: AZUL },
    negrita: { tam: 9, negrita: true, color: TINTA },
    cuerpo: { tam: 9, negrita: false, color: TINTA },
    pequeno: { tam: 8, negrita: false, color: GRIS },
  }[estilo]
  doc.setFont('helvetica', e.negrita ? 'bold' : 'normal')
  doc.setFontSize(e.tam)
  doc.setTextColor(...e.color)
  const lineas = doc.splitTextToSize(t, anchoUtil(doc)) as string[]
  const alto = lineas.length * e.tam * 1.2
  if (y + alto > altoPagina(doc) - MARGEN_INFERIOR) {
    doc.addPage()
    y = Y_CONTENIDO
  }
  doc.text(lineas, MARGEN, y + e.tam)
  doc.setTextColor(...TINTA)
  return y + alto
}

/** Las cifras de dinero van en letra de ancho fijo y alineadas a la derecha. */
function estiloCifras(d: CellHookData) {
  const t = d.cell.raw
  if (typeof t === 'string' && t.startsWith('$')) {
    d.cell.styles.font = 'courier'
    d.cell.styles.halign = 'right'
  }
}

const baseTabla = (doc: jsPDF, y: number): UserOptions => ({
  startY: y,
  theme: 'grid',
  margin: { top: Y_CONTENIDO, bottom: MARGEN_INFERIOR, left: MARGEN, right: MARGEN },
  styles: {
    font: 'helvetica',
    fontSize: 9,
    textColor: TINTA,
    lineColor: BORDE,
    lineWidth: 0.5,
    cellPadding: { horizontal: 6, vertical: 4 },
    overflow: 'linebreak',
  },
  headStyles: { fillColor: AZUL, textColor: BLANCO, fontStyle: 'bold' },
  footStyles: { fillColor: GRIS_CLARO, textColor: TINTA, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: GRIS_CLARO },
  showHead: 'everyPage',
  showFoot: 'lastPage',
  tableWidth: anchoUtil(doc),
})

/** Bloque con título en barra azul y filas "Etiqueta: valor". Devuelve la Y final. */
function bloqueInfo(
  doc: jsPDF,
  y: number,
  titulo: string,
  filas: FilaInfo[],
  pos: { izquierda?: number; ancho?: number } = {},
) {
  const izquierda = pos.izquierda ?? MARGEN
  const ancho = pos.ancho ?? anchoUtil(doc)
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    margin: { top: Y_CONTENIDO, bottom: MARGEN_INFERIOR, left: izquierda, right: anchoPagina(doc) - izquierda - ancho },
    tableWidth: ancho,
    tableLineColor: BORDE,
    tableLineWidth: 0.5,
    head: [[{ content: titulo, colSpan: 2 }]],
    body: filas.map(([e, v]) => [`${e}:`, v || '—']),
    styles: { font: 'helvetica', fontSize: 9, textColor: TINTA, cellPadding: { horizontal: 8, vertical: 2.5 }, overflow: 'linebreak' },
    headStyles: { fillColor: AZUL, textColor: BLANCO, fontStyle: 'bold', cellPadding: { horizontal: 8, vertical: 5 } },
    columnStyles: { 0: { cellWidth: Math.min(100, ancho * 0.38), fontStyle: 'bold', fontSize: 8, textColor: GRIS } },
  })
  return finalY(doc)
}

function tabla(doc: jsPDF, y: number, opciones: Omit<UserOptions, 'startY'>) {
  autoTable(doc, { ...baseTabla(doc, y), didParseCell: estiloCifras, ...opciones })
  return finalY(doc)
}

/** Filas de abonos anulados en gris (se listan, pero no suman). */
function marcarAnulados(abonos: AbonoPoliza[]) {
  return (d: CellHookData) => {
    estiloCifras(d)
    if (d.section === 'body' && abonos[d.row.index] && esAnulado(abonos[d.row.index])) {
      d.cell.styles.textColor = ANULADO
      d.cell.styles.fontStyle = 'italic'
    }
  }
}

function pieGenerado(doc: jsPDF, y: number) {
  return texto(doc, `Generado el ${fmtFechaHora(new Date())}`, y + 6, 'pequeno')
}

// ── Estado de cuenta por póliza ─────────────────────────────────────────────

export function pdfEstadoCuentaPoliza({
  abonos,
  info,
  prima,
  logo,
}: {
  abonos: AbonoPoliza[]
  /** Filas de "Información de la póliza". */
  info: FilaInfo[]
  prima: number
  logo: LogoPdf | null
}): jsPDF {
  const doc = nuevoDocumento()
  const t = calcularTotales(abonos)
  const saldo = calcularSaldo(prima, t.totalAbonado)

  let y = Y_CONTENIDO
  divisor(doc, y)
  y = texto(doc, 'ESTADO DE CUENTA – PÓLIZA', y + 8, 'h1') + 10
  if (info.length) y = bloqueInfo(doc, y, 'INFORMACIÓN DE LA PÓLIZA', info) + 12

  y = texto(doc, 'RESUMEN DE CUENTA', y, 'h2') + 6
  y = tabla(doc, y, {
    alternateRowStyles: {},
    head: [['Prima total', 'Total abonado', etiquetaSaldo(saldo), 'Total comisión']],
    body: [[dinero(prima), dinero(t.totalAbonado), dinero(Math.abs(saldo)), dinero(t.totalComision)]],
  }) + 16

  y = texto(doc, 'HISTORIAL DE PAGOS', y, 'h2') + 6
  y = tabla(doc, y, {
    head: [['Fecha', 'Reporte #', 'Abono', 'Comisión', '% Com', 'Estado']],
    body: abonos.map((a) => [
      fecha(a.fecha_pago) || '—',
      a.idrep_pago != null ? `#${a.idrep_pago}` : '—',
      dinero(a.vlrabono_prima),
      dinero(comisionAbono(a)),
      fmtPct1(a.porccomision),
      etiquetaEstadoPago(a.estado_pago),
    ]),
    foot: [['TOTALES', '', dinero(t.totalAbonado), dinero(t.totalComision), '', '']],
    columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 60 }, 4: { cellWidth: 50, halign: 'right' }, 5: { cellWidth: 75 } },
    didParseCell: marcarAnulados(abonos),
  })
  pieGenerado(doc, y)

  encabezadosYPies(doc, logo)
  return doc
}

// ── Estado de cuenta por reporte ────────────────────────────────────────────

/** Filas de "Información del reporte" (pantalla y PDF). */
export function filasInfoReporte(r: ReportePago): FilaInfo[] {
  const filas: FilaInfo[] = [
    ['Reporte #', String(r.id)],
    ['Fecha', fecha(r.fecha_rep)],
    ['Aseguradora', r.nombre_aseg ?? '—'],
    ['Intermediario', r.nombre_interm ?? '—'],
  ]
  if (r.fini_rep && r.ffin_rep) filas.push(['Período', `${fecha(r.fini_rep)} – ${fecha(r.ffin_rep)}`])
  filas.push(['Estado', etiquetaEstadoPago(r.estado_rep)])
  return filas
}

export function pdfEstadoCuentaReporte({
  abonos,
  reporte,
  idReporte,
  logo,
}: {
  abonos: AbonoPoliza[]
  reporte: ReportePago | null
  idReporte: number
  logo: LogoPdf | null
}): jsPDF {
  const doc = nuevoDocumento()
  const t = calcularTotales(abonos)

  let y = Y_CONTENIDO
  divisor(doc, y)
  y = texto(doc, `ESTADO DE CUENTA – REPORTE #${reporte?.id ?? idReporte}`, y + 8, 'h1') + 10
  if (reporte) y = bloqueInfo(doc, y, 'INFORMACIÓN DEL REPORTE', filasInfoReporte(reporte)) + 12

  y = texto(doc, 'RESUMEN', y, 'h2') + 6
  y = tabla(doc, y, {
    alternateRowStyles: {},
    head: [['N° pólizas', 'Total abonado', 'Total comisión']],
    body: [[String(t.numAbonos), dinero(t.totalAbonado), dinero(t.totalComision)]],
  }) + 16

  y = texto(doc, 'DETALLE POR PÓLIZA', y, 'h2') + 6
  y = tabla(doc, y, {
    head: [['N° póliza', 'Cliente', 'Ramo / Producto', 'Abono', 'Comisión', 'Estado']],
    body: abonos.map((a) => [
      a.nro_poliza ?? String(a.id_poliza),
      a.nombre_cliente ?? '—',
      `${a.nombre_ramo ?? '—'}${a.nombre_prod ? ` / ${a.nombre_prod}` : ''}`,
      dinero(a.vlrabono_prima),
      dinero(comisionAbono(a)),
      etiquetaEstadoPago(a.estado_pago),
    ]),
    foot: [['TOTALES', '', '', dinero(t.totalAbonado), dinero(t.totalComision), '']],
    columnStyles: { 0: { cellWidth: 75 }, 3: { cellWidth: 80 }, 4: { cellWidth: 75 }, 5: { cellWidth: 58 } },
    didParseCell: marcarAnulados(abonos),
  })
  pieGenerado(doc, y)

  encabezadosYPies(doc, logo)
  return doc
}

// ── Comprobante de pago de un abono ─────────────────────────────────────────

/** Filas "Datos del cliente" del comprobante. */
export function filasClienteComprobante(a: AbonoPoliza): FilaInfo[] {
  return [
    ['Cliente', a.nombre_cliente ?? '—'],
    ['Documento', `${a.tipodoc_cliente ?? ''} ${a.doc_cliente ? fmtDoc(a.doc_cliente) : '—'}`.trim()],
    ['Teléfono', a.tel_cliente ?? '—'],
    ['Correo', a.correo_cliente ?? '—'],
    ['Dirección', a.dir_cliente ?? '—'],
  ]
}

/** Filas "Datos de la póliza" del comprobante. */
export function filasPolizaComprobante(a: AbonoPoliza): FilaInfo[] {
  const filas: FilaInfo[] = [
    ['N° póliza', a.nro_poliza ?? String(a.id_poliza)],
    ['Aseguradora', a.nombre_aseg ?? '—'],
    ['Ramo', a.nombre_ramo ?? '—'],
    ['Producto', a.nombre_prod ?? '—'],
    ['Bien asegurado', a.bien_asegurado ?? '—'],
  ]
  if (a.fini_poliza && a.ffin_poliza) filas.push(['Vigencia', `${fecha(a.fini_poliza)} – ${fecha(a.ffin_poliza)}`])
  return filas
}

/** Filas de la tabla "Detalle del pago": [concepto, prima póliza, abono/comisión]. */
export function filasDetalleComprobante(a: AbonoPoliza): { filas: string[][]; total: string[] } {
  const filas: string[][] = [['Prima de póliza', dinero(a.vlrprima_poliza), dinero(a.vlrabono_prima)]]
  if ((a.porccomision ?? 0) > 0) filas.push([`Comisión (${fmtPct1(a.porccomision)})`, '', dinero(a.vlrcomision)])
  if ((a.porccomad ?? 0) > 0) filas.push([`Com. adicional (${fmtPct1(a.porccomad)})`, '', dinero(a.vlrcomad)])
  return { filas, total: ['TOTAL COMISIÓN', '', dinero(comisionAbono(a))] }
}

function pastilla(doc: jsPDF, x: number, y: number, etiqueta: string, valor: string, color: RGB) {
  const mezcla = (f: number): RGB => color.map((c) => Math.round(255 - (255 - c) * f)) as RGB
  const t = `${etiqueta}: ${valor}`
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  const w = doc.getTextWidth(t) + 16
  doc.setFillColor(...mezcla(0.12))
  doc.setDrawColor(...mezcla(0.4))
  doc.setLineWidth(0.5)
  doc.roundedRect(x, y, w, 16, 8, 8, 'FD')
  doc.setTextColor(...color)
  doc.text(t, x + 8, y + 11)
  doc.setTextColor(...TINTA)
  return x + w + 8
}

export function pdfComprobante({ abono: a, logo }: { abono: AbonoPoliza; logo: LogoPdf | null }): jsPDF {
  const doc = nuevoDocumento()
  const ancho = anchoUtil(doc)
  let y = Y_CONTENIDO
  divisor(doc, y)
  y += 8

  // Título a la izquierda; número y fecha en recuadro azul a la derecha.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...AZUL)
  doc.text('COMPROBANTE DE PAGO', MARGEN, y + 20)
  const lineas = [...(a.num_factura ? [`N° ${a.num_factura}`] : []), fecha(a.fecha_pago) || '—']
  doc.setFontSize(11)
  const wCaja = Math.max(...lineas.map((l) => doc.getTextWidth(l))) + 24
  const hCaja = 12 + lineas.length * 13
  const xCaja = anchoPagina(doc) - MARGEN - wCaja
  doc.setFillColor(...AZUL)
  doc.roundedRect(xCaja, y, wCaja, hCaja, 6, 6, 'F')
  doc.setTextColor(...BLANCO)
  lineas.forEach((l, i) => {
    const esNumero = !!a.num_factura && i === 0
    doc.setFont('helvetica', esNumero ? 'bold' : 'normal')
    doc.setFontSize(esNumero ? 11 : 9)
    doc.text(l, xCaja + wCaja - 12, y + 16 + i * 13, { align: 'right' })
  })
  doc.setTextColor(...TINTA)
  y += Math.max(hCaja, 28) + 16

  // Cliente y póliza en dos columnas.
  const col = (ancho - 12) / 2
  const paginaInicio = doc.getCurrentPageInfo().pageNumber
  const y1 = bloqueInfo(doc, y, 'DATOS DEL CLIENTE', filasClienteComprobante(a), { izquierda: MARGEN, ancho: col })
  const paginaCliente = doc.getNumberOfPages()
  doc.setPage(paginaInicio)
  const y2 = bloqueInfo(doc, y, 'DATOS DE LA PÓLIZA', filasPolizaComprobante(a), { izquierda: MARGEN + col + 12, ancho: col })
  doc.setPage(Math.max(paginaCliente, doc.getNumberOfPages()))
  y = Math.max(y1, y2) + 16

  y = texto(doc, 'DETALLE DEL PAGO', y, 'h2') + 6
  const det = filasDetalleComprobante(a)
  y = tabla(doc, y, {
    alternateRowStyles: {},
    head: [['Concepto', 'Vlr. prima póliza', 'Abono / comisión']],
    body: det.filas,
    foot: [det.total],
    columnStyles: { 0: { cellWidth: ancho * (3 / 7) } },
  }) + 14

  if (y + 16 > altoPagina(doc) - MARGEN_INFERIOR) {
    doc.addPage()
    y = Y_CONTENIDO
  }
  let x = pastilla(doc, MARGEN, y, 'Estado', etiquetaEstadoPago(a.estado_pago), AZUL)
  if (a.idrep_pago != null) x = pastilla(doc, x, y, 'Reporte', `#${a.idrep_pago}`, VERDE)
  if (a.num_factura) pastilla(doc, x, y, 'Factura', a.num_factura, GRIS)
  y += 24

  if (a.obs_pago?.trim()) {
    y = texto(doc, 'Observaciones:', y, 'negrita')
    y = texto(doc, a.obs_pago, y, 'cuerpo') + 8
  }

  divisor(doc, y)
  y += 6
  if (a.apodo_usuario) {
    const creado = fmtFechaHora(aFechaHora(a.fcreado))
    texto(doc, `Registrado por: ${a.apodo_usuario}${creado ? `  –  ${creado}` : ''}`, y, 'pequeno')
  }

  encabezadosYPies(doc, logo)
  return doc
}

// ── Salida ──────────────────────────────────────────────────────────────────

/** Descarga el PDF con un nombre de archivo saneado. */
export function descargarPdf(doc: jsPDF, nombreBase: string) {
  doc.save(nombreArchivoPdf(nombreBase))
}

/**
 * Abre el PDF en una pestaña con el diálogo de impresión. `ventana` debe
 * abrirse en el mismo clic (antes de cualquier espera) para que el navegador
 * no la bloquee; si no se pudo, se abre aquí y, si tampoco, se descarga.
 */
export function abrirPdfParaImprimir(doc: jsPDF, nombreBase: string, ventana?: Window | null) {
  doc.setProperties({ title: nombreBase })
  doc.autoPrint()
  const url = String(doc.output('bloburl'))
  const destino = ventana ?? window.open(url, '_blank')
  if (!destino) {
    descargarPdf(doc, nombreBase)
    return false
  }
  if (ventana) ventana.location.href = url
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000)
  return true
}

// ── Información de la póliza (pantalla y PDF) ───────────────────────────────

/** Campos comunes a la póliza (vw_polizas_busqueda) y al abono (vw_abonos_detalle). */
export interface DatosPolizaInfo {
  nro_poliza: string | null
  nombre_cliente: string | null
  nombre_aseg: string | null
  nombre_ramo: string | null
  nombre_prod: string | null
  bien_asegurado: string | null
  fini_poliza: string | null
  ffin_poliza: string | null
}

export function filasInfoPoliza(p: DatosPolizaInfo, idPoliza: number, prima?: number | null): FilaInfo[] {
  const filas: FilaInfo[] = [
    ['N° póliza', p.nro_poliza ?? String(idPoliza)],
    ['Cliente', p.nombre_cliente ?? '—'],
    ['Aseguradora', p.nombre_aseg ?? '—'],
    ['Ramo', p.nombre_ramo ?? '—'],
    ['Producto', p.nombre_prod ?? '—'],
    ['Bien asegurado', p.bien_asegurado ?? '—'],
  ]
  if (p.fini_poliza && p.ffin_poliza) filas.push(['Vigencia', `${fecha(p.fini_poliza)} – ${fecha(p.ffin_poliza)}`])
  if (prima !== undefined) filas.push(['Prima total', dinero(prima)])
  return filas
}
