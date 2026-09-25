// Cálculos del estado de cuenta (por reporte y por póliza). Misma lógica que
// lib/ui/pagina_estado_cuenta.dart y lib/utils/generador_pdf.dart de la app
// Flutter. Es plata: sumas exactas en centavos y los abonos anulados no suman.

import { fmtNum, sumarDinero } from '@/lib/numeros'

/** Campos de un abono que intervienen en los totales. */
export interface AbonoMontos {
  estado_pago: string | null
  vlrabono_prima: number | null
  vlrcomision: number | null
  vlrcomad: number | null
}

/** Estado de pago de un abono anulado: se muestra pero no suma. */
export const ESTADO_ANULADO = 'A'

export const esAnulado = (a: { estado_pago: string | null }) => a.estado_pago === ESTADO_ANULADO

/** Abonos que cuentan para los totales (todos menos los anulados, igual que en la base). */
export const abonosVigentes = <T extends AbonoMontos>(abonos: readonly T[]): T[] => abonos.filter((a) => !esAnulado(a))

export interface TotalesEstadoCuenta {
  /** Suma de vlrabono_prima de los abonos vigentes. */
  totalAbonado: number
  /** Suma de vlrcomision de los abonos vigentes. */
  totalComisionBase: number
  /** Suma de vlrcomad de los abonos vigentes. */
  totalComisionAdicional: number
  /** Comisión + comisión adicional. */
  totalComision: number
  /** Número de abonos listados (incluye anulados, como en Flutter). */
  numAbonos: number
}

export function calcularTotales(abonos: readonly AbonoMontos[]): TotalesEstadoCuenta {
  const vig = abonosVigentes(abonos)
  const totalComisionBase = sumarDinero(vig.map((a) => a.vlrcomision))
  const totalComisionAdicional = sumarDinero(vig.map((a) => a.vlrcomad))
  return {
    totalAbonado: sumarDinero(vig.map((a) => a.vlrabono_prima)),
    totalComisionBase,
    totalComisionAdicional,
    totalComision: sumarDinero(vig.flatMap((a) => [a.vlrcomision, a.vlrcomad])),
    numAbonos: abonos.length,
  }
}

/** Comisión total de un abono (comisión + adicional), exacta. */
export const comisionAbono = (a: Pick<AbonoMontos, 'vlrcomision' | 'vlrcomad'>) => sumarDinero([a.vlrcomision, a.vlrcomad])

/** Saldo de la póliza: prima − abonado. Negativo = se pagó de más (saldo a favor). */
export const calcularSaldo = (prima: number | null | undefined, totalAbonado: number) =>
  sumarDinero([prima ?? 0, -totalAbonado])

/** % pagado real, sin tope en 100 %: si se pagó de más, se tiene que ver. */
export const calcularPorcPagado = (prima: number | null | undefined, totalAbonado: number) =>
  prima != null && prima > 0 ? (totalAbonado / prima) * 100 : 0

/** "Saldo a favor" si es negativo; si no, "Saldo pendiente". */
export const etiquetaSaldo = (saldo: number) => (saldo < 0 ? 'Saldo a favor' : 'Saldo pendiente')

/** % con un decimal fijo en formato colombiano: 112.5 → "112,5%". */
export const fmtPct1 = (n: number | null | undefined) => `${fmtNum(n ?? 0, 1)}%`

/**
 * Nombre de archivo seguro para el PDF: solo letras, dígitos, "_" y "-"
 * (lo demás pasa a "_"), con la extensión .pdf.
 */
export function nombreArchivoPdf(base: string): string {
  const limpio = base.replace(/[^0-9A-Za-z_-]/g, '_') || 'documento'
  return `${limpio}.pdf`
}
