import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Send, Trash2 } from 'lucide-react'
import { Aviso } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { AreaTexto, Campo, Input } from '@/components/ui/campos'
import { Dialogo } from '@/components/ui/dialogo'
import { CLAVE_CONTEO_ELIMINACIONES, solicitarEliminacion } from '@/datos/eliminacion'
import {
  MAX_MOTIVO,
  confirmacionValida,
  idsMarcadas,
  mensajeMarcadas,
  motivoValido,
  plural,
  tituloOmitidasSolicitar,
  type ResultadoEliminacion,
} from '@/datos/eliminacionLogica'
import { quitarPolizasDeCache } from '@/datos/usePolizas'
import { mensajeAmigable } from '@/lib/errores'
import { fmtDinero } from '@/lib/numeros'
import { esAdmin, useSesion } from '@/lib/sesion'
import type { PolizaLista } from '@/lib/tipos'

export type PolizaParaEliminar = Pick<PolizaLista, 'id' | 'nro_poliza' | 'nombre_cliente' | 'nombre_aseg' | 'prima_poliza'>

/**
 * Pide confirmación para marcar [polizas] como eliminadas (una o varias, una
 * sola validación). No las borra: quedan pendientes de que un administrador
 * las autorice o las rechace, y desaparecen de listas y estadísticas.
 *
 * [onHecho] recibe los ids que sí quedaron marcados (si hubo alguno).
 */
export default function DialogoEliminar({
  polizas,
  abierto,
  onCerrar,
  onHecho,
}: {
  polizas: PolizaParaEliminar[]
  abierto: boolean
  onCerrar: () => void
  onHecho: (marcadas: number[]) => void
}) {
  // Se monta solo mientras está abierto: cada apertura empieza limpia.
  if (!abierto || polizas.length === 0) return null
  return <Contenido polizas={polizas} onCerrar={onCerrar} onHecho={onHecho} />
}

function Contenido({
  polizas,
  onCerrar,
  onHecho,
}: {
  polizas: PolizaParaEliminar[]
  onCerrar: () => void
  onHecho: (marcadas: number[]) => void
}) {
  const qc = useQueryClient()
  const sesion = useSesion()
  const admin = esAdmin(sesion?.usuario)
  const [motivo, setMotivo] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ r: ResultadoEliminacion; marcadas: number[] } | null>(null)

  const n = polizas.length
  const varias = n > 1
  const valido = motivoValido(motivo) && confirmacionValida(confirmar)
  const porId = new Map(polizas.map((p) => [p.id, p]))

  const enviar = async () => {
    if (!valido || enviando) return
    setEnviando(true)
    setError(null)
    try {
      const ids = polizas.map((p) => p.id)
      const r = await solicitarEliminacion(ids, motivo.trim())
      const marcadas = idsMarcadas(ids, r)
      // Las marcadas ya no se ven: se sacan de la caché sin volver a descargar todo.
      quitarPolizasDeCache(qc, marcadas)
      qc.invalidateQueries({ queryKey: CLAVE_CONTEO_ELIMINACIONES })
      if (r.omitidas.length > 0) {
        setResultado({ r, marcadas })
      } else {
        toast.success(mensajeMarcadas(r.hechas, n === 1 ? polizas[0] : undefined), { duration: 8000 })
        onHecho(marcadas)
      }
    } catch (e) {
      setError(mensajeAmigable(e, 'No se pudo enviar a autorización'))
    } finally {
      setEnviando(false)
    }
  }

  // ── Resultado parcial: qué pólizas no se pudieron enviar y por qué ──
  if (resultado) {
    const { r, marcadas } = resultado
    const cerrar = () => {
      if (marcadas.length > 0) onHecho(marcadas)
      else onCerrar()
    }
    return (
      <Dialogo
        abierto
        onCerrar={cerrar}
        titulo={tituloOmitidasSolicitar(r.hechas, r.omitidas.length)}
        pie={
          <Boton autoFocus onClick={cerrar}>
            Entendido
          </Boton>
        }
      >
        <ul className="flex flex-col gap-3">
          {r.omitidas.map((o) => (
            <li key={o.id}>
              <div className="font-semibold">
                Cód. {o.id} · {porId.get(o.id)?.nro_poliza ?? 'sin número'}
              </div>
              <div className="text-ink-soft">{o.razon}</div>
            </li>
          ))}
        </ul>
      </Dialogo>
    )
  }

  return (
    <Dialogo
      abierto
      onCerrar={() => {
        if (!enviando) onCerrar()
      }}
      titulo={
        <span className="flex items-center gap-2">
          <Trash2 className="size-5 text-danger" />
          {varias ? `Eliminar ${n} pólizas` : 'Eliminar póliza'}
        </span>
      }
      ancho="lg"
      pie={
        <>
          <Boton variante="secundario" disabled={enviando} onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton variante="peligro" disabled={!valido} cargando={enviando} onClick={enviar}>
            {!enviando && <Send />}
            {varias ? `Enviar ${plural(n, 'póliza', 'pólizas')} a autorización` : 'Enviar a autorización'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Aviso tono="alerta">
          <p className="font-semibold">
            {varias
              ? 'Todavía no se borran. Quedan pendientes de que un administrador las autorice.'
              : 'Todavía no se borra. Queda pendiente de que un administrador la autorice.'}
          </p>
          <p className="mt-1 text-[13px]">
            {varias
              ? 'Mientras tanto no las verá en listas ni estadísticas. Si el administrador las rechaza, vuelven a aparecer.'
              : 'Mientras tanto no la verá en listas ni estadísticas. Si el administrador la rechaza, vuelve a aparecer.'}
            {admin ? ' Como usted es administrador, lo autoriza desde "Eliminaciones por autorizar".' : ''}
          </p>
          <p className="mt-1.5 text-[13px]">
            {varias
              ? 'Las pólizas con pagos registrados no se pueden eliminar: primero hay que mover los pagos a la póliza correcta. Si solo quiere que dejen de contar, anúlelas (se puede revertir).'
              : 'Una póliza con pagos registrados no se puede eliminar: primero hay que mover los pagos a la póliza correcta. Si solo quiere que deje de contar, anúlela (se puede revertir).'}
          </p>
        </Aviso>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold">{varias ? `Pólizas a eliminar (${n}):` : 'Póliza a eliminar:'}</p>
          <ul className="max-h-[200px] divide-y divide-line overflow-y-auto rounded-[10px] border border-line">
            {polizas.map((p) => (
              <li key={p.id} className="px-2.5 py-1.5">
                <div className="text-[13px] font-semibold">
                  Cód. {p.id} · {p.nro_poliza ?? 'sin número'}
                </div>
                <div className="text-[12.5px] text-ink-soft">
                  {[p.nombre_cliente, p.nombre_aseg, `Prima ${p.prima_poliza ? fmtDinero(p.prima_poliza) : '—'}`]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <Campo
          etiqueta="Motivo (obligatorio)"
          error={motivo && !motivoValido(motivo) ? 'Escriba al menos 5 caracteres (sin contar espacios).' : null}
          ayuda={!motivo ? 'Ej.: está repetida, es la misma del cód. 1234' : undefined}
        >
          <AreaTexto
            autoFocus
            rows={2}
            maxLength={MAX_MOTIVO}
            disabled={enviando}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </Campo>

        <Campo etiqueta="Para confirmar, escriba ELIMINAR">
          <Input
            disabled={enviando}
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') enviar()
            }}
            autoComplete="off"
          />
        </Campo>

        {error && <p className="text-danger">{error}</p>}
      </div>
    </Dialogo>
  )
}
