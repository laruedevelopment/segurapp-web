import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ChevronDown, FileText, Merge, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Cargando, MensajeError, Tarjeta, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { useConfirmar } from '@/components/ui/dialogo'
import { fusionarClientes, listarClientesDuplicados } from '@/datos/catalogos'
import { normalizarAlfanumerico } from '@/lib/filtros'
import { fmtDoc } from '@/lib/numeros'
import type { Cliente } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { mensajeAmigable } from '@/lib/errores'
import { CLAVE_CLIENTES } from './clientesDatos'
import { BotonRecargar, useGuardando } from './comun'
import { DialogoCliente } from './DialogoCliente'

const claveGrupo = (c: Cliente) => `${(c.tipodoc_cliente ?? '').trim()}|${normalizarAlfanumerico(c.doc_cliente ?? '')}`

/**
 * Clientes con el mismo tipo y número de documento. Nunca se fusiona nada
 * solo: el usuario elige a mano cuál conservar.
 */
export default function ClientesDuplicados() {
  const qc = useQueryClient()
  const confirmar = useConfirmar()
  const [fusionando, ejecutar] = useGuardando()
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const [editando, setEditando] = useState<number | null>(null)

  const consulta = useQuery({ queryKey: [...CLAVE_CLIENTES, 'duplicados'], queryFn: listarClientesDuplicados, staleTime: 0 })

  const grupos = useMemo(() => {
    const porClave = new Map<string, Cliente[]>()
    for (const c of consulta.data ?? []) {
      const k = claveGrupo(c)
      porClave.set(k, [...(porClave.get(k) ?? []), c])
    }
    return [...porClave.entries()]
      .filter(([, g]) => g.length > 1)
      .map(([clave, g]) => ({ clave, clientes: [...g].sort((a, b) => a.id - b.id) }))
      .sort((a, b) => b.clientes.length - a.clientes.length)
  }, [consulta.data])

  const alternar = (k: string) =>
    setAbiertos((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  const fusionar = async (grupo: Cliente[], conservar: Cliente) => {
    const sobrantes = grupo.filter((c) => c.id !== conservar.id)
    const ok = await confirmar({
      titulo: 'Fusionar clientes',
      mensaje: (
        <div className="space-y-2">
          <p>Se van a mover todas las pólizas de:</p>
          <ul className="list-disc pl-5 text-ink">
            {sobrantes.map((c) => (
              <li key={c.id}>
                #{c.id} {c.nombre_cliente}
              </li>
            ))}
          </ul>
          <p>
            hacia <b className="text-ink">#{conservar.id} {conservar.nombre_cliente}</b>, y los clientes de arriba se van a
            eliminar. Esto no se puede deshacer.
          </p>
          <p>¿Confirma la fusión?</p>
        </div>
      ),
      confirmar: 'Sí, fusionar',
      peligro: true,
    })
    if (!ok) return
    await ejecutar(async () => {
      try {
        await fusionarClientes(
          conservar.id,
          sobrantes.map((c) => c.id),
        )
        toast.success('Clientes fusionados.')
        await qc.invalidateQueries({ queryKey: CLAVE_CLIENTES })
      } catch (e) {
        toast.error(mensajeAmigable(e, 'No se pudo fusionar'))
      }
    })
  }

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo="Clientes duplicados"
        subtitulo={consulta.isSuccess ? `${grupos.length} ${grupos.length === 1 ? 'grupo' : 'grupos'} con el mismo documento` : undefined}
        volver="/catalogos/clientes"
        acciones={<BotonRecargar onClick={() => consulta.refetch()} cargando={consulta.isFetching} />}
      />
      <Contenido className="max-w-4xl">
        {consulta.isError ? (
          <MensajeError error={mensajeAmigable(consulta.error, 'No se pudieron cargar los duplicados')} />
        ) : consulta.isPending ? (
          <Cargando />
        ) : grupos.length === 0 ? (
          <Vacio icono={<CheckCircle2 className="text-green" />} titulo="No hay clientes duplicados." />
        ) : (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-soft">
              Grupos de clientes con el mismo tipo y número de documento. Dos clientes con el mismo número pero distinto
              tipo de documento (por ejemplo, una CC y un NIT) no cuentan aquí: eso sí puede pasar. Al fusionar, la base
              verifica el documento y conserva los datos de contacto.
            </p>
            {grupos.map(({ clave, clientes }) => {
              const abierto = abiertos.has(clave)
              const primero = clientes[0]
              return (
                <Tarjeta key={clave}>
                  <button type="button" className="flex w-full items-center gap-3 p-4 text-left" onClick={() => alternar(clave)}>
                    <span className="num flex size-9 shrink-0 items-center justify-center rounded-full bg-warning-soft font-bold text-warning-ink">
                      {clientes.length}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="num block font-semibold">
                        {primero.tipodoc_cliente ?? ''} {fmtDoc(primero.doc_cliente)}
                      </span>
                      <span className="block text-[12.5px] text-ink-soft">
                        {clientes.length} clientes con este documento · {primero.nombre_cliente}
                      </span>
                    </span>
                    <ChevronDown className={cn('size-5 text-ink-soft transition-transform', abierto && 'rotate-180')} />
                  </button>
                  {abierto && (
                    <ul className="divide-y divide-line border-t border-line">
                      {clientes.map((c) => (
                        <li key={c.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="truncate">
                              <span className="num text-ink-soft">#{c.id}</span> — <span className="font-medium">{c.nombre_cliente}</span>
                            </div>
                            <div className="truncate text-[12px] text-ink-soft">
                              {[c.tel_cliente, c.correo_cliente].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                            </div>
                          </div>
                          <Link to={`/catalogos/clientes/${c.id}/polizas`}>
                            <Boton variante="fantasma" tamano="sm" title="Ver pólizas">
                              <FileText />
                              Pólizas
                            </Boton>
                          </Link>
                          <Boton variante="fantasma" tamano="sm" onClick={() => setEditando(c.id)} disabled={fusionando}>
                            <Pencil />
                            Editar
                          </Boton>
                          <Boton
                            variante="secundario"
                            tamano="sm"
                            onClick={() => void fusionar(clientes, c)}
                            disabled={fusionando}
                            title="Conservar este cliente y pasarle las pólizas de los demás"
                          >
                            <Merge />
                            Conservar este y fusionar los demás
                          </Boton>
                        </li>
                      ))}
                    </ul>
                  )}
                </Tarjeta>
              )
            })}
          </div>
        )}
      </Contenido>
      {fusionando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20">
          <Cargando texto="Fusionando clientes…" className="rounded-xl bg-surface px-6 py-4 shadow-xl" />
        </div>
      )}
      <DialogoCliente
        abierto={editando != null}
        clienteId={editando}
        onCerrar={() => setEditando(null)}
        onGuardado={() => undefined}
      />
    </div>
  )
}
