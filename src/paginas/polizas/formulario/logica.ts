// Lógica pura del formulario de pólizas (réplica de
// lib/ui/pagina_formulario_polizas.dart). Sin React ni Supabase: se prueba
// con vitest en logica.test.ts.

import type { DatosPoliza } from '@/datos/polizas'
import { aFecha, aISO, sumarAnios } from '@/lib/fechas'
import { normalizarAlfanumerico } from '@/lib/filtros'
import type { Cliente, Poliza, Producto, Ramo } from '@/lib/tipos'

/** Margen para que 33,33333 + 33,33333 + 33,33334 no cuente como "más de 100%". */
export const TOLERANCIA_PORC = 1e-6
/** Medio centavo: margen al comparar Com. a distribuir contra Vlr. Com. + Com. fija. */
export const TOLERANCIA_DINERO = 0.005
/** Los porcentajes se digitan y guardan con hasta 5 decimales. */
export const DECIMALES_PORC = 5

/**
 * Rótulos del panel que muestra el cliente elegido para cotejarlo con la
 * póliza física: NIT (o el tipo de documento) y razón social (o nombre).
 */
export function rotulosCliente(c: { tipopers_cliente?: string | null; tipodoc_cliente?: string | null }): { documento: string; nombre: string } {
  const tipoDoc = (c.tipodoc_cliente ?? '').trim()
  const juridica = c.tipopers_cliente === 'J'
  return {
    documento: juridica || tipoDoc === 'NIT' ? 'NIT' : tipoDoc || 'Documento',
    nombre: juridica ? 'Razón social' : 'Nombre',
  }
}

/** Lo que el formulario necesita del cliente elegido (búsqueda, IA o la póliza). */
export type ClienteSel = Pick<Cliente, 'id' | 'nombre_cliente' | 'tipodoc_cliente' | 'doc_cliente'> & {
  /** 'J' (jurídica) o 'N' (natural); no viene cuando el cliente sale de una póliza ya guardada. */
  tipopers_cliente?: string | null
}

export interface EstadoForm {
  nro: string
  fIni: Date | null
  fFin: Date | null
  fExp: Date | null
  /** La F. fin la puso el cálculo automático (+1 año): se puede recalcular. */
  finAutomatica: boolean

  asegId: number | null
  ramoId: number | null
  productoId: number | null
  formaPagoId: number | null
  formaExpId: number | null

  cliente: ClienteSel | null
  bien: string
  vlrAseg: number | null
  intermediarioId: number | null

  prima: number | null
  valorPoliza: number | null
  vlrBaseCom: number | null

  porcCom: number | null
  vlrCom: number | null
  vlrComFija: number | null
  porcomAdic: number | null
  vlrComAdic: number | null
  comDistrib: number | null
  comAdicDistrib: number | null

  asesor1Id: number | null
  porcAsesor1: number | null
  asesor2Id: number | null
  porcAsesor2: number | null
  asesor3Id: number | null
  porcAsesor3: number | null
  agenciaId: number | null
  porcAgencia: number | null
  asesorAdId: number | null
  porcAsesorAd: number | null
  agenciaAdId: number | null
  porcAgenciaAd: number | null

  estadoId: string | null
  primaPagada: number | null
  obs: string
}

export function formVacio(): EstadoForm {
  return {
    nro: '',
    fIni: null,
    fFin: null,
    fExp: null,
    finAutomatica: false,
    asegId: null,
    ramoId: null,
    productoId: null,
    formaPagoId: null,
    formaExpId: null,
    cliente: null,
    bien: '',
    vlrAseg: null,
    intermediarioId: null,
    prima: null,
    valorPoliza: null,
    vlrBaseCom: null,
    porcCom: null,
    vlrCom: null,
    vlrComFija: null,
    porcomAdic: null,
    vlrComAdic: null,
    comDistrib: null,
    comAdicDistrib: null,
    asesor1Id: null,
    porcAsesor1: null,
    asesor2Id: null,
    porcAsesor2: null,
    asesor3Id: null,
    porcAsesor3: null,
    agenciaId: null,
    porcAgencia: null,
    asesorAdId: null,
    porcAsesorAd: null,
    agenciaAdId: null,
    porcAgenciaAd: null,
    estadoId: null,
    primaPagada: null,
    obs: '',
  }
}

// ── Cálculos ────────────────────────────────────────────────────────────────

/** Dinero a 2 decimales, igual que lo dejaba el campo de Flutter al formatearlo. */
export const r2 = (n: number) => Number(n.toFixed(2))

/**
 * Vlr. Com. = Vlr. Base Com. × % Com. y se sugiere Com. a distribuir =
 * Vlr. Com. + Com. fija.
 */
export function recalcularComision(f: EstadoForm): EstadoForm {
  const vlrCom = r2((f.vlrBaseCom ?? 0) * ((f.porcCom ?? 0) / 100))
  return { ...f, vlrCom, comDistrib: r2(vlrCom + (f.vlrComFija ?? 0)) }
}

/** Cambia la prima: la base de comisión pasa a ser la prima y se recalcula. */
export function conPrima(f: EstadoForm, prima: number | null): EstadoForm {
  return recalcularComision({ ...f, prima, vlrBaseCom: r2(prima ?? 0) })
}

/** Al elegir ramo la base vuelve a ser la prima (igual que Flutter). */
export function aplicarDefaultsRamo(f: EstadoForm): EstadoForm {
  return conPrima(f, f.prima)
}

/** Al elegir producto se toman su % de comisión y su % adicional (si los tiene). */
export function aplicarDefaultsProducto(f: EstadoForm, p: Pick<Producto, 'porccom_prod' | 'porcad_prod'>): EstadoForm {
  const g = { ...f }
  if (p.porccom_prod != null) g.porcCom = p.porccom_prod
  if (p.porcad_prod != null) g.porcomAdic = p.porcad_prod
  return recalcularComision(g)
}

/** Vlr. Com. o Com. fija digitados a mano: se vuelve a sugerir la Com. a distribuir. */
export function sugerirComDistrib(f: EstadoForm): EstadoForm {
  return { ...f, comDistrib: r2((f.vlrCom ?? 0) + (f.vlrComFija ?? 0)) }
}

/** Valor que le corresponde a un participante (asesor/agencia) según la base y su %. */
export const vlrParticipante = (base: number | null, porc: number | null) => (base ?? 0) * ((porc ?? 0) / 100)

export const sumaPorcPrincipal = (f: EstadoForm) =>
  (f.porcAsesor1 ?? 0) + (f.porcAsesor2 ?? 0) + (f.porcAsesor3 ?? 0) + (f.porcAgencia ?? 0)

export const sumaPorcAdicional = (f: EstadoForm) => (f.porcAsesorAd ?? 0) + (f.porcAgenciaAd ?? 0)

export const excede100 = (total: number) => total > 100 + TOLERANCIA_PORC

/** F. fin = F. inicio + 1 año, solo si está vacía o la había puesto este mismo cálculo. */
export function sugerirFin(f: EstadoForm, inicio: Date | null): EstadoForm {
  if (!inicio) return f
  if (f.fFin && !f.finAutomatica) return f
  return { ...f, fFin: sumarAnios(inicio, 1), finAutomatica: true }
}

/** Número de póliza con guiones en lugar de espacios ("1 0987 2" → "1-0987-2"). */
export const formatearNroPoliza = (s: string) => s.trim().replace(/\s+/g, '-')

/**
 * ¿Hay que verificar si el número está repetido? Siempre en una póliza
 * nueva; al editar, solo si cambió el número (sin contar separadores) o la
 * aseguradora (la unicidad es por aseguradora).
 */
export function debeVerificarNro(
  nro: string,
  asegId: number | null,
  original: { nro: string; asegId: number | null } | null,
): boolean {
  if (!nro.trim()) return false
  if (!original) return true
  return normalizarAlfanumerico(nro) !== normalizarAlfanumerico(original.nro) || asegId !== original.asegId
}

// ── Cascada Aseguradora → Ramo → Producto ───────────────────────────────────

/**
 * Ramos con al menos un producto activo de la aseguradora elegida. Sin
 * aseguradora, todos. [ramoActualId] se conserva en la lista (al cargar una
 * póliza guardada); al cambiar de aseguradora a mano NO se pasa, para que el
 * ramo de la aseguradora anterior se limpie. Si la aseguradora no tiene
 * productos, se muestran todos para no bloquear el formulario.
 */
export function ramosDisponibles(
  ramos: Ramo[],
  productosActivos: Pick<Producto, 'aseguradora_id' | 'ramo_id'>[],
  asegId: number | null,
  ramoActualId: number | null = null,
): Ramo[] {
  if (asegId == null) return ramos
  const ids = new Set(productosActivos.filter((p) => p.aseguradora_id === asegId).map((p) => p.ramo_id))
  if (ramoActualId != null) ids.add(ramoActualId)
  const filtrados = ramos.filter((r) => ids.has(r.id))
  return filtrados.length ? filtrados : ramos
}

/**
 * Productos activos del ramo y la aseguradora. El producto ya elegido se
 * conserva aunque esté inactivo si pertenece a ese ramo y aseguradora.
 */
export function productosDisponibles(
  productos: Producto[],
  ramoId: number | null,
  asegId: number | null,
  productoActualId: number | null,
): Producto[] {
  if (ramoId == null || asegId == null) return []
  const lista = productos.filter((p) => p.estado_prod && p.ramo_id === ramoId && p.aseguradora_id === asegId)
  if (productoActualId != null && !lista.some((p) => p.id === productoActualId)) {
    const actual = productos.find((p) => p.id === productoActualId)
    if (actual && actual.ramo_id === ramoId && actual.aseguradora_id === asegId) lista.push(actual)
  }
  return lista
}

/** Cambio manual de aseguradora: limpia el ramo si no aplica y siempre el producto. */
export function cambiarAseguradora(
  f: EstadoForm,
  asegId: number | null,
  ramosActivos: Ramo[],
  productosActivos: Producto[],
): EstadoForm {
  const lista = ramosDisponibles(ramosActivos, productosActivos, asegId)
  const ramoId = f.ramoId != null && lista.some((r) => r.id === f.ramoId) ? f.ramoId : null
  return { ...f, asegId, ramoId, productoId: null }
}

/** Activos + el que ya tenga la póliza aunque esté inactivo (para no perder el dato). */
export function activosMasSeleccionados<T extends { id: number | string }>(
  todos: T[],
  activo: (x: T) => boolean,
  seleccionados: (number | string | null | undefined)[],
): T[] {
  const sel = new Set(seleccionados.filter((x) => x != null))
  return todos.filter((x) => activo(x) || sel.has(x.id))
}

// ── Validación ──────────────────────────────────────────────────────────────

export type CampoForm =
  | 'nro'
  | 'fIni'
  | 'fFin'
  | 'fExp'
  | 'aseg'
  | 'ramo'
  | 'producto'
  | 'formaPago'
  | 'cliente'
  | 'bien'
  | 'comDistrib'
  | 'asesor1'
  | 'porcPrincipal'
  | 'porcAdicional'

export interface ErrorCampo {
  campo: CampoForm
  /** Texto corto bajo el campo. */
  mensaje: string
  /** Texto completo para el aviso emergente. */
  detalle: string
}

const fmt2 = (n: number) => n.toFixed(2).replace('.', ',')
const dinero2 = (n: number) =>
  '$ ' + new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

/** Todas las validaciones de "Guardar", en el orden en que aparecen en pantalla. */
export function validar(f: EstadoForm): ErrorCampo[] {
  const e: ErrorCampo[] = []
  const req = (campo: CampoForm, nombre: string, ok: boolean) => {
    if (!ok) e.push({ campo, mensaje: 'Obligatorio', detalle: `El campo ${nombre} es obligatorio.` })
  }

  if (!f.fFin) req('fFin', 'Fecha fin', false)
  else if (f.fIni && f.fFin < f.fIni)
    e.push({
      campo: 'fFin',
      mensaje: 'Es anterior a la fecha de inicio',
      detalle: 'La fecha fin no puede ser anterior a la fecha inicio.',
    })
  req('aseg', 'Aseguradora', f.asegId != null)
  req('ramo', 'Ramo', f.ramoId != null)
  req('producto', 'Producto', f.productoId != null)
  req('formaPago', 'Forma de pago', f.formaPagoId != null)
  req('cliente', 'Cliente', f.cliente != null)
  req('bien', 'Bien asegurado', !!f.bien.trim())

  const maxDistrib = (f.vlrCom ?? 0) + (f.vlrComFija ?? 0)
  if ((f.comDistrib ?? 0) > maxDistrib + TOLERANCIA_DINERO)
    e.push({
      campo: 'comDistrib',
      mensaje: 'Supera Vlr. Com. + Com. fija',
      detalle:
        `La Com. a distribuir (${dinero2(f.comDistrib ?? 0)}) no puede ser mayor a ` +
        `Vlr. Com. + Com. fija (${dinero2(maxDistrib)}).`,
    })

  req('asesor1', 'Asesor 1', f.asesor1Id != null)

  const principal = sumaPorcPrincipal(f)
  if (excede100(principal))
    e.push({
      campo: 'porcPrincipal',
      mensaje: `Suman ${fmt2(principal)}%`,
      detalle: `La suma de % de comisiones (Asesor 1 + 2 + 3 + Agencia) es ${fmt2(principal)}% y supera el 100%.`,
    })
  const adicional = sumaPorcAdicional(f)
  if (excede100(adicional))
    e.push({
      campo: 'porcAdicional',
      mensaje: `Suman ${fmt2(adicional)}%`,
      detalle: `La suma de % adicionales (Asesor adic. + Agencia adic.) es ${fmt2(adicional)}% y supera el 100%.`,
    })
  return e
}

// ── Conversión a/desde la base ──────────────────────────────────────────────

const idValido = (v: number | null | undefined) => (v == null || v <= 0 ? null : v)
const textoONull = (s: string) => (s.trim() ? s.trim() : null)

/** Mismo mapa que arma Flutter para insertar/actualizar (y para el borrador). */
export function mapaActual(f: EstadoForm, usuarioId: number | null): DatosPoliza {
  return {
    nro_poliza: f.nro.trim() ? formatearNroPoliza(f.nro) : null,
    cliente_id: idValido(f.cliente?.id),
    asesor_id: idValido(f.asesor1Id),
    intermediario_id: idValido(f.intermediarioId),
    ramo_id: idValido(f.ramoId),
    producto_id: idValido(f.productoId),
    fexp_poliza: aISO(f.fExp),
    fini_poliza: aISO(f.fIni),
    ffin_poliza: aISO(f.fFin),
    prima_poliza: f.prima ?? 0,
    valor_poliza: f.valorPoliza ?? 0,
    vlraseg_poliza: f.vlrAseg,
    vlrbasecom_poliza: f.vlrBaseCom,
    porccom_poliza: f.porcCom,
    porcom_agencia: f.porcAgencia,
    vlrcom_poliza: f.vlrCom,
    vlrcomfija_poliza: f.vlrComFija,
    porcomadic_poliza: f.porcomAdic,
    vlrcomadic_poliza: f.vlrComAdic,
    porcom_asesor1: f.porcAsesor1,
    agencia_id: idValido(f.agenciaId),
    forma_pago_id: idValido(f.formaPagoId),
    estado_poliza_id: f.estadoId,
    vlrprimapagada_poliza: f.primaPagada,
    asesor2_id: idValido(f.asesor2Id),
    porcom_asesor2: f.porcAsesor2,
    asesor3_id: idValido(f.asesor3Id),
    porcom_asesor3: f.porcAsesor3,
    asesorad_id: idValido(f.asesorAdId),
    porcom_asesorad: f.porcAsesorAd,
    agenciaad_id: idValido(f.agenciaAdId),
    porcom_agenciaad: f.porcAgenciaAd,
    bien_asegurado: textoONull(f.bien),
    obs_poliza: textoONull(f.obs),
    formaexp_id: idValido(f.formaExpId),
    aseg_id: idValido(f.asegId),
    usuario_id: usuarioId,
  }
}

/**
 * Datos para actualizar una póliza existente: no cambia quién la creó, y
 * el estado y la prima pagada solo se envían si el usuario los cambió (la
 * base los recalcula con los abonos; no se deben pisar).
 */
export function datosParaActualizar(
  mapa: DatosPoliza,
  original: { estadoId: string | null; primaPagada: number | null },
): DatosPoliza {
  const d = { ...mapa }
  delete d.usuario_id
  if ((d.estado_poliza_id ?? null) === original.estadoId) delete d.estado_poliza_id
  if ((d.vlrprimapagada_poliza ?? null) === original.primaPagada) delete d.vlrprimapagada_poliza
  return d
}

/** Formulario lleno con una póliza guardada (edición). */
export function desdePoliza(p: Poliza): EstadoForm {
  return {
    ...formVacio(),
    nro: p.nro_poliza ?? '',
    fIni: aFecha(p.fini_poliza),
    fFin: aFecha(p.ffin_poliza),
    fExp: aFecha(p.fexp_poliza),
    asegId: p.aseg_id,
    ramoId: p.ramo_id,
    productoId: p.producto_id,
    formaPagoId: p.forma_pago_id,
    formaExpId: p.formaexp_id,
    cliente:
      p.cliente_id != null
        ? { id: p.cliente_id, nombre_cliente: p.nombre_cliente ?? `Cliente ${p.cliente_id}`, tipodoc_cliente: p.tipodoc_cliente, doc_cliente: p.doc_cliente }
        : null,
    bien: p.bien_asegurado ?? '',
    vlrAseg: p.vlraseg_poliza,
    intermediarioId: p.intermediario_id,
    prima: p.prima_poliza,
    valorPoliza: p.valor_poliza,
    vlrBaseCom: p.vlrbasecom_poliza,
    porcCom: p.porccom_poliza,
    vlrCom: p.vlrcom_poliza,
    vlrComFija: p.vlrcomfija_poliza,
    porcomAdic: p.porcomadic_poliza,
    vlrComAdic: p.vlrcomadic_poliza,
    comDistrib: r2((p.vlrcom_poliza ?? 0) + (p.vlrcomfija_poliza ?? 0)),
    comAdicDistrib: p.vlrcomadic_poliza,
    asesor1Id: p.asesor_id,
    porcAsesor1: p.porcom_asesor1,
    asesor2Id: p.asesor2_id,
    porcAsesor2: p.porcom_asesor2,
    asesor3Id: p.asesor3_id,
    porcAsesor3: p.porcom_asesor3,
    agenciaId: p.agencia_id,
    porcAgencia: p.porcom_agencia,
    asesorAdId: p.asesorad_id,
    porcAsesorAd: p.porcom_asesorad,
    agenciaAdId: p.agenciaad_id,
    porcAgenciaAd: p.porcom_agenciaad,
    estadoId: p.estado_poliza_id,
    primaPagada: p.vlrprimapagada_poliza,
    obs: p.obs_poliza ?? '',
  }
}

const numJson = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v))
  return Number.isFinite(n) ? n : null
}
const intJson = (v: unknown): number | null => {
  const n = numJson(v)
  return n == null ? null : Math.trunc(n)
}
const strJson = (v: unknown): string => (typeof v === 'string' ? v : '')

/**
 * Retoma un borrador ("Guardar borrador" guarda el mismo mapa que se envía
 * a `polizas`). Pisa los valores por defecto de una póliza nueva, salvo
 * forma de pago y estado, que solo cambian si el borrador los trae.
 * Devuelve también el id del cliente, que hay que traer de la base.
 */
export function desdeBorrador(
  base: EstadoForm,
  datos: Record<string, unknown>,
  productos: Pick<Producto, 'id' | 'aseguradora_id'>[],
): { form: EstadoForm; clienteId: number | null } {
  const productoId = intJson(datos.producto_id)
  let asegId = intJson(datos.aseg_id)
  if (asegId == null && productoId != null) asegId = productos.find((p) => p.id === productoId)?.aseguradora_id ?? null
  const vlrCom = numJson(datos.vlrcom_poliza)
  const vlrComFija = numJson(datos.vlrcomfija_poliza)
  const formaPagoId = intJson(datos.forma_pago_id)
  const estadoId = typeof datos.estado_poliza_id === 'string' ? datos.estado_poliza_id : null
  const form: EstadoForm = {
    ...base,
    nro: strJson(datos.nro_poliza),
    bien: strJson(datos.bien_asegurado),
    vlrAseg: numJson(datos.vlraseg_poliza),
    prima: numJson(datos.prima_poliza),
    valorPoliza: numJson(datos.valor_poliza),
    vlrBaseCom: numJson(datos.vlrbasecom_poliza),
    porcCom: numJson(datos.porccom_poliza),
    porcAgencia: numJson(datos.porcom_agencia),
    vlrCom,
    vlrComFija,
    comDistrib: r2((vlrCom ?? 0) + (vlrComFija ?? 0)),
    comAdicDistrib: numJson(datos.vlrcomadic_poliza),
    porcomAdic: numJson(datos.porcomadic_poliza),
    vlrComAdic: numJson(datos.vlrcomadic_poliza),
    porcAsesor1: numJson(datos.porcom_asesor1),
    porcAsesor2: numJson(datos.porcom_asesor2),
    porcAsesor3: numJson(datos.porcom_asesor3),
    porcAsesorAd: numJson(datos.porcom_asesorad),
    porcAgenciaAd: numJson(datos.porcom_agenciaad),
    primaPagada: numJson(datos.vlrprimapagada_poliza),
    obs: strJson(datos.obs_poliza),
    fExp: aFecha(typeof datos.fexp_poliza === 'string' ? datos.fexp_poliza : null),
    fIni: aFecha(typeof datos.fini_poliza === 'string' ? datos.fini_poliza : null),
    fFin: aFecha(typeof datos.ffin_poliza === 'string' ? datos.ffin_poliza : null),
    finAutomatica: false,
    intermediarioId: intJson(datos.intermediario_id),
    formaExpId: intJson(datos.formaexp_id),
    asesor1Id: intJson(datos.asesor_id),
    asesor2Id: intJson(datos.asesor2_id),
    asesor3Id: intJson(datos.asesor3_id),
    asesorAdId: intJson(datos.asesorad_id),
    agenciaId: intJson(datos.agencia_id),
    agenciaAdId: intJson(datos.agenciaad_id),
    productoId,
    ramoId: intJson(datos.ramo_id),
    asegId,
    formaPagoId: formaPagoId ?? base.formaPagoId,
    estadoId: estadoId ?? base.estadoId,
    cliente: null,
  }
  return { form, clienteId: intJson(datos.cliente_id) }
}

/**
 * Nombre sugerido para renombrar el archivo de la póliza:
 * "código - nombre original del archivo".
 */
export const nombreArchivoSugerido = (id: number, archivo: string | null | undefined) =>
  archivo ? `${id} - ${archivo}` : null
