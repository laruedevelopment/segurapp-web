import { useMemo, useState } from 'react'
import { Boton } from '@/components/ui/button'
import { Chip } from '@/components/ui/basicos'
import { Tabla, type Columna } from '@/components/ui/tabla'
import { fmtDinero, fmtPct } from '@/lib/numeros'
import { fmtEntero, fmtPesosCompacto } from '@/paginas/dashboard/formato'
import { DashCard, RankingBarras, type FilaRanking } from '@/paginas/dashboard/graficos'
import { alternarGrupo, type PropsTab } from './comun'
import { DIMENSIONES, MEDIDAS, agruparTablero, type DimTablero, type GrupoTablero, type Medida } from './logica'

/** Como la página "Valor Pólizas, Peso y Registros" del Power BI, con las cinco dimensiones y las tres medidas. */
export default function TabProduccion({ filas, filtros, cambiar }: PropsTab) {
  const [dim, setDim] = useState<DimTablero>('ramo')
  const [medida, setMedida] = useState<Medida>('valor')
  const grupos = useMemo(() => agruparTablero(filas, dim, medida), [filas, dim, medida])
  const info = DIMENSIONES.find((d) => d.id === dim)!
  const tocar = (n: string) => cambiar(alternarGrupo(filtros, dim, n))
  const sel = filtros[dim].length === 1 ? filtros[dim][0] : null

  const ranking: FilaRanking[] = grupos.slice(0, 15).map((g) => ({
    nombre: g.nombre,
    valor: g[medida],
    valorTexto: medida === 'registros' ? fmtEntero(g.registros) : fmtPesosCompacto(g[medida]),
    detalle: `${fmtEntero(g.registros)} registros · peso ${fmtPct((medida === 'prima' ? g.pesoPrima : g.pesoValor) * 100)}`,
  }))

  const columnas: Columna<GrupoTablero>[] = [
    { id: 'nombre', titulo: info.texto, ancho: 280, celda: (g) => <span className="truncate font-medium">{g.nombre}</span>, ordenar: (g) => g.nombre.toLowerCase(), titleDe: (g) => g.nombre },
    { id: 'registros', titulo: 'Registros', ancho: 100, alinear: 'der', celda: (g) => <span className="num">{fmtEntero(g.registros)}</span>, ordenar: (g) => g.registros },
    { id: 'valor', titulo: 'Valor póliza', ancho: 150, alinear: 'der', celda: (g) => <span className="num">{fmtDinero(g.valor)}</span>, ordenar: (g) => g.valor },
    { id: 'pesoValor', titulo: 'Peso valor', ancho: 90, alinear: 'der', celda: (g) => <span className="num">{fmtPct(g.pesoValor * 100)}</span>, ordenar: (g) => g.pesoValor },
    { id: 'prima', titulo: 'Prima', ancho: 150, alinear: 'der', celda: (g) => <span className="num">{fmtDinero(g.prima)}</span>, ordenar: (g) => g.prima },
    { id: 'pesoPrima', titulo: 'Peso prima', ancho: 90, alinear: 'der', celda: (g) => <span className="num">{fmtPct(g.pesoPrima * 100)}</span>, ordenar: (g) => g.pesoPrima },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {DIMENSIONES.map((d) => (
          <Boton key={d.id} variante={dim === d.id ? 'primario' : 'secundario'} className="justify-center" onClick={() => setDim(d.id)} aria-pressed={dim === d.id}>
            {d.texto}
          </Boton>
        ))}
      </div>

      <DashCard
        titulo={`${MEDIDAS.find((m) => m.id === medida)!.texto} por ${info.texto.toLowerCase()}`}
        subtitulo={`${fmtEntero(grupos.length)} ${grupos.length === 1 ? 'grupo' : 'grupos'} · los 15 mayores · toque una barra para filtrar todo el tablero`}
        accion={
          <div className="flex gap-1.5">
            {MEDIDAS.map((m) => (
              <Chip key={m.id} activo={medida === m.id} onClick={() => setMedida(m.id)}>{m.texto}</Chip>
            ))}
          </div>
        }
      >
        <RankingBarras
          filas={ranking}
          seleccionado={sel}
          onTap={tocar}
          formato={medida === 'registros' ? fmtEntero : fmtPesosCompacto}
          mostrarPct
          maxFilas={15}
        />
      </DashCard>

      <DashCard titulo={`Detalle por ${info.texto.toLowerCase()}`} subtitulo="Todas las filas. Toque el encabezado para ordenar y una fila para filtrar.">
        <div className="h-[460px]">
          <Tabla
            filas={grupos}
            columnas={columnas}
            clave={(g) => g.nombre}
            alHacerClic={(g) => tocar(g.nombre)}
            altoFila={38}
            claveAnchos={`tablero-prod-${dim}`}
            ordenInicial={{ columna: medida === 'registros' ? 'registros' : medida, asc: false }}
            claseFila={(g) => (g.nombre === sel ? 'bg-navy-soft' : undefined)}
          />
        </div>
      </DashCard>
    </div>
  )
}
