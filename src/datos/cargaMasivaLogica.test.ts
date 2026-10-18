import { describe, expect, test } from 'vitest'
import { agruparDuplicadas, conReintentos, esErrorTemporal, firmaArchivo, mimeDeNombre } from './cargaMasivaLogica'

describe('mimeDeNombre', () => {
  test('formatos aceptados', () => {
    expect(mimeDeNombre('poliza.PDF')).toBe('application/pdf')
    expect(mimeDeNombre('foto.jpeg')).toBe('image/jpeg')
    expect(mimeDeNombre('foto.jpg')).toBe('image/jpeg')
    expect(mimeDeNombre('a.png')).toBe('image/png')
    expect(mimeDeNombre('a.webp')).toBe('image/webp')
  })
  test('otros se rechazan', () => {
    expect(mimeDeNombre('hoja.xlsx')).toBeNull()
    expect(mimeDeNombre('sinextension')).toBeNull()
  })
})

describe('firmaArchivo', () => {
  test('mismos bytes, misma firma; distinto tamaño o contenido, distinta', () => {
    const a = new Uint8Array([1, 2, 3])
    const b = new Uint8Array([1, 2, 4])
    expect(firmaArchivo(3, a, a)).toBe(firmaArchivo(3, a.slice(), a.slice()))
    expect(firmaArchivo(3, a, a)).not.toBe(firmaArchivo(4, a, a))
    expect(firmaArchivo(3, a, a)).not.toBe(firmaArchivo(3, a, b))
  })
})

describe('esErrorTemporal', () => {
  test('mensajes del servidor', () => {
    expect(esErrorTemporal('Se alcanzó el límite de uso de la IA. Intente de nuevo en un minuto.')).toBe(true)
    expect(esErrorTemporal('El servicio de IA no está disponible en este momento.')).toBe(true)
    expect(esErrorTemporal('No se pudo leer el documento (503).')).toBe(true)
    expect(esErrorTemporal('No se pudo leer este documento. Intente de nuevo.')).toBe(true)
    expect(esErrorTemporal('La IA no pudo procesar este archivo.')).toBe(false)
  })
})

describe('conReintentos', () => {
  test('reintenta errores temporales hasta 2 veces', async () => {
    let n = 0
    const esperas: number[] = []
    const r = await conReintentos(
      async () => {
        n++
        if (n < 3) throw new Error('límite de uso')
        return 'ok'
      },
      async (ms) => {
        esperas.push(ms)
      },
    )
    expect(r).toBe('ok')
    expect(esperas).toEqual([5000, 15000])
  })
  test('se rinde después del segundo reintento', async () => {
    let n = 0
    await expect(
      conReintentos(
        async () => {
          n++
          throw new Error('(429)')
        },
        async () => {},
      ),
    ).rejects.toThrow('(429)')
    expect(n).toBe(3)
  })
  test('no reintenta errores definitivos', async () => {
    let n = 0
    await expect(
      conReintentos(
        async () => {
          n++
          throw new Error('Archivo dañado')
        },
        async () => {},
      ),
    ).rejects.toThrow()
    expect(n).toBe(1)
  })
})

describe('agruparDuplicadas', () => {
  test('agrupa por aseguradora y número normalizado', () => {
    const g = agruparDuplicadas([
      { id: 1, nro_poliza: '1-0987-2', aseg_id: 5 },
      { id: 2, nro_poliza: '1 0987 2', aseg_id: 5 },
      { id: 3, nro_poliza: '109872', aseg_id: 6 },
      { id: 4, nro_poliza: 'AB-1', aseg_id: 6 },
      { id: 5, nro_poliza: 'ab1', aseg_id: 6 },
      { id: 6, nro_poliza: 'ab 1', aseg_id: 6 },
      { id: 7, nro_poliza: '  ', aseg_id: 6 },
      { id: 8, nro_poliza: null, aseg_id: 6 },
    ])
    expect(g.map((x) => x.clave)).toEqual(['6|AB1', '5|109872'])
    expect(g[0].polizas.map((p) => p.id)).toEqual([4, 5, 6])
  })
})
