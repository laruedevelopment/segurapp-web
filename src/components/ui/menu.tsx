import type { ReactNode } from 'react'
import { DropdownMenu } from 'radix-ui'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Boton } from './button'

/** Menú desplegable accesible (teclado, foco y Escape los maneja Radix). */
export function MenuAcciones({
  etiqueta = 'Más acciones',
  children,
  className,
}: {
  etiqueta?: string
  children: ReactNode
  className?: string
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Boton variante="secundario" tamano="sm" className={cn('h-10 md:h-8', className)}>
          <MoreHorizontal />
          {etiqueta}
        </Boton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-60 rounded-xl border border-line bg-surface p-1.5 shadow-xl"
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function ItemMenu({
  icono,
  children,
  onSelect,
  disabled,
  insignia,
}: {
  icono?: ReactNode
  children: ReactNode
  onSelect: () => void
  disabled?: boolean
  insignia?: ReactNode
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-semibold outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-muted [&_svg]:size-4"
    >
      {icono}
      <span className="flex-1">{children}</span>
      {insignia}
    </DropdownMenu.Item>
  )
}
