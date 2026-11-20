// Datos FICTICIOS del modo demo: una agencia inventada con clientes, pólizas, pagos y reportes de
// comisión. Todas las fechas se calculan a partir de "hoy", para que el semáforo de vencimientos y
// los gráficos se vean bien sin importar el día en que se abra el demo.

import { normalizarAlfanumerico } from '@/lib/filtros'
import type { Fila, Mundo } from './postgrest'

const DIA = 86_400_000
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const FKS: Mundo['fks'] = {
  polizas: { cliente_id: 'clientes', asesor_id: 'asesores', ramo_id: 'ramos', producto_id: 'productos', aseg_id: 'aseguradoras', intermediario_id: 'intermediarios', forma_pago_id: 'formas_pago', formaexp_id: 'formaexp', usuario_id: 'usuarios', estado_poliza_id: 'estados_poliza' },
  vw_polizas_busqueda: { cliente_id: 'clientes', asesor_id: 'asesores', ramo_id: 'ramos', producto_id: 'productos', aseg_id: 'aseguradoras', intermediario_id: 'intermediarios', forma_pago_id: 'formas_pago', formaexp_id: 'formaexp', usuario_id: 'usuarios', estado_poliza_id: 'estados_poliza' },
  clientes: { munic_id: 'municipio', asesor_id: 'asesores' },
  productos: { ramo_id: 'ramos', aseguradora_id: 'aseguradoras' },
  abonos_poliza: { id_poliza: 'polizas', idrep_pago: 'reportes_pago', idfactura: 'facturas' },
  reportes_pago: { aseg_id: 'aseguradoras', interm_id: 'intermediarios' },
  facturas: { aseg_id: 'aseguradoras', interm_id: 'intermediarios', empresa_id: 'facturas_empresas' },
  facturas_empresas: { aseg_id: 'aseguradoras' },
  seguimientos_renovacion: { poliza_id: 'polizas' },
  usuarios: { asesor_id: 'asesores' },
  casos_revision: { usuario_resuelve_id: 'usuarios' },
}

export type Tablas = Record<string, Fila[]>

export function crearTablas(hoy: Date): Tablas {
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const f = (n: number) => iso(new Date(h.getTime() + n * DIA)) // hoy + n días
  const ts = (n: number, hora = '10:15:00') => `${f(n)}T${hora}-05:00`
  const anios = (fecha: string, n: number) => `${Number(fecha.slice(0, 4)) + n}${fecha.slice(4)}`

  // ── Catálogos ──
  const aseguradoras: Fila[] = [
    { id: 1, nombre_aseg: 'SURA', nit_aseg: '890.903.407-9', clave: '31022', estado_aseg: true },
    { id: 2, nombre_aseg: 'SEGUROS DEL ESTADO', nit_aseg: '860.009.578-6', clave: '48117', estado_aseg: true },
    { id: 3, nombre_aseg: 'SOLIDARIA', nit_aseg: '860.524.654-6', clave: '20551', estado_aseg: true },
    { id: 4, nombre_aseg: 'MUNDIAL DE SEGUROS', nit_aseg: '860.037.013-6', clave: '77340', estado_aseg: true },
    { id: 5, nombre_aseg: 'BOLIVAR', nit_aseg: '860.002.503-2', clave: '10968', estado_aseg: true },
    { id: 6, nombre_aseg: 'INDEFINIDA', nit_aseg: null, clave: null, estado_aseg: true },
  ]
  const ramos: Fila[] = [
    [1, 'LIVIANOS'], [2, 'PESADOS'], [3, 'SOAT'], [4, 'CUMPLIMIENTO'], [5, 'HOGAR'], [6, 'VIDA'], [7, 'RESPONSABILIDAD CIVIL'], [8, 'ACCIDENTES PERSONALES'], [9, 'PYMES'],
  ].map(([id, nombre_ramo]) => ({ id, nombre_ramo, estado_ramo: true, obs_ramo: null, porcom_base_ramo: 15 }))
  const prod = (id: number, nombre_prod: string, ramo_id: number, aseguradora_id: number, porccom_prod: number) => ({
    id, nombre_prod, ramo_id, aseguradora_id, estado_prod: true, vlrfijocom_prod: null, porccom_prod, desc_prod: null, porcad_prod: null, obs_prod: null,
  })
  const productos: Fila[] = [
    prod(1, 'AUTOMOVILES TODO RIESGO', 1, 1, 12), prod(2, 'AUTOMOVILES', 1, 2, 10), prod(3, 'PESADOS', 2, 4, 10), prod(4, 'REC SOAT', 3, 6, 0),
    prod(5, 'CUMPLIMIENTO', 4, 3, 20), prod(6, 'CUMPLIMIENTO', 4, 2, 20), prod(7, 'POLIZA DE SEGURO HOGAR', 5, 5, 15),
    prod(8, 'VIDA GRUPO', 6, 1, 14), prod(9, 'RC PROFESIONAL', 7, 2, 15), prod(10, 'ACCIDENTES PERSONALES', 8, 3, 16), prod(11, 'PYME INTEGRAL', 9, 5, 15),
  ]
  const asesores: Fila[] = [
    { id: 1, nombre_asesor: 'Carolina Mejía', tipodoc_asesor: 'CC', doc_asesor: '63111001', tel_asesor: '3001110001', correo_asesor: 'carolina@agenciademo.co', porccom_asesor: 40, estado_asesor: true },
    { id: 2, nombre_asesor: 'Andrés Pardo', tipodoc_asesor: 'CC', doc_asesor: '91222002', tel_asesor: '3001110002', correo_asesor: 'andres@agenciademo.co', porccom_asesor: 40, estado_asesor: true },
    { id: 3, nombre_asesor: 'Luisa Rangel', tipodoc_asesor: 'CC', doc_asesor: '37333003', tel_asesor: '3001110003', correo_asesor: 'luisa@agenciademo.co', porccom_asesor: 35, estado_asesor: true },
  ]
  const usuarios: Fila[] = [
    { id: 1, apodo_usuario: 'ADMIN', nombre_usuario: 'Administrador Demo', rol: 'A', asesor_id: null, correo_usuario: 'admin@agenciademo.co', estado_usuario: true },
    { id: 2, apodo_usuario: 'SUPERVISOR', nombre_usuario: 'Sofía Quintero', rol: 'S', asesor_id: null, correo_usuario: 'sofia@agenciademo.co', estado_usuario: true },
    { id: 3, apodo_usuario: 'CAROLINA', nombre_usuario: 'Carolina Mejía', rol: 'D', asesor_id: 1, correo_usuario: 'carolina@agenciademo.co', estado_usuario: true },
    { id: 4, apodo_usuario: 'ANDRES', nombre_usuario: 'Andrés Pardo', rol: 'D', asesor_id: 2, correo_usuario: 'andres@agenciademo.co', estado_usuario: true },
  ]
  const intermediarios: Fila[] = [{ id: 1, nombre_interm: 'AGENCIA DEMO ASESORES', estado_interm: true }]
  const formas_pago: Fila[] = [[1, 'CONTADO'], [2, 'FINANCIADA'], [3, 'CUOTAS']].map(([id, nombre_forma_pago]) => ({ id, nombre_forma_pago, estado_forma_pago: true }))
  const formaexp: Fila[] = [[1, 'AGENCIA DEMO'], [2, 'ASEGURADORA']].map(([id, nombre_formaexp]) => ({ id, nombre_formaexp, desc_formaexp: null }))
  const municipio: Fila[] = [[1, 'Bucaramanga'], [2, 'Floridablanca'], [3, 'Girón'], [4, 'Piedecuesta'], [5, 'Bogotá']].map(([id, nombre_munic]) => ({ id, nombre_munic }))
  const estados_poliza: Fila[] = [['I', 'Incompleta'], ['C', 'Completa'], ['R', 'Revisada'], ['V', 'Vencida'], ['A', 'Anulada']].map(([id, nombre_estado]) => ({ id, nombre_estado, estado_activo: true }))

  // ── Clientes ──
  const cl = (id: number, nombre: string, tipo: 'J' | 'N', td: string, doc: string, tel: string, munic: number, asesor: number) => ({
    id, nombre_cliente: nombre, tipopers_cliente: tipo, tipodoc_cliente: td, doc_cliente: doc, doc_cliente_norm: normalizarAlfanumerico(doc), tel_cliente: tel,
    correo_cliente: `${nombre.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')}${id}@ejemplo.com`, dir_cliente: `Calle ${20 + id} # ${10 + id}-${30 + id}`,
    munic_id: munic, notas_cliente: null, contacto_cliente: null, cargocont_cliente: null, asesor_id: asesor, estado_cliente: true, recordar_cliente: true,
  })
  const clientes: Fila[] = [
    cl(1, 'CONSTRUCTORA ANDES SAS', 'J', 'NIT', '900456789-1', '3105550101', 1, 1),
    cl(2, 'TRANSPORTES DEL ORIENTE SAS', 'J', 'NIT', '901234567-8', '3105550102', 2, 2),
    cl(3, 'María Fernanda Gómez Ruiz', 'N', 'CC', '63456789', '3105550103', 1, 1),
    cl(4, 'Carlos Andrés Peña Silva', 'N', 'CC', '91234567', '3105550104', 3, 2),
    cl(5, 'INVERSIONES LA PRADERA SAS', 'J', 'NIT', '900987654-3', '3105550105', 1, 3),
    cl(6, 'Laura Valentina Ortiz Díaz', 'N', 'CC', '1098765432', '3105550106', 4, 3),
    cl(7, 'CLINICA SANTA MARIA SA', 'J', 'NIT', '890123456-7', '3105550107', 1, 1),
    cl(8, 'José Luis Barrera Mora', 'N', 'CC', '13890123', '3105550108', 2, 2),
    cl(9, 'COLEGIO NUEVO HORIZONTE', 'J', 'NIT', '800345678-2', '3105550109', 3, 3),
    cl(10, 'Diana Carolina Torres León', 'N', 'CC', '37890123', '3105550110', 1, 1),
    cl(11, 'FERRETERIA EL TORNILLO SAS', 'J', 'NIT', '901567890-4', '3105550111', 4, 2),
    cl(12, 'Andrea Milena Castro Vera', 'N', 'CC', '1100123456', '3105550112', 2, 3),
  ]

  // ── Pólizas ──
  interface Espec { cli: number; prod: number; bien: string; fin: number; prima: number; pagada?: number; nro?: string | null; asesor?: number; fp?: number; vlraseg?: number; estado?: string }
  const prodPor = new Map(productos.map((p) => [p.id as number, p]))
  const clientePor = new Map(clientes.map((c) => [c.id as number, c]))
  const specs: Espec[] = [
    // Vehículos (con placa): livianos y pesados
    { cli: 3, prod: 1, bien: 'ABC123', fin: 118, prima: 2_450_000, vlraseg: 58_000_000, nro: '3001-4410021-0' },
    { cli: 4, prod: 1, bien: 'KTL356', fin: 74, prima: 1_980_000, vlraseg: 46_000_000, nro: '3001-4410187-0' },
    { cli: 6, prod: 2, bien: 'DSR643', fin: 241, prima: 1_320_000, vlraseg: 39_000_000, nro: '48-40-101098765-0' },
    { cli: 8, prod: 1, bien: 'NQS607', fin: 29, prima: 2_870_000, vlraseg: 71_000_000, nro: '3001-4410552-0' },
    { cli: 10, prod: 1, bien: 'TUV482', fin: 12, prima: 1_640_000, vlraseg: 42_000_000, nro: '3001-4410611-0' },
    { cli: 12, prod: 2, bien: 'HJK914', fin: 5, prima: 1_150_000, vlraseg: 33_000_000, nro: '48-40-101099410-0', pagada: 0, estado: 'I' },
    { cli: 2, prod: 3, bien: 'SWZ911', fin: 21, prima: 5_900_000, vlraseg: 210_000_000, nro: '77-120-300012-0' },
    { cli: 2, prod: 3, bien: 'TRK205', fin: 150, prima: 6_400_000, vlraseg: 235_000_000, nro: '77-120-300013-0' },
    { cli: 1, prod: 3, bien: 'SXM330', fin: 190, prima: 7_250_000, vlraseg: 280_000_000, nro: '77-120-300147-0' },
    // Cumplimiento (constructora y otros)
    { cli: 1, prod: 5, bien: 'CONTRATO DE OBRA No. 014 DE 2026 - ADECUACION VIAL', fin: 42, prima: 3_820_000, nro: '400-47-994000112633-0' },
    { cli: 1, prod: 6, bien: 'CONTRATO DE OBRA No. 009 DE 2026 - ACUEDUCTO VEREDAL', fin: 96, prima: 2_640_000, nro: '96-44-101184287-1' },
    { cli: 1, prod: 5, bien: 'CONTRATO DE OBRA No. 021 DE 2025 - PUENTE PEATONAL', fin: -28, prima: 1_980_000, nro: '400-47-994000098120-0', pagada: 1_980_000 },
    { cli: 5, prod: 6, bien: 'CONTRATO DE SUMINISTRO No. 033 DE 2026', fin: 63, prima: 1_240_000, nro: '96-44-101185440-0' },
    { cli: 11, prod: 5, bien: 'CONTRATO DE COMPRAVENTA No. 007 DE 2026', fin: 8, prima: 860_000, nro: '400-47-994000115002-0' },
    // Hogar, vida, RC, accidentes, pymes
    { cli: 3, prod: 7, bien: 'CASA CALLE 45 # 20-31 BUCARAMANGA', fin: 205, prima: 780_000, vlraseg: 180_000_000, nro: '1002-88410-0' },
    { cli: 10, prod: 7, bien: 'APARTAMENTO TORRE 3 CARRERA 27 # 50-12', fin: 33, prima: 640_000, vlraseg: 150_000_000, nro: '1002-88532-0' },
    { cli: 7, prod: 8, bien: 'GRUPO DE 85 EMPLEADOS', fin: 160, prima: 9_800_000, nro: '330-1-0012245-0' },
    { cli: 7, prod: 9, bien: 'RC PROFESIONAL MEDICA - 42 MEDICOS', fin: 57, prima: 6_150_000, nro: '48-70-101003114-0' },
    { cli: 9, prod: 10, bien: '640 ESTUDIANTES', fin: 17, prima: 3_300_000, nro: '400-37-994000021880-0' },
    { cli: 11, prod: 11, bien: 'LOCAL COMERCIAL CARRERA 15 # 33-40', fin: 130, prima: 1_420_000, vlraseg: 95_000_000, nro: '1002-90011-0' },
    { cli: 5, prod: 7, bien: 'FINCA LA PRADERA - VEREDA EL ROSAL', fin: 280, prima: 1_150_000, vlraseg: 260_000_000, nro: '1002-88777-0' },
    // Históricas (años anteriores) para que los gráficos tengan recorrido
    { cli: 3, prod: 1, bien: 'ABC123', fin: -247, prima: 2_210_000, nro: '3001-4390001-0', pagada: 2_210_000 },
    { cli: 4, prod: 1, bien: 'KTL356', fin: -291, prima: 1_850_000, nro: '3001-4390104-0', pagada: 1_850_000 },
    { cli: 8, prod: 1, bien: 'NQS607', fin: -336, prima: 2_600_000, nro: '3001-4380877-0', pagada: 2_600_000 },
    { cli: 1, prod: 5, bien: 'CONTRATO DE OBRA No. 004 DE 2025', fin: -420, prima: 2_100_000, nro: '400-47-994000081020-0', pagada: 2_100_000 },
    { cli: 7, prod: 9, bien: 'RC PROFESIONAL MEDICA - 40 MEDICOS', fin: -310, prima: 5_700_000, nro: '48-70-101002001-0', pagada: 5_700_000 },
    { cli: 7, prod: 8, bien: 'GRUPO DE 80 EMPLEADOS', fin: -205, prima: 9_100_000, nro: '330-1-0011190-0', pagada: 9_100_000 },
    { cli: 9, prod: 10, bien: '610 ESTUDIANTES', fin: -348, prima: 3_050_000, nro: '400-37-994000019200-0', pagada: 3_050_000 },
    { cli: 2, prod: 3, bien: 'SWZ911', fin: -344, prima: 5_600_000, nro: '77-120-299871-0', pagada: 5_600_000 },
    { cli: 3, prod: 7, bien: 'CASA CALLE 45 # 20-31 BUCARAMANGA', fin: -160, prima: 720_000, nro: '1002-80412-0', pagada: 720_000 },
    { cli: 11, prod: 11, bien: 'LOCAL COMERCIAL CARRERA 15 # 33-40', fin: -235, prima: 1_300_000, nro: '1002-80920-0', pagada: 1_300_000 },
    { cli: 5, prod: 6, bien: 'CONTRATO DE SUMINISTRO No. 011 DE 2025', fin: -105, prima: 1_090_000, nro: '96-44-101170001-0', pagada: 1_090_000 },
    { cli: 10, prod: 1, bien: 'TUV482', fin: -53, prima: 1_520_000, nro: '3001-4300021-0', pagada: 1_520_000 },
    // Recordatorios de SOAT (sin número ni aseguradora: el vencimiento es lo que importa)
    { cli: 3, prod: 4, bien: 'ABC123', fin: 9, prima: 0, nro: null },
    { cli: 3, prod: 4, bien: 'ABC123', fin: -356, prima: 0, nro: null },
    { cli: 4, prod: 4, bien: 'KTL356', fin: -25, prima: 0, nro: null },
    { cli: 6, prod: 4, bien: 'DSR643', fin: 214, prima: 0, nro: null },
    { cli: 8, prod: 4, bien: 'NQS607', fin: 33, prima: 0, nro: null },
    { cli: 12, prod: 4, bien: 'HJK914', fin: 62, prima: 0, nro: null },
    { cli: 2, prod: 4, bien: 'SWZ911', fin: 14, prima: 0, nro: null },
    { cli: 1, prod: 4, bien: 'SXM330', fin: 198, prima: 0, nro: null },
    // Pólizas sin pagar (las que aparecerán al cruzar un reporte de comisiones)
    { cli: 6, prod: 2, bien: 'DSR643', fin: 241, prima: 1_320_000, vlraseg: 39_000_000, nro: '48-40-101098766-0', pagada: 0, estado: 'I', asesor: 3 },
    // SURA sin pagar: son las que cruza el reporte de comisiones de la demostración
    { cli: 12, prod: 1, bien: 'FQP219', fin: 320, prima: 2_050_000, vlraseg: 52_000_000, nro: '3001-4411030-0', pagada: 0, estado: 'I' },
    { cli: 5, prod: 8, bien: 'GRUPO DE 22 EMPLEADOS', fin: 340, prima: 3_600_000, nro: '330-1-0013300-0', pagada: 0, estado: 'I' },
    { cli: 9, prod: 8, bien: 'GRUPO DE 41 DOCENTES', fin: 331, prima: 4_900_000, nro: '330-1-0013312-0', pagada: 0, estado: 'I' },
    { cli: 11, prod: 1, bien: 'WLM774', fin: 327, prima: 1_730_000, vlraseg: 44_000_000, nro: '3001-4411077-0', pagada: 0, estado: 'I' },
  ]

  const polizas: Fila[] = specs.map((s, i) => {
    const p = prodPor.get(s.prod)!
    const c = clientePor.get(s.cli)!
    const fin = f(s.fin)
    const ini = s.prod === 4 ? null : anios(f(s.fin + 1), -1)
    const asesor = s.asesor ?? (c.asesor_id as number)
    const porc = (p.porccom_prod as number) ?? 0
    const valor = s.prima > 0 ? Math.round(s.prima * 1.19) : 0
    const pagada = s.pagada ?? s.prima
    const estado = s.estado ?? (s.prima > 0 ? (pagada >= s.prima ? 'C' : 'I') : 'C')
    return {
      id: 30001 + i, nro_poliza: s.nro === undefined ? null : s.nro, nro_poliza_norm: s.nro ? normalizarAlfanumerico(s.nro) : null,
      cliente_id: s.cli, asesor_id: asesor, ramo_id: p.ramo_id, producto_id: s.prod, aseg_id: p.aseguradora_id,
      fexp_poliza: ini ? anios(ini, 0).slice(0, 10) : null, fini_poliza: ini, ffin_poliza: fin,
      prima_poliza: s.prima, valor_poliza: valor, bien_asegurado: s.bien, obs_poliza: null,
      vlraseg_poliza: s.vlraseg ?? null, porccom_poliza: porc, vlrbasecom_poliza: s.prima, intermediario_id: 1, porcom_agencia: 0,
      vlrcom_poliza: Math.round((s.prima * porc) / 100), vlrcomfija_poliza: 0, porcomadic_poliza: 0, vlrcomadic_poliza: 0,
      porcom_asesor1: 100, agencia_id: null, forma_pago_id: s.fp ?? 1, estado_poliza_id: estado, vlrprimapagada_poliza: pagada,
      asesor2_id: null, porcom_asesor2: null, asesor3_id: null, porcom_asesor3: null, asesorad_id: null, porcom_asesorad: null,
      agenciaad_id: null, porcom_agenciaad: null, formaexp_id: 1, usuario_id: 3 + (i % 2), origen: i % 5 === 0 ? 'ia' : i % 7 === 0 ? 'masiva' : 'manual',
      fcreado: ts(Math.min(s.fin, 0) - 4 - (i % 9)), fultmod: ts(Math.min(s.fin, 0) - 3 - (i % 9)), estado_por_pagos: false, eliminada_en: null,
    }
  })

  // ── Reportes de comisión y pagos ──
  const nombreAseg = new Map(aseguradoras.map((a) => [a.id as number, a.nombre_aseg as string]))
  void nombreAseg
  const reportes: Fila[] = [
    { id: 1, fecha_rep: f(-132), aseg_id: 1, interm_id: 1, fini_rep: f(-162), ffin_rep: f(-133), estado_rep: 'R' },
    { id: 2, fecha_rep: f(-98), aseg_id: 2, interm_id: 1, fini_rep: f(-128), ffin_rep: f(-99), estado_rep: 'R' },
    { id: 3, fecha_rep: f(-64), aseg_id: 3, interm_id: 1, fini_rep: f(-94), ffin_rep: f(-65), estado_rep: 'C' },
    { id: 4, fecha_rep: f(-31), aseg_id: 1, interm_id: 1, fini_rep: f(-61), ffin_rep: f(-32), estado_rep: 'C' },
    { id: 5, fecha_rep: f(-3), aseg_id: 4, interm_id: 1, fini_rep: f(-33), ffin_rep: f(-4), estado_rep: 'I' },
  ].map((r) => ({ ...r, vlrprima_rep: null, vlrcom_rep: null, obs_rep: null, usuario_id: 3, usuario_ultmod_id: 3, fcreado: `${r.fecha_rep}T09:00:00-05:00`, fultmod: `${r.fecha_rep}T09:00:00-05:00` }))

  const abonos: Fila[] = []
  polizas.forEach((p, i) => {
    const prima = p.prima_poliza as number
    const pagada = p.vlrprimapagada_poliza as number
    if (prima <= 0 || pagada <= 0) return
    const fin = p.ffin_poliza as string
    const desdeIni = Math.round((new Date(fin).getTime() - h.getTime()) / DIA) - 365
    const dias = Math.max(-170, Math.min(-2, desdeIni + 6 + (i % 5)))
    const rep = reportes.find((r) => r.aseg_id === p.aseg_id && (r.fini_rep as string) <= f(dias) && f(dias) <= (r.ffin_rep as string)) ?? reportes.find((r) => r.aseg_id === p.aseg_id)
    const com = Math.round((pagada * (p.porccom_poliza as number)) / 100)
    abonos.push({
      id: 7001 + abonos.length, idrep_pago: rep?.id ?? null, id_poliza: p.id, fecha_pago: f(dias), vlrprima_poliza: prima, vlrabono_prima: pagada,
      porccomision: p.porccom_poliza, vlrcomision: com, porccomad: 0, vlrcomad: 0, idfactura: null, num_factura: null, estado_pago: 'C',
      obs_pago: null, usuario_id: 3, fcreado: ts(dias), fultmod: ts(dias),
    })
  })

  // Facturas (cuentas de cobro): una por aseguradora de los primeros reportes
  const facturas_empresas: Fila[] = [
    { id: 1, aseg_id: 1, nombre: 'SEGUROS GENERALES SURAMERICANA S.A.', nit: '890.903.407-9', iva_pct: 19, activa: true },
    { id: 2, aseg_id: 2, nombre: 'SEGUROS DEL ESTADO S.A.', nit: '860.009.578-6', iva_pct: 19, activa: true },
  ]
  const facturas: Fila[] = []
  ;[1, 2].forEach((repId, k) => {
    const lineas = abonos.filter((a) => a.idrep_pago === repId)
    const subtotal = Math.round(lineas.reduce((s, a) => s + (a.vlrcomision as number), 0))
    const iva = Math.round(subtotal * 0.19)
    const total = subtotal + iva
    const rete = Math.round(subtotal * 0.11)
    const ica = Math.round(subtotal * 0.00966)
    const reteiva = Math.round(iva * 0.15)
    const id = k + 1
    facturas.push({
      id, prefijo: 2, num_factura: 2740 + k, fecha: f(-95 + k * 34), aseg_id: repId, interm_id: 1, empresa_id: id, observacion: null, subtotal,
      iva_pct: 19, iva, retefuente_pct: 11, retefuente: rete, ica_pct: 9.66, ica, reteiva_pct: 15, reteiva, total, neto: total - rete - ica - reteiva, estado: 'A', usuario_id: 3,
    })
    lineas.forEach((a) => Object.assign(a, { idfactura: id, num_factura: `2-${2740 + k}` }))
  })

  const metas: Fila[] = []
  const anio = h.getFullYear()
  for (let m = 1; m <= 12; m++) {
    metas.push({ anio, mes: m, indicador: 'prima', asesor_id: 0, valor: 18_000_000 })
    metas.push({ anio, mes: m, indicador: 'polizas', asesor_id: 0, valor: 14 })
    metas.push({ anio, mes: m, indicador: 'comision', asesor_id: 0, valor: 3_200_000 })
    metas.push({ anio, mes: m, indicador: 'recaudo', asesor_id: 0, valor: 16_000_000 })
    for (const a of [1, 2, 3]) metas.push({ anio, mes: m, indicador: 'prima', asesor_id: a, valor: 6_000_000 })
  }

  const seguimientos_renovacion: Fila[] = [
    { poliza_id: 30005, estado: 'C', nota: 'Pidió cotizar con otra aseguradora', proximo_contacto: f(3), usuario_id: 3, factualizado: ts(-2) },
    { poliza_id: 30007, estado: 'R', nota: 'Renueva con el mismo valor', proximo_contacto: null, usuario_id: 3, factualizado: ts(-1) },
  ]
  const casos_revision: Fila[] = [
    { id: 1, tipo: 'PAGO', titulo: 'Pago mayor a la prima', descripcion: 'El abono de la póliza 400-47-994000112633-0 supera la prima registrada en $120.000.', pregunta: '¿Es un pago de la prima más gastos de expedición o hay un error de digitación?', polizas: [30010], reporte_id: 3, abono_id: null, estado: 'P', respuesta: null, usuario_resuelve_id: null, fresuelto: null, fcreado: ts(-2) },
    { id: 2, tipo: 'POLIZA', titulo: 'Póliza posiblemente duplicada', descripcion: 'Dos pólizas del mismo cliente y mismo bien con vigencias que se cruzan.', pregunta: '¿Se debe anular una de las dos?', polizas: [30001, 30023], reporte_id: null, abono_id: null, estado: 'P', respuesta: null, usuario_resuelve_id: null, fresuelto: null, fcreado: ts(-5) },
  ]
  const config_empresa: Fila[] = [{ id: 1, nombre: 'Agencia Demo Asesores de Seguros', nombre_corto: 'Agencia Demo Asesores', eslogan: 'Asesoría y gestión de seguros', nit: '900.123.456-7', ciudad: 'Bucaramanga', pais: 'Colombia', celular: '3000000000', correo: 'contacto@agenciademo.co', sistema: 'SegurApp – Sistema de Gestión de Pólizas', actualizado: ts(-30) }]

  return {
    aseguradoras, ramos, productos, asesores, usuarios, intermediarios, formas_pago, formaexp, municipio, estados_poliza, clientes, polizas,
    reportes_pago: reportes, abonos_poliza: abonos, facturas, facturas_empresas, facturacion_config: [
      { clave: 'iva_pct', valor: 19 }, { clave: 'retefuente_pct', valor: 11 }, { clave: 'ica_pct', valor: 9.66 },
    ],
    metas_comerciales: metas, seguimientos_renovacion, seguimientos_renovacion_hist: [], casos_revision, config_empresa,
    polizas_pendientes: [], ia_aprendizaje_producto: [], ia_aprendizaje_rol_cliente: [], ia_aprendizaje_intermediario_reporte: [], oportunidades_secop: [],
  }
}
