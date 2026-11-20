// "Servidor" del modo demo: contesta en memoria las peticiones que la app le haría a Supabase
// (tablas, vistas, funciones de la base y funciones de IA simuladas). Solo se carga con VITE_DEMO=1.

import { normalizarAlfanumerico } from '@/lib/filtros'
import { FKS, crearTablas, type Tablas } from './datos'
import { filtrar, ordenar, proyectar, type Fila, type Mundo } from './postgrest'

const hoy = () => new Date()
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const suma = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

const T: Tablas = crearTablas(hoy())

const porId = (tabla: string) => new Map((T[tabla] ?? []).map((r) => [r.id, r]))

// ── Vistas (se calculan al pedirlas) ────────────────────────────────────────

function vistaPolizas(): Fila[] {
  const cli = porId('clientes'), ase = porId('asesores'), ram = porId('ramos'), pro = porId('productos'), seg = porId('aseguradoras')
  const int = porId('intermediarios'), fp = porId('formas_pago'), fe = porId('formaexp'), usu = porId('usuarios'), est = porId('estados_poliza')
  return T.polizas.filter((p) => p.eliminada_en == null).map((p) => {
    const c = cli.get(p.cliente_id), u = usu.get(p.usuario_id)
    return {
      ...p,
      nombre_cliente: c?.nombre_cliente ?? null, doc_cliente: c?.doc_cliente ?? null, tel_cliente: c?.tel_cliente ?? null, tipodoc_cliente: c?.tipodoc_cliente ?? null,
      nombre_asesor: ase.get(p.asesor_id)?.nombre_asesor ?? null, nombre_ramo: ram.get(p.ramo_id)?.nombre_ramo ?? null, nombre_prod: pro.get(p.producto_id)?.nombre_prod ?? null,
      nombre_aseg: seg.get(p.aseg_id)?.nombre_aseg ?? null, nombre_interm: int.get(p.intermediario_id)?.nombre_interm ?? null,
      nombre_forma_pago: fp.get(p.forma_pago_id)?.nombre_forma_pago ?? null, nombre_formaexp: fe.get(p.formaexp_id)?.nombre_formaexp ?? null,
      nombre_usuario: u?.nombre_usuario ?? null, apodo_usuario: u?.apodo_usuario ?? null, nombre_estado: est.get(p.estado_poliza_id)?.nombre_estado ?? null,
    }
  })
}

function vistaAbonos(): Fila[] {
  const pol = new Map(vistaPolizas().map((p) => [p.id, p])), cli = porId('clientes'), usu = porId('usuarios')
  return T.abonos_poliza.map((a) => {
    const p = pol.get(a.id_poliza) ?? {}
    const c = cli.get(p.cliente_id), u = usu.get(a.usuario_id)
    return {
      ...a, nro_poliza: p.nro_poliza ?? null, prima_poliza: p.prima_poliza ?? null, bien_asegurado: p.bien_asegurado ?? null, fini_poliza: p.fini_poliza ?? null,
      ffin_poliza: p.ffin_poliza ?? null, estado_poliza_id: p.estado_poliza_id ?? null, nombre_cliente: c?.nombre_cliente ?? null, doc_cliente: c?.doc_cliente ?? null,
      tipodoc_cliente: c?.tipodoc_cliente ?? null, tel_cliente: c?.tel_cliente ?? null, correo_cliente: c?.correo_cliente ?? null, dir_cliente: c?.dir_cliente ?? null,
      nombre_ramo: p.nombre_ramo ?? null, nombre_prod: p.nombre_prod ?? null, nombre_aseg: p.nombre_aseg ?? null, apodo_usuario: u?.apodo_usuario ?? null, nombre_usuario: u?.nombre_usuario ?? null,
    }
  })
}

function vistaReportes(): Fila[] {
  const seg = porId('aseguradoras'), int = porId('intermediarios')
  return T.reportes_pago.map((r) => {
    const ab = T.abonos_poliza.filter((a) => a.idrep_pago === r.id && a.estado_pago !== 'A')
    return {
      ...r, nombre_aseg: seg.get(r.aseg_id)?.nombre_aseg ?? null, nombre_interm: int.get(r.interm_id)?.nombre_interm ?? null, num_abonos: ab.length,
      vlrsumprima_rep: ab.reduce((s, a) => s + (a.vlrabono_prima as number), 0), vlrsumcom_rep: ab.reduce((s, a) => s + (a.vlrcomision as number) + (a.vlrcomad as number), 0),
    }
  })
}

const VISTAS: Record<string, () => Fila[]> = {
  vw_polizas_busqueda: vistaPolizas, vw_abonos_detalle: vistaAbonos, vw_reportes_resumen: vistaReportes, vw_polizas_duplicadas: () => [], vw_clientes_duplicados: () => [],
}

const mundo: Mundo = { fks: FKS, filas: (n) => (VISTAS[n] ? VISTAS[n]() : T[n] ?? null) }

// ── Funciones de la base (RPC) ──────────────────────────────────────────────

let siguienteId = 90_000
const ahora = () => new Date().toISOString()

function consumoIA(desde: string, hasta: string): Fila[] {
  const filas: Fila[] = []
  const d0 = new Date(desde), d1 = new Date(hasta)
  for (let d = d0, i = 0; d <= d1 && i < 400; d = suma(d, 1), i++) {
    if (d.getDay() === 0 || (i * 7) % 5 === 0) continue
    const lect = 2 + ((i * 3) % 7)
    filas.push({ dia: iso(d), funcion: 'extraer-poliza', tipo_archivo: 'pdf', modelo: 'gemini-3-flash', usuario_id: 3, usuario: 'CAROLINA', llamadas: lect, lecturas: lect, exitosas: lect, reintentos: i % 9 === 0 ? 1 : 0,
      tokens_entrada: lect * 5200, tokens_cache: lect * 1800, tokens_pensamiento: 0, tokens_salida: lect * 420, costo_usd: Number((lect * 0.0021).toFixed(4)) })
    if (i % 6 === 0) filas.push({ dia: iso(d), funcion: 'extraer-reporte-pago', tipo_archivo: 'xlsx', modelo: 'gemini-3-flash', usuario_id: 4, usuario: 'ANDRES', llamadas: 1, lecturas: 1, exitosas: 1, reintentos: 0,
      tokens_entrada: 9800, tokens_cache: 0, tokens_pensamiento: 0, tokens_salida: 3100, costo_usd: 0.0108 })
  }
  return filas
}

const RPC: Record<string, (a: Record<string, unknown>) => unknown> = {
  polizas_eliminacion_contar: () => 0,
  polizas_eliminacion_pendientes: () => [],
  polizas_eliminacion_historial: () => [],
  polizas_eliminacion_detalle: () => null,
  polizas_eliminacion_solicitar: () => ({ lote: 'demo', solicitadas: 0, omitidas: [] }),
  polizas_eliminacion_resolver: () => ({ resueltas: 0, omitidas: [] }),
  casos_revision_revalidar: () => 0,
  registrar_aprendizaje_producto: () => null,
  registrar_aprendizaje_intermediario: () => null,
  reforzar_aprendizaje_rol_cliente: () => null,
  fusionar_clientes: () => null,
  consumo_ia_resumen: (a) => consumoIA(String(a.p_desde), String(a.p_hasta)),
  consumo_ia_config: () => ({ trm: 4100, precios: [{ modelo: 'default', usd_entrada_millon: 0.3, usd_cache_millon: 0.03, usd_salida_millon: 2.5 }] }),
  consumo_ia_guardar_config: () => null,
  consumo_servicios: () => ({ db_bytes: 48_300_000, storage_bytes: 12_600_000, polizas: T.polizas.length, clientes: T.clientes.length }),
  poliza_marcar_origen: (a) => {
    const p = T.polizas.find((x) => x.id === a.p_poliza_id)
    if (p && p.origen == null) p.origen = a.p_origen
    return null
  },
  seguimiento_renovacion_guardar: (a) => {
    const id = a.p_poliza_id
    const fila = { poliza_id: id, estado: a.p_estado, nota: a.p_nota ?? null, proximo_contacto: a.p_proximo ?? null, usuario_id: 1, factualizado: ahora() }
    const i = T.seguimientos_renovacion.findIndex((x) => x.poliza_id === id)
    if (i >= 0) T.seguimientos_renovacion[i] = fila
    else T.seguimientos_renovacion.push(fila)
    T.seguimientos_renovacion_hist.push({ id: siguienteId++, poliza_id: id, estado: a.p_estado, nota: a.p_nota ?? null, usuario_id: 1, fcreado: ahora() })
    return null
  },
  config_empresa_guardar: (a) => {
    Object.assign(T.config_empresa[0], { nombre: a.p_nombre, nombre_corto: a.p_nombre_corto, eslogan: a.p_eslogan || T.config_empresa[0].eslogan, nit: a.p_nit, ciudad: a.p_ciudad, pais: a.p_pais || 'Colombia', celular: a.p_celular, correo: a.p_correo })
    return null
  },
  facturacion_config_guardar: () => null,
}

// ── Funciones de IA y login (simulados) ─────────────────────────────────────

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function funcion(nombre: string): Promise<unknown> {
  if (nombre === 'extraer-poliza') {
    await pausa(2600)
    const h = hoy()
    return {
      nro_poliza: '3001-4412099-0', nombre_cliente: 'María Fernanda Gómez Ruiz', doc_cliente: '63456789', nombre_asegurado: null, doc_asegurado: null, nombre_beneficiario: null, doc_beneficiario: null,
      nombre_aseguradora: 'SURA', nombre_ramo: 'LIVIANOS', nombre_producto: 'AUTOMOVILES TODO RIESGO', fecha_inicio: iso(h), fecha_fin: iso(new Date(h.getFullYear() + 1, h.getMonth(), h.getDate() - 1)),
      fecha_expedicion: iso(h), bien_asegurado: 'GHT581', prima: 2_380_000, valor_asegurado: 62_000_000, valor_poliza: 2_832_200,
    }
  }
  if (nombre === 'extraer-reporte-pago') {
    await pausa(3000)
    const h = hoy()
    const sura = vistaPolizas().filter((p) => p.aseg_id === 1 && p.estado_poliza_id === 'I' && Number(p.vlrprimapagada_poliza) === 0)
    const lineas = sura.slice(0, 4).map((p, i) => {
      const porc = Number(p.porccom_poliza)
      // El reporte trae el número base y el anexo por separado (el último segmento del número registrado).
      const segmentos = String(p.nro_poliza).split('-')
      const anexo = segmentos[segmentos.length - 1]
      const nucleo = segmentos.slice(0, -1).reduce((mayor, x) => (x.length > mayor.length ? x : mayor), '')
      return { nro_poliza: nucleo, anexo, doc_cliente: String(p.doc_cliente ?? '').replace(/\D/g, ''), nombre_cliente: p.nombre_cliente, nombre_ramo: p.nombre_ramo,
        vlrprima_poliza: p.prima_poliza, vlrabono_prima: p.prima_poliza, porccomision: porc, vlrcomision: Math.round((Number(p.prima_poliza) * porc) / 100), porccomad: null, vlrcomad: null,
        num_factura: `R-${88400 + i}`, fecha_pago: iso(suma(h, -(3 + i))) }
    })
    const prima = lineas.reduce((s, l) => s + Number(l.vlrabono_prima), 0)
    const com = lineas.reduce((s, l) => s + l.vlrcomision, 0)
    return {
      cabecera: { nombre_aseguradora: 'SURA', nombre_intermediario: '31022 - AGENCIA DEMO ASESORES', fecha_reporte: iso(h), fecha_inicio_periodo: iso(suma(h, -30)), fecha_fin_periodo: iso(suma(h, -1)), vlr_prima_total: prima, vlr_comision_total: com },
      lineas,
    }
  }
  return {}
}

// ── Atención de las peticiones ──────────────────────────────────────────────

const json = (cuerpo: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(status === 204 || status === 201 && cuerpo == null ? null : JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json', ...extra } })

const error = (status: number, message: string, code = 'DEMO') => json({ code, message, details: null, hint: null }, status)

function leerCabeceras(init?: RequestInit): Headers {
  return new Headers(init?.headers as HeadersInit | undefined)
}

function normalizarFila(tabla: string, fila: Fila): Fila {
  const r: Fila = { ...fila }
  const ahoraIso = ahora()
  if (r.id === undefined && !['seguimientos_renovacion', 'facturacion_config', 'config_empresa'].includes(tabla)) r.id = siguienteId++
  if (tabla === 'polizas') {
    r.nro_poliza_norm = r.nro_poliza ? normalizarAlfanumerico(String(r.nro_poliza)) : null
    r.fcreado ??= ahoraIso
    r.fultmod = ahoraIso
    r.vlrprimapagada_poliza ??= 0
    r.estado_poliza_id ??= 'I'
    r.eliminada_en ??= null
    r.origen ??= null
  }
  if (tabla === 'clientes') r.doc_cliente_norm = r.doc_cliente ? normalizarAlfanumerico(String(r.doc_cliente)) : null
  if (['polizas_pendientes', 'abonos_poliza', 'reportes_pago'].includes(tabla)) {
    r.fcreado ??= ahoraIso
    r.fultmod = ahoraIso
  }
  return r
}

export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  const metodo = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const cab = leerCabeceras(init)
  const cuerpoTexto = typeof init?.body === 'string' ? init.body : null
  const cuerpo = cuerpoTexto ? JSON.parse(cuerpoTexto) : null
  await pausa(30)

  // Funciones de borde (login e IA)
  let m = /\/functions\/v1\/([\w-]+)/.exec(url.pathname)
  if (m) {
    if (m[1] === 'login') {
      const u = T.usuarios.find((x) => String(x.apodo_usuario).toUpperCase() === String(cuerpo?.apodo ?? '').trim().toUpperCase())
      if (!u) return json({ error: 'Usuario o contraseña incorrectos.' }, 401)
      return json({ usuario: u, accessToken: 'demo', expiresAt: Math.floor(Date.now() / 1000) + 12 * 3600 })
    }
    return json(await funcion(m[1]))
  }

  // Funciones de la base
  m = /\/rest\/v1\/rpc\/([\w]+)/.exec(url.pathname)
  if (m) {
    const f = RPC[m[1]]
    if (!f) {
      console.warn('[demo] función de la base sin simular:', m[1])
      return json(null)
    }
    return json(f(cuerpo ?? {}) ?? null)
  }

  // Tablas y vistas
  m = /\/rest\/v1\/([\w]+)/.exec(url.pathname)
  if (!m) return error(404, 'Ruta no simulada en el demo')
  const tabla = m[1]
  const base = mundo.filas(tabla)
  if (!base) {
    console.warn('[demo] tabla sin simular:', tabla)
    return error(404, `Tabla ${tabla} no simulada`, 'PGRST205')
  }
  const prefer = cab.get('prefer') ?? ''
  const quiereFilas = prefer.includes('return=representation')
  const sel = url.searchParams.get('select')

  if (metodo === 'GET' || metodo === 'HEAD') {
    const filtradas = ordenar(filtrar(base, url.searchParams), url.searchParams)
    const total = filtradas.length
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limite = url.searchParams.get('limit') != null ? Number(url.searchParams.get('limit')) : Infinity
    const pagina = filtradas.slice(offset, offset + limite)
    const cabeceras: Record<string, string> = {}
    if (prefer.includes('count=')) cabeceras['content-range'] = total === 0 ? `*/${total}` : `${offset}-${offset + pagina.length - 1}/${total}`
    if (metodo === 'HEAD') return new Response(null, { status: 200, headers: cabeceras })
    const filas = proyectar(mundo, tabla, pagina, sel)
    if ((cab.get('accept') ?? '').includes('vnd.pgrst.object')) {
      if (filas.length !== 1) return json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${filas.length} rows`, hint: null }, 406)
      return json(filas[0], 200, cabeceras)
    }
    return json(filas, 200, cabeceras)
  }

  const fuente = T[tabla]
  if (!fuente) return error(405, 'Tabla de solo lectura en el demo')

  if (metodo === 'POST') {
    const entradas = (Array.isArray(cuerpo) ? cuerpo : [cuerpo]) as Fila[]
    const conflicto = url.searchParams.get('on_conflict')?.split(',') ?? null
    const guardadas: Fila[] = []
    for (const e of entradas) {
      const nueva = normalizarFila(tabla, e)
      const i = conflicto && prefer.includes('resolution') ? fuente.findIndex((x) => conflicto.every((c) => String(x[c]) === String(nueva[c]))) : -1
      if (i >= 0) {
        fuente[i] = { ...fuente[i], ...nueva }
        guardadas.push(fuente[i])
      } else {
        fuente.push(nueva)
        guardadas.push(nueva)
      }
    }
    if (!quiereFilas) return new Response(null, { status: 201 })
    const filas = proyectar(mundo, tabla, guardadas, sel)
    if ((cab.get('accept') ?? '').includes('vnd.pgrst.object')) return json(filas[0], 201)
    return json(filas, 201)
  }

  if (metodo === 'PATCH') {
    const objetivo = filtrar(fuente, url.searchParams)
    for (const r of objetivo) Object.assign(r, normalizarFila(tabla, { ...r, ...cuerpo }))
    if (!quiereFilas) return new Response(null, { status: 204 })
    return json(proyectar(mundo, tabla, objetivo, sel))
  }

  if (metodo === 'DELETE') {
    const objetivo = new Set(filtrar(fuente, url.searchParams))
    T[tabla] = fuente.filter((r) => !objetivo.has(r))
    return new Response(null, { status: 204 })
  }

  return error(405, 'Método no simulado')
}
