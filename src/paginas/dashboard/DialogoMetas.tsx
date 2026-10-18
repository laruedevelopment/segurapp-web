import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Boton } from '@/components/ui/button'
import { Dialogo } from '@/components/ui/dialogo'
import { Campo, InputNumero, claseCampo } from '@/components/ui/campos'
import { MENSAJE_TABLA_METAS, claveMetas, esTablaMetasFaltante, guardarMetas } from '@/datos/dashboard'
import { MESES_12, fmtEntero, fmtMonto } from './formato'
import { mensajeAmigable } from '@/lib/errores'
import { INDICADORES_META, repartirEnMeses, type IndicadorClave, type Meta } from './motor'

type Valores = Array<number | null>

const clave = (ind: string, asesorId: number) => `${ind}|${asesorId}`

/**
 * Editor de metas mensuales (solo Administrador). Se elige indicador y alcance
 * (agencia o un asesor), se escriben los 12 meses o se reparte un total anual
 * en partes iguales. Lo que se edite en varios indicadores o asesores dentro de
 * la misma apertura se guarda junto.
 */
export function DialogoMetas({
  abierto,
  anio,
  metasActuales,
  asesores,
  onCerrar,
}: {
  abierto: boolean
  anio: number
  metasActuales: Meta[]
  asesores: Array<{ id: number; nombre: string }>
  onCerrar: () => void
}) {
  // El contenido se monta solo mientras está abierto: cada apertura empieza limpia.
  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo={`Metas ${anio}`} ancho="lg">
      {abierto && <Formulario anio={anio} metasActuales={metasActuales} asesores={asesores} onCerrar={onCerrar} />}
    </Dialogo>
  )
}

function Formulario({
  anio,
  metasActuales,
  asesores,
  onCerrar,
}: {
  anio: number
  metasActuales: Meta[]
  asesores: Array<{ id: number; nombre: string }>
  onCerrar: () => void
}) {
  const qc = useQueryClient()
  const [indicador, setIndicador] = useState<IndicadorClave>('prima')
  const [asesorId, setAsesorId] = useState(0)
  const [total, setTotal] = useState<number | null>(null)
  const [valores, setValores] = useState<Record<string, Valores>>({})
  const [editados, setEditados] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const k = clave(indicador, asesorId)
  const ind = INDICADORES_META.find((i) => i.clave === indicador)!

  // Valores de la combinación elegida: lo editado o lo que ya hay guardado.
  const actuales: Valores =
    valores[k] ??
    Array.from({ length: 12 }, (_, m) => {
      const v = metasActuales
        .filter((x) => x.indicador === indicador && x.asesorId === asesorId && x.mes === m + 1)
        .reduce((s, x) => s + x.valor, 0)
      return v === 0 ? null : v
    })

  const poner = (nuevos: Valores) => {
    setValores((p) => ({ ...p, [k]: nuevos }))
    setEditados((p) => new Set(p).add(k))
  }

  const suma = actuales.reduce<number>((s, v) => s + (v ?? 0), 0)

  const repartir = () => {
    if (total == null || total <= 0) return
    poner(repartirEnMeses(total))
  }

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      const metas: Meta[] = []
      for (const key of editados) {
        const [ik, ak] = key.split('|')
        const vals = valores[key]
        for (let m = 0; m < 12; m++) {
          const v = vals?.[m] ?? 0
          if (v < 0) throw new Error('Hay valores negativos.')
          metas.push({ anio, mes: m + 1, indicador: ik as IndicadorClave, asesorId: Number(ak), valor: v })
        }
      }
      await guardarMetas(metas)
      await qc.invalidateQueries({ queryKey: claveMetas(anio) })
      onCerrar()
    } catch (e) {
      setError(esTablaMetasFaltante(e) ? MENSAJE_TABLA_METAS : mensajeAmigable(e, 'No se pudo guardar las metas'))
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Indicador">
          <select className={claseCampo} value={indicador} onChange={(e) => setIndicador(e.target.value as IndicadorClave)}>
            {INDICADORES_META.map((i) => (
              <option key={i.clave} value={i.clave}>
                {i.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Alcance">
          <select className={claseCampo} value={asesorId} onChange={(e) => setAsesorId(Number(e.target.value))}>
            <option value={0}>Toda la agencia</option>
            {asesores.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Campo etiqueta="Total anual (opcional)" ayuda={ind.monetario ? 'En pesos' : 'Cantidad de pólizas'} className="min-w-48 flex-1">
          <InputNumero valor={total} onCambio={setTotal} maxDecimales={0} permitirNegativos={false} prefijo={ind.monetario ? '$' : undefined} />
        </Campo>
        <Boton variante="secundario" onClick={repartir} disabled={total == null || total <= 0} className="mb-5">
          Repartir en 12 meses
        </Boton>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {MESES_12.map((mes, m) => (
          <Campo key={mes} etiqueta={mes.charAt(0).toUpperCase() + mes.slice(1)}>
            <InputNumero
              valor={actuales[m]}
              onCambio={(n) => poner(actuales.map((v, i) => (i === m ? n : v)))}
              maxDecimales={0}
              permitirNegativos={false}
              aria-label={`Meta de ${mes}`}
            />
          </Campo>
        ))}
      </div>
      <p className="font-bold">Total del año: {ind.monetario ? fmtMonto(suma) : fmtEntero(suma)}</p>
      {error && <div className="rounded-[10px] border border-danger/30 bg-danger-soft px-3 py-2 text-danger">{error}</div>}
      <p className="text-[12px] text-ink-soft">
        Puede cambiar de indicador o de asesor y seguir editando: al guardar se guardan todos los que modificó.
      </p>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
        <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Boton>
        <Boton onClick={guardar} cargando={guardando} disabled={editados.size === 0}>
          Guardar metas
        </Boton>
      </div>
    </div>
  )
}
