import type { ReactNode } from 'react'
import { CheckCircle2, Copy, FileSignature, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Buscador } from '@/components/ui/buscador'
import { Boton } from '@/components/ui/button'
import { Campo, InputNumero } from '@/components/ui/campos'
import { Dialogo } from '@/components/ui/dialogo'
import { fmtDinero, fmtNum, formatearNumCO } from '@/lib/numeros'
import type { Asesor } from '@/lib/tipos'
import { cn } from '@/lib/utils'
import { DECIMALES_PORC, excede100, vlrParticipante } from './logica'

/** Valor calculado que no se edita (se ve como un campo gris). */
export function ValorFijo({ children, destacado, className }: { children: ReactNode; destacado?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        'num flex h-10 items-center justify-end rounded-[10px] border border-line bg-muted px-3 font-semibold',
        destacado ? 'text-navy' : 'text-ink-soft',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Fila de un participante: asesor/agencia, su % y el valor que le corresponde. */
export function FilaAsesor({
  id,
  etiqueta,
  obligatorio,
  error,
  asesores,
  asesorId,
  onAsesor,
  porc,
  onPorc,
  base,
}: {
  id: string
  etiqueta: string
  obligatorio?: boolean
  error?: string | null
  asesores: Asesor[]
  asesorId: number | null
  onAsesor: (id: number | null) => void
  porc: number | null
  onPorc: (n: number | null) => void
  base: number | null
}) {
  const valor = asesores.find((a) => a.id === asesorId) ?? null
  const vlr = vlrParticipante(base, porc)
  return (
    <div id={id} className="grid grid-cols-[1fr_110px] gap-3 sm:grid-cols-[1fr_130px_170px]">
      <Campo etiqueta={etiqueta} obligatorio={obligatorio} error={error}>
        <Buscador
          valor={valor}
          onCambio={(a) => onAsesor(a?.id ?? null)}
          opciones={asesores}
          etiqueta={(a) => a.nombre_asesor}
          clave={(a) => a.id}
          inactivo={(a) => !a.estado_asesor}
          placeholder="Seleccione el asesor…"
          error={!!error}
        />
      </Campo>
      <Campo etiqueta="% Comisión">
        <InputNumero valor={porc} onCambio={onPorc} maxDecimales={DECIMALES_PORC} sufijo="%" />
      </Campo>
      <Campo etiqueta="Vlr. comisión" className="col-span-2 sm:col-span-1">
        <ValorFijo destacado={vlr > 0}>{fmtDinero(vlr, 2)}</ValorFijo>
      </Campo>
    </div>
  )
}

/** "Total: 100,00 %" en verde, o en rojo si pasa del 100%. */
export function TotalPorcentaje({ id, titulo, total }: { id?: string; titulo: string; total: number }) {
  const excede = excede100(total)
  return (
    <div id={id} className={cn('flex items-center justify-end gap-1.5 text-[13px] font-semibold', excede ? 'text-danger' : 'text-green')}>
      {excede ? <TriangleAlert className="size-4" /> : <CheckCircle2 className="size-4" />}
      {titulo}: <span className="num">{fmtNum(total, 2)}%</span>
      {excede && <span className="font-normal">— no puede superar el 100%</span>}
    </div>
  )
}

async function copiar(texto: string, aviso: string) {
  try {
    await navigator.clipboard.writeText(texto)
    toast.success(aviso, { duration: 2000 })
  } catch {
    toast.error('No se pudo copiar. Selecciónelo y cópielo a mano.')
  }
}

/** Confirmación al crear una póliza: código real y nombre sugerido del archivo. */
export function DialogoGuardada({
  datos,
  onListo,
}: {
  datos: {
    id: number
    nro: string
    cliente: string | null
    aseguradora: string | null
    prima: number | null
    nombreArchivo: string | null
  } | null
  onListo: () => void
}) {
  return (
    <Dialogo
      abierto={!!datos}
      onCerrar={onListo}
      titulo="Póliza guardada"
      ancho="sm"
      pie={
        datos && (
          <>
            <Boton variante="secundario" onClick={() => copiar(String(datos.id), `Código ${datos.id} copiado`)}>
              <Copy />
              Copiar código
            </Boton>
            {datos.nombreArchivo && (
              <Boton variante="secundario" onClick={() => copiar(datos.nombreArchivo!, 'Nombre del archivo copiado')}>
                <FileSignature />
                Copiar nombre de archivo
              </Boton>
            )}
            <Boton onClick={onListo} autoFocus>
              Listo
            </Boton>
          </>
        )
      }
    >
      {datos && (
        <div className="space-y-3">
          <div>
            <div className="text-[12px] font-semibold text-ink-soft">Código</div>
            <div className="num text-3xl font-bold text-navy select-all">{datos.id}</div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
            <dt className="text-ink-soft">Nro. póliza</dt>
            <dd className="num">{datos.nro.trim() || '—'}</dd>
            <dt className="text-ink-soft">Cliente</dt>
            <dd>{datos.cliente ?? '—'}</dd>
            <dt className="text-ink-soft">Aseguradora</dt>
            <dd>{datos.aseguradora ?? '—'}</dd>
            <dt className="text-ink-soft">Prima</dt>
            <dd className="num">$ {formatearNumCO(datos.prima ?? 0)}</dd>
          </dl>
          {datos.nombreArchivo && (
            <div className="rounded-[10px] bg-muted px-3 py-2">
              <div className="text-[12px] font-semibold text-ink-soft">Nombre sugerido para el archivo</div>
              <div className="text-[13px] break-all select-all">{datos.nombreArchivo}</div>
            </div>
          )}
        </div>
      )}
    </Dialogo>
  )
}
