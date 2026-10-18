import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Ban, Check, CheckCircle2, FileText, Pencil, ReceiptText, RefreshCw, Wallet } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Cargando, Chip, Etiqueta, MensajeError, Tarjeta, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { AreaTexto, Campo } from '@/components/ui/campos'
import { Dialogo } from '@/components/ui/dialogo'
import { CLAVE_CASOS, listarCasos, reabrirCaso, resolverCaso, revalidarCasos } from '@/datos/casos'
import {
  TIPO_COMISION_RARA,
  TIPO_PAGO_SIN_POLIZA,
  TIPO_POSIBLE_DUPLICADO,
  accionesDeCaso,
  estaResuelto,
  mensajeCerrados,
  nombreTipoCaso,
  textoResuelto,
  type CasoRevision,
} from '@/datos/casosLogica'
import { obtenerAbono, type AbonoPoliza } from '@/datos/pagos'
import { fmtFechaHora } from '@/lib/fechas'
import { useSesion, veComisiones } from '@/lib/sesion'
import { mensajeError } from '@/lib/utils'
import { DialogoAbono } from '@/paginas/comisiones/DialogoAbono'
import { DialogoAnular } from '@/paginas/polizas/DialogoAnular'

type Estado = 'P' | 'R'

const TONO_TIPO: Record<string, 'alerta' | 'peligro' | 'navy' | 'neutro'> = {
  [TIPO_PAGO_SIN_POLIZA]: 'alerta',
  [TIPO_POSIBLE_DUPLICADO]: 'peligro',
  [TIPO_COMISION_RARA]: 'navy',
}

/**
 * Bandeja "Casos por revisar": situaciones dudosas que el equipo debe aclarar.
 * Cada caso dice qué se sabe y qué hay que averiguar; quien lo aclara escribe
 * la respuesta y lo marca como resuelto. No corrige nada solo. Al cargar, la
 * base cierra sola los casos cuyos datos ya se corrigieron.
 */
export default function Casos() {
  const qc = useQueryClient()
  const verComisiones = veComisiones(useSesion()?.usuario)
  const [estado, setEstado] = useState<Estado>('P')
  const [resolviendo, setResolviendo] = useState<CasoRevision | null>(null)
  const [anulando, setAnulando] = useState<number | null>(null)
  const [abonoEditando, setAbonoEditando] = useState<AbonoPoliza | null>(null)

  const consulta = useQuery({
    queryKey: [...CLAVE_CASOS, 'lista', estado],
    queryFn: async () => {
      // Antes de listar, cierra solos los casos cuyos datos ya se corrigieron.
      const cerrados = await revalidarCasos()
      return { casos: await listarCasos(estado), cerrados }
    },
    refetchOnMount: 'always',
  })

  // Avisa una sola vez por cada carga que cerró casos.
  const avisado = useRef(0)
  useEffect(() => {
    if (!consulta.data || consulta.dataUpdatedAt === avisado.current) return
    avisado.current = consulta.dataUpdatedAt
    const msg = mensajeCerrados(consulta.data.cerrados)
    if (msg) toast.info(msg)
  }, [consulta.data, consulta.dataUpdatedAt])

  const recargar = () => qc.invalidateQueries({ queryKey: CLAVE_CASOS })

  const reabrir = async (c: CasoRevision) => {
    try {
      await reabrirCaso(c.id)
      toast.success('Caso reabierto')
      await recargar()
    } catch (e) {
      toast.error(mensajeError(e))
    }
  }

  const corregirAbono = async (c: CasoRevision) => {
    try {
      const abono = await obtenerAbono(c.abono_id!)
      if (!abono) {
        toast.info('El abono ya no existe; se revisa el caso de nuevo.')
        await recargar()
        return
      }
      if (abono.idrep_pago == null) {
        toast.error('Este abono no pertenece a ningún reporte.')
        return
      }
      setAbonoEditando(abono)
    } catch (e) {
      toast.error(mensajeError(e))
    }
  }

  const casos = consulta.data?.casos ?? []

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo="Casos por revisar"
        volver="/"
        acciones={
          <Boton
            variante="fantasma"
            tamano="icono"
            title="Recargar"
            aria-label="Recargar"
            onClick={() => void consulta.refetch()}
            disabled={consulta.isFetching}
          >
            <RefreshCw className={consulta.isFetching ? 'animate-spin' : ''} />
          </Boton>
        }
      />
      <Contenido className="flex max-w-4xl flex-col gap-4">
        <div className="flex gap-1.5">
          <Chip activo={estado === 'P'} onClick={() => setEstado('P')}>
            Pendientes
          </Chip>
          <Chip activo={estado === 'R'} onClick={() => setEstado('R')}>
            Resueltos
          </Chip>
        </div>

        {consulta.isPending ? (
          <Cargando texto="Revisando los casos…" />
        ) : consulta.isError ? (
          <MensajeError
            error={
              <div className="flex items-center gap-3">
                <span className="flex-1">No se pudieron cargar los casos: {mensajeError(consulta.error)}</span>
                <Boton tamano="sm" variante="secundario" onClick={() => void consulta.refetch()}>
                  Reintentar
                </Boton>
              </div>
            }
          />
        ) : casos.length === 0 ? (
          <Vacio
            icono={<CheckCircle2 className="text-green" />}
            titulo={estado === 'P' ? 'No hay casos pendientes.' : 'No hay casos resueltos.'}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {casos.map((c) => (
              <TarjetaCaso
                key={c.id}
                caso={c}
                verComisiones={verComisiones}
                onResolver={() => setResolviendo(c)}
                onReabrir={() => void reabrir(c)}
                onAnular={setAnulando}
                onCorregirAbono={() => void corregirAbono(c)}
              />
            ))}
          </div>
        )}
      </Contenido>

      <DialogoResolver
        caso={resolviendo}
        onCerrar={(guardo) => {
          setResolviendo(null)
          if (guardo) void recargar()
        }}
      />
      <DialogoAnular
        idPoliza={anulando}
        onCerrar={(cambio) => {
          setAnulando(null)
          // Al recargar, la revalidación cierra el caso si ya no quedan duplicadas.
          if (cambio) void recargar()
        }}
      />
      {abonoEditando && abonoEditando.idrep_pago != null && (
        <DialogoAbono
          abierto
          idReporte={abonoEditando.idrep_pago}
          abono={abonoEditando}
          onCerrar={() => setAbonoEditando(null)}
          onGuardado={() => {
            // Si el dato quedó bien, la revalidación cierra el caso sola.
            setAbonoEditando(null)
            void recargar()
          }}
        />
      )}
    </div>
  )
}

function TarjetaCaso({
  caso: c,
  verComisiones,
  onResolver,
  onReabrir,
  onAnular,
  onCorregirAbono,
}: {
  caso: CasoRevision
  verComisiones: boolean
  onResolver: () => void
  onReabrir: () => void
  onAnular: (idPoliza: number) => void
  onCorregirAbono: () => void
}) {
  const acciones = accionesDeCaso(c, verComisiones)
  const resuelto = estaResuelto(c)
  return (
    <Tarjeta className="p-4">
      <div className="flex items-center gap-2">
        <Etiqueta tono={TONO_TIPO[c.tipo] ?? 'neutro'}>{nombreTipoCaso(c.tipo)}</Etiqueta>
        <span className="text-[11.5px] text-ink-soft">Caso #{c.id}</span>
      </div>
      <h2 className="mt-2 text-[15px] font-semibold">{c.titulo}</h2>
      <p className="mt-1.5 text-[13px] leading-snug whitespace-pre-line">{c.descripcion}</p>
      {c.pregunta && (
        <div className="mt-2.5 rounded-lg bg-warning-soft p-2.5 text-[13px] leading-snug text-warning-ink">
          Qué hay que averiguar: {c.pregunta}
        </div>
      )}
      {resuelto && (
        <div className="mt-2.5 rounded-lg bg-green-soft p-2.5">
          <p className="text-[13px] leading-snug whitespace-pre-line">Respuesta: {c.respuesta ?? ''}</p>
          <p className="mt-1 text-[11.5px] text-ink-soft">
            {textoResuelto(c, c.fresuelto ? fmtFechaHora(c.fresuelto) : null)}
          </p>
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {c.polizas.map((id) => (
          <span key={id} className="contents">
            <Link to={`/polizas/${id}`}>
              <Boton variante="secundario" tamano="sm">
                <FileText />
                Póliza cód. {id}
              </Boton>
            </Link>
            {acciones.verPagos && (
              <Link to={`/polizas/${id}/pagos`}>
                <Boton variante="secundario" tamano="sm">
                  <Wallet />
                  Pagos cód. {id}
                </Boton>
              </Link>
            )}
            {acciones.anular && (
              <Boton variante="secundario" tamano="sm" className="text-danger" onClick={() => onAnular(id)}>
                <Ban />
                Anular cód. {id}
              </Boton>
            )}
          </span>
        ))}
        {acciones.verReporte && (
          <Link to={`/comisiones/${c.reporte_id}/estado-cuenta`}>
            <Boton variante="secundario" tamano="sm">
              <ReceiptText />
              Reporte #{c.reporte_id}
            </Boton>
          </Link>
        )}
        {acciones.corregirAbono && (
          <Boton variante="secundario" tamano="sm" onClick={onCorregirAbono}>
            <Pencil />
            Corregir abono
          </Boton>
        )}
        {resuelto ? (
          <Boton variante="fantasma" tamano="sm" onClick={onReabrir}>
            Reabrir
          </Boton>
        ) : (
          <Boton tamano="sm" onClick={onResolver}>
            <Check />
            Marcar resuelto
          </Boton>
        )}
      </div>
    </Tarjeta>
  )
}

function DialogoResolver({ caso, onCerrar }: { caso: CasoRevision | null; onCerrar: (guardo: boolean) => void }) {
  return (
    <Dialogo abierto={!!caso} onCerrar={() => onCerrar(false)} titulo="Marcar como resuelto" ancho="md">
      {caso && <FormularioResolver key={caso.id} caso={caso} onCerrar={onCerrar} />}
    </Dialogo>
  )
}

function FormularioResolver({ caso, onCerrar }: { caso: CasoRevision; onCerrar: (guardo: boolean) => void }) {
  const [respuesta, setRespuesta] = useState('')
  const [guardando, setGuardando] = useState(false)
  const vacia = respuesta.trim() === ''

  const guardar = async () => {
    if (vacia || guardando) return
    setGuardando(true)
    try {
      await resolverCaso(caso.id, respuesta)
      toast.success('Caso resuelto')
      onCerrar(true)
    } catch (e) {
      toast.error(mensajeError(e))
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="font-semibold">{caso.titulo}</div>
        {caso.pregunta && <p className="mt-2 text-[13px] text-ink-soft">{caso.pregunta}</p>}
      </div>
      <Campo etiqueta="¿Qué se encontró y qué se hizo?" obligatorio>
        <AreaTexto rows={4} autoFocus value={respuesta} onChange={(e) => setRespuesta(e.target.value)} />
      </Campo>
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={() => onCerrar(false)} disabled={guardando}>
          Cancelar
        </Boton>
        <Boton onClick={guardar} disabled={vacia} cargando={guardando}>
          Guardar
        </Boton>
      </div>
    </div>
  )
}
