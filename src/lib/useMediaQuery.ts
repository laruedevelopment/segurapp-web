import { useSyncExternalStore } from 'react'

/** true mientras la pantalla cumpla la consulta CSS (por ejemplo `(min-width: 768px)`). */
export function useMediaQuery(consulta: string): boolean {
  return useSyncExternalStore(
    (aviso) => {
      const m = window.matchMedia(consulta)
      m.addEventListener('change', aviso)
      return () => m.removeEventListener('change', aviso)
    },
    () => window.matchMedia(consulta).matches,
    () => false,
  )
}

/** Pantalla de escritorio/tableta (≥ 768 px, el `md` de Tailwind). */
export const useEsAncha = () => useMediaQuery('(min-width: 768px)')
