import { describe, expect, it } from 'vitest'
import {
  contratoDesdeFila,
  diasDesdeFirma,
  indiceClientes,
  mismoDocumento,
  parametrosConsulta,
  plazoDias,
  puntaje,
} from './secopLogica'

const HOY = new Date('2026-10-23T12:00:00')

describe('mismoDocumento', () => {
  it('acepta el NIT con o sin dígito de verificación y con puntos', () => {
    expect(mismoDocumento('901.833.042-2', '9018330422')).toBe(true)
    expect(mismoDocumento('901833042', '9018330422')).toBe(true)
    expect(mismoDocumento('901833042', '901833043')).toBe(false)
  })
  it('no confunde documentos distintos ni vacíos', () => {
    expect(mismoDocumento('No Definido', '123456789')).toBe(false)
    expect(mismoDocumento('12345', '12345')).toBe(false) // demasiado corto
    expect(mismoDocumento('1234567', '12345678901')).toBe(false)
  })
})

describe('indiceClientes', () => {
  const buscar = indiceClientes([
    { id: 1, nombre: 'ACME SAS', doc: '901.833.042-2' },
    { id: 2, nombre: 'Juan', doc: '91078726' },
    { id: 3, nombre: 'Sin doc', doc: null },
  ])
  it('halla al cliente con o sin dígito de verificación', () => {
    expect(buscar('9018330422')?.id).toBe(1)
    expect(buscar('901833042')?.id).toBe(1)
    expect(buscar('91078726')?.id).toBe(2)
  })
  it('devuelve null si no es cliente', () => {
    expect(buscar('800147909')).toBeNull()
    expect(buscar('No Definido')).toBeNull()
  })
})

describe('parametrosConsulta', () => {
  it('arma el filtro y escapa las comillas', () => {
    const p = parametrosConsulta({ departamento: "O'Higgins", dias: 10, valorMin: 50_000_000, tipos: ['Obra', 'Consultoría'] }, HOY)
    expect(p.$where).toContain("departamento='O''Higgins'")
    expect(p.$where).toContain("fecha_de_firma>='2026-10-13T00:00:00'")
    expect(p.$where).toContain('valor_del_contrato>50000000')
    expect(p.$where).toContain("tipo_de_contrato in ('Obra','Consultoría')")
    expect(p.$limit).toBe('300')
  })
  it('sin valor mínimo ni tipos no agrega esas condiciones', () => {
    const p = parametrosConsulta({ departamento: 'Santander', dias: 7, valorMin: 0, tipos: [] }, HOY)
    expect(p.$where).not.toContain('valor_del_contrato')
    expect(p.$where).not.toContain('tipo_de_contrato')
  })
})

describe('contratoDesdeFila', () => {
  it('convierte la fila y tolera campos faltantes', () => {
    const c = contratoDesdeFila({
      id_contrato: 'CO1.PCCNTR.1',
      proveedor_adjudicado: ' ACME SAS ',
      valor_del_contrato: '135150014',
      fecha_de_firma: '2026-10-19T00:00:00.000',
      urlproceso: { url: 'https://x.test/p' },
    })
    expect(c?.proveedor).toBe('ACME SAS')
    expect(c?.valor).toBe(135150014)
    expect(c?.firma).toBe('2026-10-19')
    expect(c?.url).toBe('https://x.test/p')
    expect(c?.fin).toBeNull()
  })
  it('descarta filas sin id', () => {
    expect(contratoDesdeFila({ proveedor_adjudicado: 'X' })).toBeNull()
  })
})

describe('fechas y puntaje', () => {
  it('calcula días y plazo', () => {
    expect(diasDesdeFirma('2026-10-19', HOY)).toBe(4)
    expect(diasDesdeFirma(null, HOY)).toBeNull()
    expect(plazoDias('2026-10-01', '2026-12-30')).toBe(90)
    expect(plazoDias('2026-12-30', '2026-10-01')).toBeNull()
  })
  it('un contrato grande y reciente puntúa más que uno chico y viejo', () => {
    const grande = puntaje({ valor: 5e8, firma: '2026-10-22', tipo: 'Obra' }, HOY)
    const chico = puntaje({ valor: 2e7, firma: '2026-09-01', tipo: 'Suministros' }, HOY)
    expect(grande).toBeGreaterThan(chico)
  })
})
