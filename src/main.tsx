import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { ProveedorConfirmar } from '@/components/ui/dialogo'
import { cancelarCargaMasiva } from '@/datos/cargaMasiva'
import { configurarAlCerrar } from '@/lib/sesion'
import { router } from './rutas'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

// Al cerrar sesión (o al vencer) se descartan todos los datos en memoria.
configurarAlCerrar(() => {
  cancelarCargaMasiva()
  queryClient.clear()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ProveedorConfirmar>
        <RouterProvider router={router} />
      </ProveedorConfirmar>
      <Toaster position="bottom-right" richColors closeButton />
    </QueryClientProvider>
  </StrictMode>,
)
