// Texto de la confirmación al mover un abono a otra póliza ("Cambiar póliza"
// del diálogo de abono). Réplica de pagina_formulario_reporte.dart de Flutter.

import { fmtDinero } from '@/lib/numeros'

interface PolizaRef {
  id: number
  nro: string | null | undefined
}

export function textoMoverPago({
  valorAbono,
  desde,
  hacia,
}: {
  valorAbono: number
  desde: PolizaRef
  hacia: PolizaRef
}): string {
  return (
    `El pago de ${fmtDinero(valorAbono)} pasa de la póliza ${desde.nro ?? desde.id} (cód. ${desde.id}) ` +
    `a la póliza ${hacia.nro ?? hacia.id} (cód. ${hacia.id}).\n\n` +
    'Lo pagado y el estado de las dos pólizas se recalculan solos. ¿Continuar?'
  )
}
