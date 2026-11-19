// Prellenado de un SOAT nuevo a partir de la póliza del vehículo.

import type { Producto, Ramo } from '@/lib/tipos'
import { extraerPlaca } from '@/lib/placa'
import { aFecha } from '@/lib/fechas'
import type { EstadoForm } from './logica'

/**
 * Devuelve el formulario con el SOAT del vehículo: mismo cliente y asesor, ramo SOAT, producto
 * "REC SOAT" (el de los recordatorios) y la placa como bien. Si el ramo o el producto no existen
 * en el catálogo devuelve null.
 */
export function prellenarSoat(
  base: EstadoForm,
  vehiculo: Pick<EstadoForm, 'cliente' | 'bien' | 'asesor1Id' | 'porcAsesor1' | 'intermediarioId'>,
  finIso: string | null,
  ramos: Ramo[],
  productos: Producto[],
): EstadoForm | null {
  const ramo = ramos.find((r) => r.estado_ramo && r.nombre_ramo.trim().toUpperCase() === 'SOAT')
  if (!ramo) return null
  const delRamo = productos.filter((p) => p.estado_prod && p.ramo_id === ramo.id)
  const producto = delRamo.find((p) => /rec\s*soat/i.test(p.nombre_prod)) ?? delRamo[0]
  if (!producto) return null
  const fFin = aFecha(finIso)
  return {
    ...base,
    cliente: vehiculo.cliente,
    bien: extraerPlaca(vehiculo.bien) ?? vehiculo.bien.trim(),
    ramoId: ramo.id,
    productoId: producto.id,
    asegId: producto.aseguradora_id,
    asesor1Id: vehiculo.asesor1Id ?? base.asesor1Id,
    porcAsesor1: vehiculo.asesor1Id != null ? vehiculo.porcAsesor1 : base.porcAsesor1,
    intermediarioId: vehiculo.intermediarioId ?? base.intermediarioId,
    fFin,
    finAutomatica: false,
  }
}
