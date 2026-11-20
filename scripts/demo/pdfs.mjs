// Crea los dos PDF ficticios que se "suben" en el video (la lectura con IA es simulada: el contenido
// no se lee, pero así el archivo se ve real si alguien lo abre).
import { jsPDF } from 'jspdf'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function pdf(titulo, lineas) {
  const d = new jsPDF({ unit: 'pt', format: 'a4' })
  d.setFont('helvetica', 'bold').setFontSize(18).text(titulo, 48, 70)
  d.setFont('helvetica', 'normal').setFontSize(11)
  lineas.forEach((l, i) => d.text(l, 48, 110 + i * 20))
  d.setFontSize(9).text('Documento ficticio generado para la demostración de SegurApp.', 48, 800)
  return Buffer.from(d.output('arraybuffer'))
}

export function crearPdfs(carpeta) {
  mkdirSync(carpeta, { recursive: true })
  const poliza = join(carpeta, 'Poliza_SURA_Autos_Todo_Riesgo.pdf')
  const reporte = join(carpeta, 'Reporte_Comisiones_SURA_Octubre.pdf')
  writeFileSync(poliza, pdf('SURA - Póliza Autos Todo Riesgo', [
    'Póliza No. 3001-4412099-0', 'Tomador: MARÍA FERNANDA GÓMEZ RUIZ   C.C. 63456789', 'Vehículo: Mazda 3 - Placa GHT581',
    'Vigencia: un año desde la fecha de expedición', 'Prima: $ 2.380.000   Total: $ 2.832.200', 'Valor asegurado: $ 62.000.000',
  ]))
  writeFileSync(reporte, pdf('SURA - Reporte de comisiones', [
    'Intermediario: 31022 - AGENCIA DEMO ASESORES', 'Período: último mes', 'Pólizas con pago aplicado: 4',
    'Total prima y total comisión según el detalle adjunto.',
  ]))
  return { poliza, reporte }
}
