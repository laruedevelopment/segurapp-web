import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Building2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Aviso, SeccionTarjeta } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { Campo, Input } from '@/components/ui/campos'
import { cargarEmpresa, guardarEmpresa } from '@/datos/empresa'
import { contactoEmpresa, useEmpresa, type Empresa } from '@/lib/empresa'
import { mensajeAmigable } from '@/lib/errores'
import { CAMPOS_EMPRESA, validarEmpresa } from './logica'

type Valores = Pick<Empresa, 'nombre' | 'nombreCorto' | 'eslogan' | 'nit' | 'ciudad' | 'pais' | 'celular' | 'correo'>
const aValores = (e: Empresa): Valores => ({ nombre: e.nombre, nombreCorto: e.nombreCorto, eslogan: e.eslogan, nit: e.nit, ciudad: e.ciudad, pais: e.pais, celular: e.celular, correo: e.correo })

/** Datos de la agencia que salen en el menú, el login, los comprobantes y las cuentas de cobro. Solo el administrador. */
export default function EmpresaPagina() {
  const qc = useQueryClient()
  const actual = useEmpresa()
  const [v, setV] = useState<Valores>(() => aValores(actual))
  const [intento, setIntento] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [cargada, setCargada] = useState<boolean | null>(null)

  // Trae lo que hay guardado en la base (si la tabla existe) para editar sobre eso.
  useEffect(() => {
    let vivo = true
    void cargarEmpresa().then((ok) => vivo && setCargada(ok))
    return () => {
      vivo = false
    }
  }, [])
  useEffect(() => {
    if (cargada) setV(aValores(actual))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargada])

  const errores = intento ? validarEmpresa(v) : {}
  const guardar = async () => {
    setIntento(true)
    if (Object.keys(validarEmpresa(v)).length > 0) return
    setGuardando(true)
    try {
      await guardarEmpresa(v)
      void qc.invalidateQueries({ queryKey: ['empresa'] })
      toast.success('Datos de la empresa guardados. Ya salen en el menú y en los PDF nuevos.')
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudieron guardar los datos'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina titulo="Datos de la empresa" subtitulo="Lo que sale en el menú, el login, los comprobantes y las cuentas de cobro" volver="/" />
      <Contenido className="flex max-w-3xl flex-col gap-4">
        {cargada === false && (
          <Aviso>
            No se encontró la configuración de la empresa en esta base (falta ejecutar la migración <b>20261119120000_config_empresa.sql</b>). Puede ver los valores de respaldo, pero no guardar.
          </Aviso>
        )}
        <SeccionTarjeta titulo="Datos de la agencia" icono={<Building2 />}>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            {CAMPOS_EMPRESA.map((c) => (
              <Campo key={c.clave} etiqueta={c.etiqueta} obligatorio={c.obligatorio} error={errores[c.clave]} ayuda={c.ayuda} className={c.clave === 'nombre' ? 'sm:col-span-2' : undefined}>
                <Input
                  value={v[c.clave as keyof Valores]}
                  maxLength={c.maximo + 10}
                  onChange={(e) => setV((x) => ({ ...x, [c.clave]: e.target.value }))}
                  aria-invalid={!!errores[c.clave]}
                />
              </Campo>
            ))}
          </div>
        </SeccionTarjeta>

        <SeccionTarjeta titulo="Así se verá">
          <div className="space-y-3 p-4 text-[13px]">
            <div>
              <div className="text-[11px] font-semibold text-ink-soft">MENÚ Y LOGIN</div>
              <div className="font-bold text-navy">SegurApp</div>
              <div className="font-semibold text-green">{v.nombreCorto || '—'}</div>
              <div className="font-semibold text-green">{v.nombre || '—'}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-ink-soft">FIRMA DE LA CUENTA DE COBRO</div>
              <div className="font-semibold">NIT {v.nit || '—'}</div>
              {contactoEmpresa({ ...actual, ...v }).map((l) => (
                <div key={l} className="text-ink-soft">{l}</div>
              ))}
            </div>
          </div>
        </SeccionTarjeta>

        <div className="flex justify-end">
          <Boton onClick={() => void guardar()} cargando={guardando} disabled={cargada === false}>
            {!guardando && <Save />} Guardar
          </Boton>
        </div>
      </Contenido>
    </div>
  )
}
