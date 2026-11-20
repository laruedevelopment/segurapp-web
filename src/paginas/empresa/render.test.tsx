import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'

vi.mock('@/lib/supabase', () => ({ ES_PRUEBAS: true, db: {}, APP_ENV: 'dev' }))
const { default: Empresa } = await import('./Empresa')

describe('pantalla Datos de la empresa', () => {
  it('se dibuja con los datos de respaldo y la vista previa', () => {
    const h = renderToString(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <Empresa />
        </QueryClientProvider>
      </MemoryRouter>,
    )
    expect(h).toContain('Datos de la empresa')
    expect(h).toContain('63.362.817-2')
    expect(h).toContain('Así se verá')
  })
})
