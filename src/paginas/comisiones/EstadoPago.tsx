import { Etiqueta } from '@/components/ui/basicos'
import { etiquetaEstadoPago } from '@/datos/pagos'

const TONO_ESTADO: Record<string, 'verde' | 'navy' | 'alerta' | 'peligro'> = {
  C: 'verde',
  R: 'navy',
  I: 'alerta',
  V: 'peligro',
}

export function EstadoPago({ estado }: { estado: string }) {
  return <Etiqueta tono={TONO_ESTADO[estado] ?? 'neutro'}>{etiquetaEstadoPago(estado)}</Etiqueta>
}
