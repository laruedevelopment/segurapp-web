// Tipos de las tablas y vistas de Supabase que usa la app. Los nombres de
// campo son los mismos de la base (snake_case) para no tener que traducir
// en cada consulta.

export type Rol = 'A' | 'S' | 'D' | string

export interface Usuario {
  id: number
  apodo_usuario: string
  nombre_usuario: string
  rol: Rol
  asesor_id: number | null
  correo_usuario: string | null
  estado_usuario: boolean
}

export interface Cliente {
  id: number
  nombre_cliente: string
  tipopers_cliente: 'N' | 'J' | string
  tipodoc_cliente: string | null
  doc_cliente: string | null
  tel_cliente: string | null
  correo_cliente: string | null
  dir_cliente: string | null
  munic_id: number | null
  notas_cliente: string | null
  contacto_cliente: string | null
  cargocont_cliente: string | null
  asesor_id: number | null
  estado_cliente: boolean
  recordar_cliente: boolean
  municipio?: { id: number; nombre_munic: string } | null
}

export interface Municipio {
  id: number
  nombre_munic: string
}

export interface Asesor {
  id: number
  nombre_asesor: string
  tipodoc_asesor: string | null
  doc_asesor: string | null
  tel_asesor: string | null
  correo_asesor: string | null
  porccom_asesor: number | null
  estado_asesor: boolean
}

export interface Aseguradora {
  id: number
  nombre_aseg: string
  nit_aseg: string | null
  clave: string | null
  estado_aseg: boolean
}

export interface Ramo {
  id: number
  nombre_ramo: string
  estado_ramo: boolean
  obs_ramo: string | null
  porcom_base_ramo: number | null
}

export interface Producto {
  id: number
  nombre_prod: string
  ramo_id: number
  aseguradora_id: number
  estado_prod: boolean
  vlrfijocom_prod: number | null
  porccom_prod: number | null
  desc_prod: string | null
  porcad_prod: number | null
  obs_prod: string | null
}

export interface Intermediario {
  id: number
  nombre_interm: string
  estado_interm: boolean
}

export interface FormaExpedicion {
  id: number
  nombre_formaexp: string
  desc_formaexp: string | null
}

export interface FormaPago {
  id: number
  nombre_forma_pago: string
  estado_forma_pago: boolean
}

export interface EstadoPoliza {
  id: string
  nombre_estado: string
  estado_activo?: boolean
}

/** Columnas propias de la tabla `polizas`. */
export interface PolizaBase {
  id: number
  nro_poliza: string | null
  cliente_id: number | null
  asesor_id: number | null
  ramo_id: number | null
  producto_id: number | null
  fexp_poliza: string | null
  fini_poliza: string | null
  ffin_poliza: string | null
  prima_poliza: number | null
  valor_poliza: number | null
  bien_asegurado: string | null
  obs_poliza: string | null
  vlraseg_poliza: number | null
  porccom_poliza: number | null
  vlrbasecom_poliza: number | null
  intermediario_id: number | null
  porcom_agencia: number | null
  vlrcom_poliza: number | null
  vlrcomfija_poliza: number | null
  porcomadic_poliza: number | null
  vlrcomadic_poliza: number | null
  porcom_asesor1: number | null
  porcom_asesor2: number | null
  porcom_asesor3: number | null
  porcom_asesorad: number | null
  porcom_agenciaad: number | null
  agencia_id: number | null
  forma_pago_id: number | null
  estado_poliza_id: string | null
  vlrprimapagada_poliza: number | null
  asesor2_id: number | null
  asesor3_id: number | null
  asesorad_id: number | null
  agenciaad_id: number | null
  formaexp_id: number | null
  aseg_id: number | null
  usuario_id: number | null
  fcreado: string | null
  fultmod: string | null
  estado_por_pagos?: boolean
}

/** Fila de la vista vw_polizas_busqueda (póliza + nombres de sus relaciones). */
export interface Poliza extends PolizaBase {
  nombre_cliente: string | null
  doc_cliente: string | null
  tipodoc_cliente: string | null
  tel_cliente: string | null
  nombre_asesor: string | null
  nombre_ramo: string | null
  nombre_prod: string | null
  nombre_aseg: string | null
  nombre_interm?: string | null
  nombre_forma_pago?: string | null
  nombre_formaexp?: string | null
  nombre_usuario: string | null
  apodo_usuario: string | null
  nombre_estado?: string | null
}

/** Columnas que trae la lista de pólizas (la vista tiene ~57). */
export type PolizaLista = Pick<
  Poliza,
  | 'id' | 'nro_poliza' | 'cliente_id' | 'asesor_id' | 'ramo_id' | 'producto_id' | 'aseg_id'
  | 'fexp_poliza' | 'fini_poliza' | 'ffin_poliza' | 'prima_poliza' | 'valor_poliza'
  | 'vlraseg_poliza' | 'porccom_poliza' | 'bien_asegurado' | 'fcreado' | 'fultmod'
  | 'estado_poliza_id' | 'vlrprimapagada_poliza' | 'usuario_id'
  | 'nombre_cliente' | 'doc_cliente' | 'tipodoc_cliente' | 'tel_cliente'
  | 'nombre_asesor' | 'nombre_ramo' | 'nombre_prod' | 'nombre_aseg'
  | 'nombre_usuario' | 'apodo_usuario'
>
