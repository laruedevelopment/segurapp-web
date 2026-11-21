import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import type { PolizaLista } from '@/lib/tipos'

vi.mock('@/lib/supabase', () => ({ ES_PRUEBAS: true, db: {}, APP_ENV: 'dev' }))
const { default: HistorialPoliza } = await import('./HistorialPoliza')

const fila = (id: number, nro: string, ini: string, fin: string, bien: string, obs: string | null = null) =>
  ({ id, nro_poliza: nro, aseg_id: 10, fini_poliza: ini, ffin_poliza: fin, prima_poliza: 1_500_000, bien_asegurado: bien, obs_poliza: obs }) as unknown as PolizaLista

function dibujar(filas: PolizaLista[], nro: string, polizaId: number) {
  const qc = new QueryClient()
  qc.setQueryData(['polizas', 'historial', 10, '994000012539'], filas)
  return renderToString(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <HistorialPoliza polizaId={polizaId} nro={nro} asegId={10} />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('historial de la póliza', () => {
  it('muestra las vigencias, los anexos y las placas de la más reciente', () => {
    const h = dibujar(
      [
        fila(9631, '400-40-994000012539-0', '2014-10-10', '2015-10-10', 'KKZ219'),
        fila(33339, '400-40-994000012539-15', '2025-11-13', '2026-11-13', 'COLECTIVA', 'KKZ219 - KSW194'),
        fila(33340, '400-40-994000012539-16', '2025-11-13', '2026-11-13', 'COLECTIVA', 'LVY184'),
        fila(1, '77-1', '2020-01-01', '2021-01-01', 'otro'), // otro grupo: no debe aparecer
      ],
      '400-40-994000012539-15',
      33339,
    )
    const texto = h.replace(/<!-- -->/g, '')
    expect(texto).toContain('Historial de la póliza')
    expect(texto).toContain('2 vigencias, 3 registros')
    expect(h).toContain('KSW194')
    expect(h).toContain('LVY184')
    expect(texto).toContain('1 anexo')
    expect(h).toContain('esta póliza')
    expect(h).not.toContain('>otro<')
  })
  it('no aparece si la póliza no tiene otros registros', () => {
    expect(dibujar([fila(1, '400-40-994000012539-0', '2014-10-10', '2015-10-10', 'KKZ219')], '400-40-994000012539-0', 1)).toBe('')
  })
})
