import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Building2, Pencil, Percent, Plus, Trash2 } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Cargando, Etiqueta, MensajeError, SeccionTarjeta, Vacio } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { Buscador } from '@/components/ui/buscador'
import { Campo, Casilla, Input, InputNumero } from '@/components/ui/campos'
import { Dialogo, useConfirmar } from '@/components/ui/dialogo'
import { useCatalogo } from '@/datos/catalogos'
import { esAdmin, useSesion } from '@/lib/sesion'
import { CLAVE_FACTURAS, eliminarEmpresa, guardarConfigFacturacion, guardarEmpresa, useConfigFacturacion, useEmpresas } from '@/datos/facturas'
import { porcentajeValido, type EmpresaAseguradora } from '@/datos/facturasLogica'
import { mensajeAmigable } from '@/lib/errores'
import type { Aseguradora } from '@/lib/tipos'

/** Ajustes de facturación (Administrador, Supervisor y Digitador): porcentajes por defecto y empresas aseguradoras. */
export default function AjustesFacturas() {
  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina titulo="Ajustes de facturación" subtitulo="Porcentajes por defecto y empresas aseguradoras" volver="/facturas" />
      <Contenido className="flex max-w-4xl flex-col gap-4">
        <Porcentajes />
        <Empresas />
      </Contenido>
    </div>
  )
}

function Porcentajes() {
  const qc = useQueryClient()
  const config = useConfigFacturacion()
  const [iva, setIva] = useState<number | null | undefined>(undefined)
  const [rete, setRete] = useState<number | null | undefined>(undefined)
  const [ica, setIca] = useState<number | null | undefined>(undefined)
  const [guardando, setGuardando] = useState(false)

  const vIva = iva === undefined ? config.data?.ivaPct ?? null : iva
  const vRete = rete === undefined ? config.data?.retePct ?? null : rete
  const vIca = ica === undefined ? config.data?.icaPct ?? null : ica
  const valido = porcentajeValido(vIva) && porcentajeValido(vRete) && porcentajeValido(vIca)
  const cambio = iva !== undefined || rete !== undefined || ica !== undefined

  const guardar = async () => {
    if (!porcentajeValido(vIva) || !porcentajeValido(vRete) || !porcentajeValido(vIca)) return
    setGuardando(true)
    try {
      await guardarConfigFacturacion({ ivaPct: vIva, retePct: vRete, icaPct: vIca })
      toast.success('Porcentajes guardados. Las facturas nuevas parten de estos valores; las que ya existen no cambian.')
      setIva(undefined)
      setRete(undefined)
      setIca(undefined)
      await qc.invalidateQueries({ queryKey: CLAVE_FACTURAS })
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudieron guardar los porcentajes'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <SeccionTarjeta titulo="Porcentajes por defecto" icono={<Percent />}>
      {config.isError ? (
        <MensajeError error={mensajeAmigable(config.error, 'No se pudieron cargar los porcentajes')} />
      ) : config.isPending ? (
        <Cargando />
      ) : (
        <>
          <p className="mb-3 text-[12.5px] text-ink-soft">Cada factura nueva parte de estos valores y se pueden cambiar en esa factura.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="IVA (%)">
              <InputNumero valor={vIva} onCambio={setIva} permitirNegativos={false} sufijo="%" />
            </Campo>
            <Campo etiqueta="Retención en la fuente (%)">
              <InputNumero valor={vRete} onCambio={setRete} permitirNegativos={false} sufijo="%" />
            </Campo>
            <Campo etiqueta="ICA (%)">
              <InputNumero valor={vIca} onCambio={setIca} permitirNegativos={false} sufijo="%" />
            </Campo>
          </div>
          {!valido && <p className="mt-2 text-[12px] text-danger">Los porcentajes deben estar entre 0 y 100.</p>}
          <div className="mt-3">
            <Boton variante="verde" tamano="sm" onClick={() => void guardar()} disabled={!valido || !cambio} cargando={guardando}>
              Guardar porcentajes
            </Boton>
          </div>
        </>
      )}
    </SeccionTarjeta>
  )
}

function Empresas() {
  const admin = esAdmin(useSesion()?.usuario) // borrar empresas solo el Administrador; los demás las desactivan
  const qc = useQueryClient()
  const confirmar = useConfirmar()
  const empresas = useEmpresas()
  const aseguradoras = useCatalogo('aseguradoras')
  const [editando, setEditando] = useState<EmpresaAseguradora | 'nueva' | null>(null)

  const nombreAseg = (id: number | null) => aseguradoras.data?.find((a) => a.id === id)?.nombre_aseg ?? 'Sin aseguradora'

  const eliminar = async (e: EmpresaAseguradora) => {
    const ok = await confirmar({
      titulo: 'Eliminar empresa',
      mensaje: `Se eliminará "${e.nombre}". Si ya tiene facturas, no se podrá: desactívela en su lugar.`,
      confirmar: 'Eliminar',
      peligro: true,
    })
    if (!ok) return
    try {
      await eliminarEmpresa(e.id)
      await qc.invalidateQueries({ queryKey: CLAVE_FACTURAS })
      toast.success('Empresa eliminada.')
    } catch (err) {
      toast.error(mensajeAmigable(err, 'No se pudo eliminar la empresa'))
    }
  }

  return (
    <SeccionTarjeta
      titulo="Empresas aseguradoras"
      icono={<Building2 />}
      acciones={
        <Boton variante="secundario" tamano="sm" onClick={() => setEditando('nueva')}>
          <Plus />
          Nueva empresa
        </Boton>
      }
    >
      <p className="mb-3 text-[12.5px] text-ink-soft">
        Una aseguradora puede tener varias razones sociales. Siempre se identifican por el NIT, que no se puede repetir.
      </p>
      {empresas.isError ? (
        <MensajeError error={mensajeAmigable(empresas.error, 'No se pudieron cargar las empresas')} />
      ) : empresas.isPending ? (
        <Cargando />
      ) : (empresas.data ?? []).length === 0 ? (
        <Vacio titulo="Todavía no hay empresas." detalle="Cree la primera con el botón Nueva empresa." />
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {(empresas.data ?? []).map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold">{e.nombre}</div>
                <div className="text-[12px] text-ink-soft">
                  NIT <span className="num">{e.nit}</span> · {nombreAseg(e.asegId)} · IVA {e.ivaPct} %
                </div>
              </div>
              {!e.activa && <Etiqueta>Inactiva</Etiqueta>}
              <Boton variante="fantasma" tamano="icono" title="Editar" aria-label={`Editar ${e.nombre}`} onClick={() => setEditando(e)}>
                <Pencil />
              </Boton>
              {admin && (
                <Boton variante="fantasma" tamano="icono" title="Eliminar" aria-label={`Eliminar ${e.nombre}`} onClick={() => void eliminar(e)}>
                  <Trash2 className="text-danger" />
                </Boton>
              )}
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <DialogoEmpresa
          empresa={editando === 'nueva' ? null : editando}
          aseguradoras={aseguradoras.data ?? []}
          onCerrar={() => setEditando(null)}
          onGuardada={async () => {
            setEditando(null)
            await qc.invalidateQueries({ queryKey: CLAVE_FACTURAS })
          }}
        />
      )}
    </SeccionTarjeta>
  )
}

function DialogoEmpresa({
  empresa,
  aseguradoras,
  onCerrar,
  onGuardada,
}: {
  empresa: EmpresaAseguradora | null
  aseguradoras: Aseguradora[]
  onCerrar: () => void
  onGuardada: () => Promise<void>
}) {
  const [nombre, setNombre] = useState(empresa?.nombre ?? '')
  const [nit, setNit] = useState(empresa?.nit ?? '')
  const [aseg, setAseg] = useState<Aseguradora | null>(aseguradoras.find((a) => a.id === empresa?.asegId) ?? null)
  const [activa, setActiva] = useState(empresa?.activa ?? true)
  const [ivaPct, setIvaPct] = useState<number | null>(empresa?.ivaPct ?? 16)
  const [intento, setIntento] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const digitosNit = nit.replace(/\D/g, '')
  const errorNombre = nombre.trim() === '' ? 'Requerido' : null
  const errorNit = digitosNit.length < 1 ? 'Escriba el NIT' : null
  const errorIva = !porcentajeValido(ivaPct) ? 'Entre 0 y 100' : null

  const guardar = async () => {
    setIntento(true)
    if (errorNombre || errorNit || errorIva) return
    setGuardando(true)
    try {
      await guardarEmpresa({ id: empresa?.id, asegId: aseg?.id ?? null, nombre, nit, ivaPct: ivaPct ?? 0, activa })
      toast.success('Empresa guardada.')
      await onGuardada()
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudo guardar la empresa. Revise que el NIT no esté repetido.'))
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={empresa ? 'Editar empresa' : 'Nueva empresa aseguradora'}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton onClick={() => void guardar()} cargando={guardando}>
            Guardar
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Campo etiqueta="Razón social" obligatorio error={intento ? errorNombre : null}>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="SEGUROS DEL ESTADO S.A. (Generales)" />
        </Campo>
        <Campo etiqueta="NIT" obligatorio error={intento ? errorNit : null}>
          <Input value={nit} onChange={(e) => setNit(e.target.value)} placeholder="860.009.578-6" />
        </Campo>
        <Campo etiqueta="IVA que lleva esta empresa (%)" ayuda="Generales suele ser 16 %; Vida, 0 %. Se usa como punto de partida en cada factura." error={intento ? errorIva : null}>
          <InputNumero valor={ivaPct} onCambio={setIvaPct} permitirNegativos={false} sufijo="%" />
        </Campo>
        <Campo etiqueta="Aseguradora">
          <Buscador<Aseguradora>
            valor={aseg}
            onCambio={setAseg}
            opciones={aseguradoras}
            etiqueta={(a) => a.nombre_aseg}
            clave={(a) => a.id}
            inactivo={(a) => !a.estado_aseg}
          />
        </Campo>
        <Casilla marcada={activa} onCambio={setActiva} etiqueta="Activa (se ofrece al crear facturas)" />
      </div>
    </Dialogo>
  )
}
