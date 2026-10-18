import { db } from '@/lib/supabase'

// Lectura de documentos con IA (Gemini) a través de las Edge Functions
// `extraer-poliza` y `extraer-reporte-pago`. Exigen sesión iniciada.

/** Tamaño máximo que acepta el servidor. */
export const MAX_BYTES_ARCHIVO = 15 * 1024 * 1024

export interface ReportePagoExtraido {
  cabecera: Record<string, unknown>
  lineas: Record<string, unknown>[]
}

async function aBase64(archivo: Blob): Promise<string> {
  const buf = new Uint8Array(await archivo.arrayBuffer())
  let bin = ''
  const paso = 0x8000
  for (let i = 0; i < buf.length; i += paso) bin += String.fromCharCode(...buf.subarray(i, i + paso))
  return btoa(bin)
}

/** Tipo MIME del archivo; si el navegador no lo sabe, se deduce de la extensión. */
export function tipoArchivo(archivo: File): string {
  if (archivo.type) return archivo.type
  const ext = archivo.name.split('.').pop()?.toLowerCase()
  return (
    {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      csv: 'text/csv',
    }[ext ?? ''] ?? 'application/octet-stream'
  )
}

async function invocar(funcion: string, archivo: File, extra?: Record<string, unknown>): Promise<unknown> {
  if (archivo.size > MAX_BYTES_ARCHIVO) {
    throw new Error('El archivo pesa más de 15 MB. Redúzcalo o divídalo e intente de nuevo.')
  }
  const control = new AbortController()
  // El servidor corta a los 150 s; un poco más de margen acá.
  const t = setTimeout(() => control.abort(), 170_000)
  try {
    const { data, error } = await db.functions.invoke(funcion, {
      body: { fileBase64: await aBase64(archivo), mimeType: tipoArchivo(archivo), ...extra },
      signal: control.signal,
    })
    if (error) {
      const ctx = (error as { context?: Response }).context
      // Sin respuesta del servidor: no hubo conexión con el servicio.
      if (!ctx) throw new Error('No se pudo conectar con el servicio. Verifique su conexión a internet.')
      let mensaje: string | undefined
      if (ctx && typeof ctx.json === 'function') {
        try {
          mensaje = (await ctx.json())?.error
        } catch {
          /* sin JSON */
        }
      }
      // Sin mensaje del servidor (502/503/504 del gateway): el código sirve
      // para decidir si se reintenta.
      throw new Error(
        mensaje ?? `No se pudo leer el documento${ctx?.status ? ` (${ctx.status})` : ''}. Intente de nuevo.`,
      )
    }
    return data
  } catch (e) {
    if (control.signal.aborted) throw new Error('La lectura del documento tardó demasiado. Intente de nuevo.')
    throw e
  } finally {
    clearTimeout(t)
  }
}

/**
 * Lee una póliza (PDF o imagen). [catalogoProductos] (aseguradora + ramo +
 * producto existentes) ayuda a la IA a escoger combinaciones reales.
 */
export async function extraerPoliza(
  archivo: File,
  catalogoProductos?: { aseguradora: string; ramo: string; producto: string }[],
): Promise<Record<string, unknown>> {
  const data = await invocar('extraer-poliza', archivo, catalogoProductos ? { catalogoProductos } : undefined)
  return (data ?? {}) as Record<string, unknown>
}

/** Lee un reporte de comisiones: cabecera (aseguradora, fechas, totales) y una línea por póliza. */
export async function extraerReportePago(archivo: File): Promise<ReportePagoExtraido> {
  const data = (await invocar('extraer-reporte-pago', archivo)) as Partial<ReportePagoExtraido> | null
  return { cabecera: data?.cabecera ?? {}, lineas: data?.lineas ?? [] }
}
