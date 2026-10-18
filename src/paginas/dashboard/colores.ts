// Paleta y escala de ejes del dashboard (dashboard_widgets.dart en Flutter).

const registro = new Map<string, number>()

/**
 * Paleta categórica de 8 tonos en orden fijo. El color sigue a la ENTIDAD, no a
 * su posición: "Sura" conserva su color aunque un filtro cambie el ranking.
 * Pasado el 8.º se usa gris ("Otros").
 */
export const DashColors = {
  serie: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  otros: '#9aa5b1',
  real: '#1c4870',
  comparacion: '#a9b4bf',
  bueno: '#1e9b4e',
  alerta: '#b7791b',
  malo: '#a6402c',
  inkSoft: '#5b6675',
  linea: '#d7dee5',
  /** Rampa secuencial de un solo tono (navy), de claro a oscuro. */
  secuencial(t: number): string {
    const k = Math.min(1, Math.max(0, t))
    const a = [0xe3, 0xeb, 0xf3]
    const b = [0x12, 0x35, 0x53]
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * k))
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
  },
  /** Color fijo de una entidad: el n-ésimo nombre que se ve recibe el n-ésimo tono. */
  de(nombre: string): string {
    let i = registro.get(nombre)
    if (i === undefined) {
      i = registro.size
      registro.set(nombre, i)
    }
    return i < DashColors.serie.length ? DashColors.serie[i] : DashColors.otros
  },
}

/** Techo "redondo" para el eje (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10 × potencia de 10). */
export function techoEje(maxV: number): number {
  if (maxV <= 0) return 1
  const e = Math.pow(10, Math.floor(Math.log10(maxV)))
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (m * e >= maxV * 1.05) return m * e
  }
  return 10 * e
}
