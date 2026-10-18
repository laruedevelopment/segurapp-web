import { aFecha, aFechaHora, fmtFecha, fmtFechaHora } from '@/lib/fechas'
import { fmtDinero } from '@/lib/numeros'

/** Una línea del detalle: etiqueta y valor ya formateado. */
export interface EntradaDetalle {
  clave: string
  etiqueta: string
  valor: string
}

type Tipo = 'texto' | 'dinero' | 'fecha' | 'fechahora' | 'porcentaje'

// Campos conocidos, en el orden en que se muestran. Sirve tanto para lo que
// lee la IA o guarda un borrador como para las columnas de la tabla polizas.
const CAMPOS: [string, string, Tipo?][] = [
  ['nro_poliza', 'N.º de póliza'],
  ['nombre_cliente', 'Cliente'],
  ['doc_cliente', 'Documento del cliente'],
  ['tipodoc_cliente', 'Tipo de documento'],
  ['tel_cliente', 'Teléfono del cliente'],
  ['nombre_asegurado', 'Asegurado'],
  ['doc_asegurado', 'Documento del asegurado'],
  ['nombre_beneficiario', 'Beneficiario'],
  ['doc_beneficiario', 'Documento del beneficiario'],
  ['nombre_aseguradora', 'Aseguradora'],
  ['nombre_aseg', 'Aseguradora'],
  ['nombre_ramo', 'Ramo'],
  ['nombre_producto', 'Producto'],
  ['nombre_prod', 'Producto'],
  ['nombre_asesor', 'Asesor'],
  ['nombre_forma_pago', 'Forma de pago'],
  ['nombre_formaexp', 'Forma de expedición'],
  ['nombre_interm', 'Intermediario'],
  ['fecha_inicio', 'Inicio de vigencia', 'fecha'],
  ['fini_poliza', 'Inicio de vigencia', 'fecha'],
  ['fecha_fin', 'Fin de vigencia', 'fecha'],
  ['ffin_poliza', 'Fin de vigencia', 'fecha'],
  ['fecha_expedicion', 'Fecha de expedición', 'fecha'],
  ['fexp_poliza', 'Fecha de expedición', 'fecha'],
  ['prima', 'Prima', 'dinero'],
  ['prima_poliza', 'Prima', 'dinero'],
  ['valor_poliza', 'Valor total', 'dinero'],
  ['valor_asegurado', 'Valor asegurado', 'dinero'],
  ['vlraseg_poliza', 'Valor asegurado', 'dinero'],
  ['vlrprimapagada_poliza', 'Prima pagada', 'dinero'],
  ['porccom_poliza', 'Comisión (%)', 'porcentaje'],
  ['vlrcom_poliza', 'Valor de la comisión', 'dinero'],
  ['bien_asegurado', 'Bien asegurado'],
  ['obs_poliza', 'Observaciones'],
  ['observaciones', 'Observaciones'],
  ['nombre_usuario', 'Usuario'],
  ['apodo_usuario', 'Usuario'],
  ['fcreado', 'Creada', 'fechahora'],
  ['fultmod', 'Última modificación', 'fechahora'],
  ['aviso_lectura', 'Aviso de la lectura'],
  ['nombre_archivo', 'Archivo'],
  ['error_msg', 'Error de lectura'],
]

const OCULTOS = new Set(['id', 'eliminada_en', 'estado_por_pagos'])

const humanizar = (clave: string) => {
  const t = clave.replace(/_/g, ' ').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function formatear(v: unknown, tipo: Tipo): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v === 'object') return JSON.stringify(v)
  const num = typeof v === 'number' ? v : Number(v)
  switch (tipo) {
    case 'dinero':
      return Number.isFinite(num) ? fmtDinero(num) : String(v)
    case 'porcentaje':
      return Number.isFinite(num) ? `${num} %` : String(v)
    case 'fecha':
      return fmtFecha(aFecha(String(v))) || String(v)
    case 'fechahora':
      return fmtFechaHora(aFechaHora(String(v))) || String(v)
    default:
      return String(v)
  }
}

/**
 * Convierte el contenido de una póliza (datos de un borrador, lectura de la IA
 * o fila de la tabla) en líneas legibles: primero los campos conocidos, luego el
 * resto con su nombre "humanizado". Omite lo vacío, los ids y los campos técnicos.
 */
export function entradasDetalle(datos: Record<string, unknown>): EntradaDetalle[] {
  const salida: EntradaDetalle[] = []
  const usadas = new Set<string>()
  const etiquetasPuestas = new Set<string>()
  for (const [clave, etiqueta, tipo = 'texto'] of CAMPOS) {
    if (!(clave in datos)) continue
    usadas.add(clave)
    const valor = formatear(datos[clave], tipo)
    // Si ya salió esa etiqueta (p. ej. nombre_aseg y nombre_aseguradora), no se repite.
    if (valor == null || etiquetasPuestas.has(etiqueta)) continue
    etiquetasPuestas.add(etiqueta)
    salida.push({ clave, etiqueta, valor })
  }
  for (const [clave, v] of Object.entries(datos)) {
    if (usadas.has(clave) || OCULTOS.has(clave) || clave.endsWith('_id')) continue
    const valor = formatear(v, 'texto')
    if (valor == null) continue
    salida.push({ clave, etiqueta: humanizar(clave), valor })
  }
  return salida
}
