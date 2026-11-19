// Datos de la empresa (agencia) que usa la app: nombre, NIT, contacto y textos de marca.
// Valores de respaldo = los de Rueda Serrano, de modo que si una base no define su configuración
// la app se ve exactamente igual que siempre. La configuración propia de cada empresa (tabla
// config_empresa) se aplica con `fijarEmpresa`.

import { useSyncExternalStore } from 'react'

export interface Empresa {
  /** "Rueda Serrano Asesores de Seguros": encabezados de PDF, login, comprobantes. */
  nombre: string
  /** "Rueda Serrano Asesores": debajo del logo en el menú. */
  nombreCorto: string
  /** Línea bajo el nombre en comprobantes. */
  eslogan: string
  nit: string
  ciudad: string
  pais: string
  celular: string
  correo: string
  /** Nombre del sistema en los PDF. */
  sistema: string
}

export const EMPRESA_POR_DEFECTO: Empresa = {
  nombre: 'Rueda Serrano Asesores de Seguros',
  nombreCorto: 'Rueda Serrano Asesores',
  eslogan: 'Asesoría y gestión de seguros',
  nit: '63.362.817-2',
  ciudad: 'Bucaramanga',
  pais: 'Colombia',
  celular: '3153729644',
  correo: 'lstellaserranom@yahoo.com',
  sistema: 'SegurApp – Sistema de Gestión de Pólizas',
}

let actual: Empresa = EMPRESA_POR_DEFECTO
const oyentes = new Set<() => void>()

export const empresaActual = () => actual

/** Aplica la configuración de la empresa; los campos vacíos o ausentes conservan el valor de respaldo. */
export function fijarEmpresa(cfg: Partial<Record<keyof Empresa, string | null | undefined>> | null) {
  const nueva = { ...EMPRESA_POR_DEFECTO }
  for (const k of Object.keys(nueva) as (keyof Empresa)[]) {
    const v = cfg?.[k]
    if (typeof v === 'string' && v.trim()) nueva[k] = v.trim()
  }
  actual = nueva
  oyentes.forEach((f) => f())
}

export function useEmpresa(): Empresa {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f)
      return () => oyentes.delete(f)
    },
    empresaActual,
  )
}

/** Líneas de contacto para la firma de los PDF. */
export const contactoEmpresa = (e: Empresa = actual) => [`Celular: ${e.celular}`, `Correo: ${e.correo}`, `${e.ciudad} - ${e.pais}`]
