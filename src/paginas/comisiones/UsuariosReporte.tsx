import { useMemo } from 'react'
import { useCatalogo } from '@/datos/catalogos'
import type { ReportePago } from '@/datos/pagos'
import { aFechaHora, fmtFechaHora } from '@/lib/fechas'

/** Apodo de cada usuario por id (para mostrar quién creó y quién editó). */
export function useApodos() {
  const usuarios = useCatalogo('usuarios')
  return useMemo(() => {
    const m = new Map<number, string>()
    for (const u of usuarios.data ?? []) m.set(u.id, u.apodo_usuario)
    return (id: number | null | undefined) => (id == null ? null : m.get(id) ?? `#${id}`)
  }, [usuarios.data])
}

/** "Creado por X el … · Última edición por Y el …" para el encabezado del reporte. */
export function CreadoEditado({ reporte }: { reporte: ReportePago }) {
  const apodo = useApodos()
  const creador = apodo(reporte.usuario_id)
  const editor = apodo(reporte.usuario_ultmod_id)
  const fc = fmtFechaHora(aFechaHora(reporte.fcreado))
  const fm = fmtFechaHora(aFechaHora(reporte.fultmod))
  if (!creador && !editor) return null
  return (
    <span>
      {creador && (
        <>
          Creado por <b>{creador}</b>
          {fc && <span className="num"> el {fc}</span>}
        </>
      )}
      {editor && (
        <>
          {creador && ' · '}
          Última edición por <b>{editor}</b>
          {fm && <span className="num"> el {fm}</span>}
        </>
      )}
    </span>
  )
}
