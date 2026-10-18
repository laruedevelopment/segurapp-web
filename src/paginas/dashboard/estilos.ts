/** Props para que una fila de tabla se pueda activar con el teclado. */
export function filaClicable(accion: () => void) {
  return {
    tabIndex: 0,
    onClick: accion,
    onKeyDown: (e: { key: string; preventDefault: () => void }) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        accion()
      }
    },
  }
}

export const clTh = 'px-2 py-1.5 text-[11px] font-bold whitespace-nowrap text-ink-soft'
export const clTd = 'px-2 py-1.5 whitespace-nowrap'
