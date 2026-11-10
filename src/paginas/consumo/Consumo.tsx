import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Activity, Coins, Database, FileText, RefreshCw, Settings2, Sparkles } from 'lucide-react'
import { Contenido, EncabezadoPagina } from '@/components/layout/AppShell'
import { Aviso, Cargando, Chip, MensajeError } from '@/components/ui/basicos'
import { Boton } from '@/components/ui/button'
import { Campo, Input, SelectorSimple } from '@/components/ui/campos'
import { Dialogo } from '@/components/ui/dialogo'
import { CLAVE_CONSUMO, guardarConfig, useConfigConsumo, useConsumo, useServicios, type PrecioIA } from '@/datos/consumo'
import {
  LIMITE_ARCHIVOS_BYTES,
  LIMITE_BASE_BYTES,
  NOMBRE_PERIODO,
  agruparPor,
  cubetas,
  fmtBytes,
  fmtCop,
  fmtTokens,
  fmtUsd,
  nombreFuncion,
  nombreTipo,
  proyeccionMes,
  rangoDePeriodo,
  rangoValido,
  totales,
  type Periodo,
  type Rango,
} from '@/datos/consumoLogica'
import { mensajeAmigable } from '@/lib/errores'
import { DashColors } from '@/paginas/dashboard/colores'
import { DashCard, GraficoColumnas, KpiTile, RankingBarras, Rejilla, SinDatos } from '@/paginas/dashboard/graficos'

const PERIODOS: Periodo[] = ['hoy', 'ayer', '7d', '30d', 'mes', 'mes_pasado', 'anio', 'personalizado']
const FUNCIONES = ['extraer-poliza', 'extraer-reporte-pago']

/**
 * Consumo de IA (solo Administrador): cuántos archivos se leen, de qué tipo,
 * cuántos tokens usan y cuánto cuestan aproximadamente, por día o por mes.
 * El costo es una ESTIMACIÓN con los precios de referencia que se editan aquí;
 * el valor real es el de la factura de Google.
 */
export default function Consumo() {
  const qc = useQueryClient()
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [propio, setPropio] = useState<Rango>(() => rangoDePeriodo('30d'))
  const [por, setPor] = useState<'dia' | 'mes'>('dia')
  const [verPrecios, setVerPrecios] = useState(false)

  const rango = periodo === 'personalizado' ? propio : rangoDePeriodo(periodo)
  const errorRango = rangoValido(rango)
  const consumo = useConsumo(rango, !errorRango)
  const config = useConfigConsumo()
  const servicios = useServicios()

  const filas = useMemo(() => consumo.data ?? [], [consumo.data])
  const trm = config.data?.trm ?? 4000
  const t = useMemo(() => totales(filas), [filas])
  const barras = useMemo(() => cubetas(filas, rango, por), [filas, rango, por])
  const porFuncion = useMemo(() => agruparPor(filas, (f) => nombreFuncion(f.funcion)), [filas])
  const porTipo = useMemo(() => agruparPor(filas, (f) => nombreTipo(f.tipoArchivo)), [filas])
  const porUsuario = useMemo(() => agruparPor(filas, (f) => f.usuario), [filas])
  const proyeccion = proyeccionMes(t.costoUsd, rango)
  const promedio = t.lecturas > 0 ? t.costoUsd / t.lecturas : 0
  const fallidas = t.llamadas - t.exitosas
  const sinRegistros = !consumo.isPending && !consumo.isError && filas.length === 0

  const refrescar = () => void qc.invalidateQueries({ queryKey: CLAVE_CONSUMO })

  return (
    <div className="flex h-full flex-col">
      <EncabezadoPagina
        titulo="Consumo de IA y servicios"
        subtitulo="Cuánto se lee con IA y cuánto cuesta aproximadamente"
        volver="/"
        acciones={
          <>
            <Boton variante="secundario" tamano="sm" onClick={() => setVerPrecios(true)}>
              <Settings2 />
              Precios
            </Boton>
            <Boton variante="fantasma" tamano="icono" title="Actualizar" onClick={refrescar} disabled={consumo.isFetching}>
              <RefreshCw className={consumo.isFetching ? 'animate-spin' : ''} />
            </Boton>
          </>
        }
      />
      <Contenido className="flex max-w-6xl flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {PERIODOS.map((p) => (
            <Chip key={p} activo={periodo === p} onClick={() => setPeriodo(p)}>
              {NOMBRE_PERIODO[p]}
            </Chip>
          ))}
        </div>

        {periodo === 'personalizado' && (
          <div className="grid max-w-md grid-cols-2 gap-3">
            <Campo etiqueta="Desde">
              <Input type="date" value={propio.desde} onChange={(e) => setPropio({ ...propio, desde: e.target.value })} />
            </Campo>
            <Campo etiqueta="Hasta">
              <Input type="date" value={propio.hasta} onChange={(e) => setPropio({ ...propio, hasta: e.target.value })} />
            </Campo>
          </div>
        )}

        {errorRango ? (
          <Aviso tono="alerta">{errorRango}</Aviso>
        ) : consumo.isError ? (
          <MensajeError
            error={
              <div className="flex items-center gap-3">
                <span className="flex-1">
                  {mensajeAmigable(consumo.error, 'No se pudo cargar el consumo')} Si es la primera vez, falta aplicar la migración
                  <b> consumo_ia</b> en la base de datos.
                </span>
                <Boton tamano="sm" variante="secundario" onClick={() => void consumo.refetch()}>
                  Reintentar
                </Boton>
              </div>
            }
          />
        ) : consumo.isPending ? (
          <Cargando texto="Calculando el consumo…" />
        ) : (
          <>
            <Rejilla anchoMinimo={210}>
              <KpiTile
                etiqueta="Costo estimado"
                valor={fmtUsd(t.costoUsd)}
                valorExacto={`${t.costoUsd} USD`}
                icono={<Coins />}
                color={DashColors.real}
                pie={`≈ ${fmtCop(t.costoUsd, trm)} (TRM ${trm.toLocaleString('es-CO')})`}
              />
              <KpiTile
                etiqueta="Archivos leídos"
                valor={t.lecturas.toLocaleString('es-CO')}
                icono={<FileText />}
                color={DashColors.serie[0]}
                pie={t.reintentos > 0 ? `${t.reintentos} reintentos automáticos aparte` : 'sin reintentos'}
              />
              <KpiTile
                etiqueta="Costo por archivo"
                valor={t.lecturas > 0 ? fmtUsd(promedio) : '—'}
                icono={<Sparkles />}
                color={DashColors.serie[2]}
                pie={t.lecturas > 0 ? `≈ ${fmtCop(promedio, trm)}` : null}
              />
              <KpiTile
                etiqueta="Tokens usados"
                valor={fmtTokens(t.tokensEntrada + t.tokensSalida + t.tokensPensamiento)}
                icono={<Activity />}
                color={DashColors.serie[3]}
                pie={`entrada ${fmtTokens(t.tokensEntrada)} · salida ${fmtTokens(t.tokensSalida + t.tokensPensamiento)}`}
              />
            </Rejilla>

            {proyeccion != null && (
              <Aviso tono="navy">
                A este ritmo, el mes cerraría en unos <b>{fmtUsd(proyeccion)}</b> (≈ {fmtCop(proyeccion, trm)}).
              </Aviso>
            )}
            {fallidas > 0 && (
              <Aviso tono="alerta">
                {fallidas} {fallidas === 1 ? 'llamada no terminó' : 'llamadas no terminaron'} bien (documento muy largo, falta de crédito, error del servicio). Las que se
                cortaron igual consumieron tokens.
              </Aviso>
            )}
            {sinRegistros && (
              <Aviso tono="navy">
                No hay lecturas registradas en este período. El registro empieza a llenarse desde que se desplegaron las funciones
                <b> extraer-poliza</b> y <b>extraer-reporte-pago</b> con el seguimiento de consumo.
              </Aviso>
            )}

            <DashCard
              titulo={`Costo estimado por ${por === 'dia' ? 'día' : 'mes'} (US$)`}
              subtitulo="Cada barra suma las pólizas y los reportes de comisiones"
              accion={
                <div className="flex gap-1.5">
                  <Chip activo={por === 'dia'} onClick={() => setPor('dia')}>
                    Por día
                  </Chip>
                  <Chip activo={por === 'mes'} onClick={() => setPor('mes')}>
                    Por mes
                  </Chip>
                </div>
              }
            >
              <GraficoColumnas
                titulo="Costo estimado de IA"
                etiquetas={barras.map((b) => b.etiqueta)}
                series={FUNCIONES.map((f, i) => ({
                  nombre: nombreFuncion(f),
                  color: DashColors.serie[i],
                  valores: barras.map((b) => b.porFuncion[f]?.costoUsd ?? 0),
                }))}
                formato={(n) => fmtUsd(n)}
              />
            </DashCard>

            <DashCard titulo="Archivos leídos por día o mes" subtitulo="Sin contar los reintentos automáticos">
              <GraficoColumnas
                titulo="Archivos leídos"
                etiquetas={barras.map((b) => b.etiqueta)}
                series={FUNCIONES.map((f, i) => ({
                  nombre: nombreFuncion(f),
                  color: DashColors.serie[i],
                  valores: barras.map((b) => b.porFuncion[f]?.lecturas ?? 0),
                }))}
                formato={(n) => Math.round(n).toLocaleString('es-CO')}
              />
            </DashCard>

            <Rejilla anchoMinimo={340}>
              <DashCard titulo="Por tipo de lectura">
                {porFuncion.length === 0 ? (
                  <SinDatos />
                ) : (
                  <RankingBarras
                    filas={porFuncion.map((f, i) => ({
                      nombre: f.nombre,
                      valor: f.costoUsd,
                      valorTexto: fmtUsd(f.costoUsd),
                      detalle: `${f.lecturas} archivos · ${fmtTokens(f.tokensEntrada + f.tokensSalida + f.tokensPensamiento)} tokens`,
                      color: DashColors.serie[i],
                    }))}
                    formato={fmtUsd}
                  />
                )}
              </DashCard>
              <DashCard titulo="Por tipo de archivo">
                {porTipo.length === 0 ? (
                  <SinDatos />
                ) : (
                  <RankingBarras
                    filas={porTipo.map((f, i) => ({
                      nombre: `${f.nombre} (${f.lecturas})`,
                      valor: f.costoUsd,
                      valorTexto: fmtUsd(f.costoUsd),
                      color: DashColors.serie[i + 2],
                    }))}
                    formato={fmtUsd}
                  />
                )}
              </DashCard>
              <DashCard titulo="Por usuario">
                {porUsuario.length === 0 ? (
                  <SinDatos />
                ) : (
                  <RankingBarras
                    filas={porUsuario.map((f) => ({
                      nombre: `${f.nombre} (${f.lecturas})`,
                      valor: f.costoUsd,
                      valorTexto: fmtUsd(f.costoUsd),
                    }))}
                    formato={fmtUsd}
                  />
                )}
              </DashCard>
            </Rejilla>
          </>
        )}

        <OtrosServicios servicios={servicios} />
      </Contenido>

      {verPrecios && config.data && (
        <DialogoPrecios
          trm={config.data.trm}
          precios={config.data.precios}
          onCerrar={() => setVerPrecios(false)}
          onGuardado={() => {
            setVerPrecios(false)
            refrescar()
          }}
        />
      )}
    </div>
  )
}

function Barra({ valor, limite, etiqueta }: { valor: number; limite: number; etiqueta: string }) {
  const pct = Math.min(100, (valor / limite) * 100)
  const color = pct >= 90 ? DashColors.malo : pct >= 70 ? DashColors.alerta : DashColors.bueno
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12.5px]">
        <span className="font-semibold">{etiqueta}</span>
        <span className="text-ink-soft">
          {fmtBytes(valor)} de {fmtBytes(limite)} ({pct.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %)
        </span>
      </div>
      <div className="mt-1 h-2.5 rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `max(3px, ${pct}%)`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function OtrosServicios({ servicios }: { servicios: ReturnType<typeof useServicios> }) {
  const s = servicios.data
  return (
    <DashCard
      titulo="Otros servicios del software"
      subtitulo="Lo que se puede medir desde aquí, y lo que se revisa en cada proveedor"
      accion={<Database className="size-4 text-ink-soft" />}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="text-[13px] font-bold">Supabase (base de datos y archivos)</div>
          {servicios.isPending ? (
            <p className="text-[12.5px] text-ink-soft">Consultando…</p>
          ) : servicios.isError || !s ? (
            <p className="text-[12.5px] text-ink-soft">
              No se pudo medir. Si es la primera vez, falta aplicar la migración <b>consumo_ia</b>.
            </p>
          ) : (
            <>
              <Barra valor={s.dbBytes} limite={LIMITE_BASE_BYTES} etiqueta="Base de datos (plan gratuito: 500 MB)" />
              <Barra valor={s.storageBytes} limite={LIMITE_ARCHIVOS_BYTES} etiqueta="Archivos (plan gratuito: 1 GB)" />
              <p className="text-[12px] text-ink-soft">
                {s.polizas.toLocaleString('es-CO')} pólizas y {s.clientes.toLocaleString('es-CO')} clientes guardados.
              </p>
            </>
          )}
        </div>
        <ul className="flex flex-col gap-2 text-[12.5px]">
          <li>
            <b>Gemini (IA):</b> medido arriba. Compare con la factura en Google AI Studio → Billing.
          </li>
          <li>
            <b>Supabase:</b> el tráfico, las invocaciones de funciones y los usuarios activos se ven en el panel de Supabase → Usage.
          </li>
          <li>
            <b>GitHub (Pages y respaldo diario):</b> gratis dentro del plan; el uso está en GitHub → Settings → Billing.
          </li>
          <li>
            <b>datos.gov.co (Oportunidades SECOP):</b> gratuito, sin consumo que cobrar.
          </li>
        </ul>
      </div>
    </DashCard>
  )
}

function DialogoPrecios({
  trm,
  precios,
  onCerrar,
  onGuardado,
}: {
  trm: number
  precios: PrecioIA[]
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [modelo, setModelo] = useState(precios[0]?.modelo ?? 'default')
  const actual = precios.find((p) => p.modelo === modelo)
  const [trmTxt, setTrmTxt] = useState(String(trm))
  const [ent, setEnt] = useState(String(actual?.usdEntradaMillon ?? 0.3))
  const [cache, setCache] = useState(String(actual?.usdCacheMillon ?? 0.03))
  const [sal, setSal] = useState(String(actual?.usdSalidaMillon ?? 2.5))
  const [guardando, setGuardando] = useState(false)

  const n = (s: string) => Number(s.replace(',', '.'))
  const valido = [trmTxt, ent, cache, sal].every((x) => Number.isFinite(n(x)) && n(x) >= 0) && n(trmTxt) > 0 && modelo.trim() !== ''

  const elegir = (m: string) => {
    setModelo(m)
    const p = precios.find((x) => x.modelo === m)
    if (p) {
      setEnt(String(p.usdEntradaMillon))
      setCache(String(p.usdCacheMillon))
      setSal(String(p.usdSalidaMillon))
    }
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      await guardarConfig(n(trmTxt), { modelo: modelo.trim(), usdEntradaMillon: n(ent), usdCacheMillon: n(cache), usdSalidaMillon: n(sal) })
      toast.success('Precios guardados. El costo se recalcula con ellos.')
      onGuardado()
    } catch (e) {
      toast.error(mensajeAmigable(e, 'No se pudieron guardar los precios'))
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo="Precios para estimar el costo"
      descripcion="Dólares por millón de tokens. Tómelos de la tarifa vigente de Google AI Studio; el costo real es el de su factura."
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton onClick={() => void guardar()} disabled={!valido} cargando={guardando}>
            Guardar
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {precios.length > 1 && (
          <Campo etiqueta="Modelo">
            <SelectorSimple valor={modelo} onCambio={(v) => v && elegir(v)} opciones={precios.map((p) => ({ valor: p.modelo, etiqueta: p.modelo === 'default' ? 'default (cualquier modelo)' : p.modelo }))} />
          </Campo>
        )}
        {precios.length <= 1 && (
          <Campo etiqueta="Modelo" ayuda="'default' sirve para cualquier modelo. Escriba el nombre exacto si quiere un precio propio.">
            <Input value={modelo} onChange={(e) => setModelo(e.target.value)} />
          </Campo>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Campo etiqueta="Entrada (US$)">
            <Input inputMode="decimal" value={ent} onChange={(e) => setEnt(e.target.value)} />
          </Campo>
          <Campo etiqueta="Caché (US$)">
            <Input inputMode="decimal" value={cache} onChange={(e) => setCache(e.target.value)} />
          </Campo>
          <Campo etiqueta="Salida (US$)">
            <Input inputMode="decimal" value={sal} onChange={(e) => setSal(e.target.value)} />
          </Campo>
        </div>
        <p className="text-[12px] text-ink-soft">El "pensamiento" del modelo se cobra al precio de la salida.</p>
        <Campo etiqueta="Dólar (TRM) en pesos">
          <Input inputMode="decimal" value={trmTxt} onChange={(e) => setTrmTxt(e.target.value)} />
        </Campo>
      </div>
    </Dialogo>
  )
}
