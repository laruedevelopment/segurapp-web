// Cruce de las líneas de un reporte de comisiones contra las pólizas de la
// base. Port exacto de lib/datos/matching_reporte_pago.dart (con las mismas
// pruebas en matching.test.ts). Solo 'exacta' y 'unicaSinAnexo' se
// consideran suficientemente seguras para incluirse solas; todo lo demás
// exige que una persona confirme antes de crear el abono — es plata.

/**
 * - exacta: mismo número base y mismo anexo, una sola póliza.
 * - unicaSinAnexo: el reporte no trae anexo (ej. Mundial) y hay una sola
 *   póliza con ese número base.
 * - revisar: hay una póliza asignada pero algo no cuadra (documento
 *   distinto, póliza registrada sin anexo) — asignada pero sin incluir.
 * - ambigua: varias pólizas posibles — hay que elegir una.
 * - anexoNoRegistrado: el número base existe, pero ese anexo no está registrado.
 * - noEncontrada: ninguna póliza con ese número base.
 */
export type EstadoMatch = 'exacta' | 'unicaSinAnexo' | 'revisar' | 'ambigua' | 'anexoNoRegistrado' | 'noEncontrada'

/** Lo mínimo que el matching necesita de una póliza. */
export interface PolizaMatch {
  id: number
  nro_poliza: string | null
  doc_cliente: string | null
  aseg_id: number | null
  prima_poliza: number | null
}

export interface ResultadoMatch<P extends PolizaMatch = PolizaMatch> {
  estado: EstadoMatch
  poliza: P | null
  /**
   * Opciones para elegir rápido (otros anexos del mismo número, o las
   * pólizas del cliente cuando el número no apareció).
   */
  candidatos: P[]
  motivo: string
}

export function crearResultado<P extends PolizaMatch>(
  estado: EstadoMatch,
  { poliza = null, candidatos = [], motivo = '' }: { poliza?: P | null; candidatos?: P[]; motivo?: string } = {},
): ResultadoMatch<P> {
  return { estado, poliza, candidatos, motivo }
}

export const seIncluyeSolo = (r: { estado: EstadoMatch }) => r.estado === 'exacta' || r.estado === 'unicaSinAnexo'

/** Solo letras y dígitos, en mayúscula. */
export const normalizarDoc = (s: string) => s.replace(/[^0-9A-Za-z]/g, '').toUpperCase()

function sinCerosIzq(s: string): string {
  const r = s.replace(/^0+/, '')
  return r === '' && s !== '' ? '0' : r
}

/**
 * Segmentos de un número de póliza ("400-97-994000000046-6" →
 * [400, 97, 994000000046, 6]). Por convención de la app el anexo va
 * siempre como último segmento.
 */
export const segmentosNroPoliza = (nro: string) =>
  nro
    .toUpperCase()
    .split(/[^0-9A-Z]+/)
    .filter((s) => s !== '')

const MIN_LARGO_NUCLEO = 5

/**
 * Si [nroPoliza] corresponde al número base [nucleo] del reporte, devuelve
 * el anexo con el que quedó registrada la póliza ('' si se registró sin
 * anexo). Null si no corresponde. Compara por segmento completo — nunca
 * por "contiene", para que '046' no coincida con '1046' ni con otros anexos.
 */
export function anexoSiCorresponde(nroPoliza: string, nucleo: string, anexoReporte?: string | null): string | null {
  const n = sinCerosIzq(normalizarDoc(nucleo))
  if (n === '') return null
  const segs = segmentosNroPoliza(nroPoliza)
  if (segs.length === 0) return null

  // Un número de reporte muy corto (ej. "97", "400") coincidiría con
  // prefijos de sucursal o producto de pólizas sin relación: solo se acepta
  // si es el número completo.
  if (n.length < MIN_LARGO_NUCLEO) {
    return segs.length === 1 && sinCerosIzq(segs[0]) === n ? '' : null
  }

  for (let i = 0; i < segs.length; i++) {
    // "AUT12345" también corresponde al número 12345.
    const soloDigitos = segs[i].replace(/[A-Z]/g, '')
    if (
      sinCerosIzq(segs[i]) === n ||
      (soloDigitos !== '' && soloDigitos !== segs[i] && sinCerosIzq(soloDigitos) === n)
    ) {
      return i < segs.length - 1 ? sinCerosIzq(segs[segs.length - 1]) : ''
    }
  }

  // Pólizas viejas digitadas sin separadores: "9940000001936" = núcleo +
  // anexo pegados. Ver esNumeroPegado: nunca cuenta como exacta.
  if (segs.length === 1) {
    const todo = sinCerosIzq(segs[0])
    if (todo === n) return ''
    const a = anexoReporte == null ? '' : normalizarDoc(anexoReporte)
    if (a !== '' && (todo === `${n}${a}` || todo === `${n}${sinCerosIzq(a)}`)) {
      return sinCerosIzq(a)
    }
  }
  return null
}

/**
 * La póliza está registrada como un solo bloque de dígitos que contiene el
 * número del reporte más el anexo pegado. Puede ser otra póliza distinta
 * que casualmente empieza igual, así que se manda a revisar.
 */
function esNumeroPegado(nroPoliza: string, nucleo: string): boolean {
  const segs = segmentosNroPoliza(nroPoliza)
  return segs.length === 1 && sinCerosIzq(segs[0]) !== sinCerosIzq(normalizarDoc(nucleo))
}

/**
 * Mismo documento, tolerando que uno traiga el dígito de verificación del
 * NIT y el otro no ("900159756" vs "9001597561" guardado como "900159756-1").
 */
export function mismoDocumento(a: string, b: string): boolean {
  const x = normalizarDoc(a)
  const y = normalizarDoc(b)
  if (x === '' || y === '') return false
  if (x === y) return true
  const [corto, largo] = x.length < y.length ? [x, y] : [y, x]
  return largo.length === corto.length + 1 && largo.startsWith(corto) && corto.length >= 6 && /^\d+$/.test(largo)
}

/**
 * Decide a qué póliza corresponde una línea del reporte.
 *
 * [candidatos]: pólizas traídas de la base que podrían corresponder (por
 * número y/o por documento del cliente) — acá se filtran con precisión.
 * [polizasDelCliente]: las del cliente encontrado por documento, solo para
 * ofrecerlas como sugerencia si el número no aparece.
 */
export function resolverMatch<P extends PolizaMatch>({
  nucleo,
  anexo,
  docCliente,
  aseguradoraId,
  primaLinea,
  candidatos,
  polizasDelCliente = [],
}: {
  nucleo: string
  anexo?: string | null
  docCliente?: string | null
  aseguradoraId?: number | null
  primaLinea?: number | null
  candidatos: P[]
  polizasDelCliente?: P[]
}): ResultadoMatch<P> {
  const anexoRep = anexo == null || normalizarDoc(anexo) === '' ? null : sinCerosIzq(normalizarDoc(anexo))
  const doc = docCliente == null ? '' : normalizarDoc(docCliente)

  // Número base + anexo con el que está registrada cada póliza.
  const vistos = new Set<number>()
  const conNucleo: [P, string][] = []
  for (const p of candidatos) {
    if (vistos.has(p.id)) continue
    vistos.add(p.id)
    if (p.nro_poliza == null) continue
    if (aseguradoraId != null && p.aseg_id != null && p.aseg_id !== aseguradoraId) continue
    const a = anexoSiCorresponde(p.nro_poliza, nucleo, anexoRep)
    if (a != null) conNucleo.push([p, a])
  }

  if (conNucleo.length === 0) {
    return crearResultado<P>('noEncontrada', {
      candidatos: polizasDelCliente,
      motivo:
        polizasDelCliente.length === 0
          ? `No hay ninguna póliza con el número ${nucleo}.`
          : `No hay ninguna póliza con el número ${nucleo}. Abajo están las pólizas de ` +
            'ese cliente por si el número vino distinto en el reporte.',
    })
  }

  const ordenar = (ps: P[]): P[] => {
    if (primaLinea == null) return ps
    const l = [...ps]
    // Orden estable, igual que List.sort de Dart para estos tamaños.
    l.sort((a, b) => Math.abs((a.prima_poliza ?? 0) - primaLinea) - Math.abs((b.prima_poliza ?? 0) - primaLinea))
    return l
  }

  const confirmarDocumento = (p: P, estado: EstadoMatch, motivoOk: string): ResultadoMatch<P> => {
    if (esNumeroPegado(p.nro_poliza ?? '', nucleo)) {
      return crearResultado<P>('revisar', {
        poliza: p,
        candidatos: [p],
        motivo:
          `La póliza ${p.nro_poliza} está registrada con el número y el anexo pegados; ` +
          'podría ser otra póliza que empieza igual. Confirme antes de incluirla.',
      })
    }
    const docPoliza = p.doc_cliente == null ? '' : normalizarDoc(p.doc_cliente)
    if (doc !== '' && docPoliza !== '' && !mismoDocumento(docPoliza, doc)) {
      return crearResultado<P>('revisar', {
        poliza: p,
        candidatos: [p],
        motivo:
          `El número coincide, pero el documento del reporte (${doc}) no es el del ` +
          `cliente de la póliza (${p.doc_cliente}). Confirme antes de incluirla.`,
      })
    }
    return crearResultado<P>(estado, { poliza: p, motivo: motivoOk })
  }

  const todas = conNucleo.map((e) => e[0])

  if (anexoRep == null) {
    if (conNucleo.length === 1) {
      return confirmarDocumento(
        conNucleo[0][0],
        'unicaSinAnexo',
        'El reporte no trae anexo; es la única póliza con ese número.',
      )
    }
    return crearResultado<P>('ambigua', {
      candidatos: ordenar(todas),
      motivo:
        `El reporte no trae anexo y hay ${conNucleo.length} pólizas con el número ` +
        `${nucleo}. Elija a cuál corresponde.`,
    })
  }

  const exactas = conNucleo.filter((e) => e[1] === anexoRep).map((e) => e[0])
  if (exactas.length === 1) {
    return confirmarDocumento(exactas[0], 'exacta', 'Número y anexo coinciden.')
  }
  if (exactas.length > 1) {
    return crearResultado<P>('ambigua', {
      candidatos: ordenar(exactas),
      motivo: `Hay ${exactas.length} pólizas registradas con el número ${nucleo} anexo ${anexoRep}. Elija la correcta.`,
    })
  }

  const sinAnexo = conNucleo.filter((e) => e[1] === '').map((e) => e[0])
  if (sinAnexo.length === 1 && conNucleo.length === 1) {
    return crearResultado<P>('revisar', {
      poliza: sinAnexo[0],
      candidatos: sinAnexo,
      motivo:
        `La póliza está registrada sin anexo y el reporte dice anexo ${anexoRep}. ` +
        'Confirme que sea la misma antes de incluirla.',
    })
  }

  const registrados = conNucleo.map((e) => (e[1] === '' ? 'sin anexo' : e[1])).join(', ')
  return crearResultado<P>('anexoNoRegistrado', {
    candidatos: ordenar(todas),
    motivo:
      `El número ${nucleo} existe, pero el anexo ${anexoRep} no está registrado ` +
      `(registrados: ${registrados}). Elija a cuál asignarlo o déjela por fuera.`,
  })
}
