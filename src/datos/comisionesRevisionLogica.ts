// Lógica pura (sin red) de las advertencias de comisiones sin sentido.

// Advertencias (no bloquean nada) sobre comisiones que no tienen lógica: un % de comisión
// por encima de 100 o una comisión mayor que la prima. Sirve para que el personal revise
// y corrija a mano; la app no cambia ningún dato por su cuenta.

/** Una comisión no puede ser más del 100 % de la base. */
export const PORC_COMISION_MAXIMO = 100

export function advertenciaComision(a: { porcCom: number | null; vlrCom: number | null; prima: number | null }): string | null {
  const porc = a.porcCom ?? 0
  if (porc > PORC_COMISION_MAXIMO || porc < 0) {
    return `El % de comisión (${porc.toLocaleString('es-CO')} %) no tiene lógica: no puede ser menor que 0 ni mayor que 100. Revise el % del producto en Catálogos o corríjalo en esta póliza.`
  }
  if ((a.prima ?? 0) > 0 && (a.vlrCom ?? 0) > (a.prima ?? 0)) {
    return 'La comisión es mayor que la prima. Revise el % de comisión y la base de comisión.'
  }
  return null
}

