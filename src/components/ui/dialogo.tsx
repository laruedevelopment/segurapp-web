import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Boton } from './button'

export function Dialogo({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  ancho = 'md',
  pie,
  children,
}: {
  abierto: boolean
  onCerrar: () => void
  titulo: ReactNode
  descripcion?: ReactNode
  ancho?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  pie?: ReactNode
  children?: ReactNode
}) {
  const anchos = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl', full: 'max-w-[min(1400px,96vw)]' }
  return (
    <Dialog.Root open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[1px]" />
        <Dialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[92vh] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'rounded-2xl border border-line bg-surface shadow-xl focus:outline-none',
            anchos[ancho],
          )}
        >
          <div className="flex items-start gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-[16px] font-semibold">{titulo}</Dialog.Title>
              {descripcion ? (
                <Dialog.Description className="mt-0.5 text-[13px] text-ink-soft">{descripcion}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{typeof titulo === 'string' ? titulo : ''}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Boton variante="fantasma" tamano="icono" aria-label="Cerrar">
                <X />
              </Boton>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {pie && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{pie}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ── Confirmación ("¿Seguro que desea eliminar…?") ───────────────────────────

interface OpcionesConfirmar {
  titulo: ReactNode
  mensaje?: ReactNode
  confirmar?: string
  cancelar?: string
  peligro?: boolean
}

const ContextoConfirmar = createContext<(o: OpcionesConfirmar) => Promise<boolean>>(async () => false)

export function ProveedorConfirmar({ children }: { children: ReactNode }) {
  const [opciones, setOpciones] = useState<OpcionesConfirmar | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirmar = useCallback((o: OpcionesConfirmar) => {
    setOpciones(o)
    return new Promise<boolean>((res) => {
      resolver.current = res
    })
  }, [])

  const cerrar = (v: boolean) => {
    resolver.current?.(v)
    resolver.current = null
    setOpciones(null)
  }

  return (
    <ContextoConfirmar.Provider value={confirmar}>
      {children}
      <Dialogo
        abierto={!!opciones}
        onCerrar={() => cerrar(false)}
        titulo={opciones?.titulo}
        ancho="sm"
        pie={
          <>
            <Boton variante="secundario" onClick={() => cerrar(false)}>
              {opciones?.cancelar ?? 'Cancelar'}
            </Boton>
            <Boton variante={opciones?.peligro ? 'peligro' : 'primario'} onClick={() => cerrar(true)} autoFocus>
              {opciones?.confirmar ?? 'Aceptar'}
            </Boton>
          </>
        }
      >
        {opciones?.mensaje && <div className="text-ink-soft">{opciones.mensaje}</div>}
      </Dialogo>
    </ContextoConfirmar.Provider>
  )
}

/** `const confirmar = useConfirmar(); if (await confirmar({ titulo: '¿Eliminar?' })) …` */
export const useConfirmar = () => useContext(ContextoConfirmar)
