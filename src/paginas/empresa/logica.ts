// Validación del formulario "Datos de la empresa" (misma regla de la función config_empresa_guardar).

import type { Empresa } from '@/lib/empresa'

export const CAMPOS_EMPRESA: { clave: keyof Empresa; etiqueta: string; obligatorio: boolean; ayuda?: string; maximo: number }[] = [
  { clave: 'nombre', etiqueta: 'Razón social o nombre completo', obligatorio: true, ayuda: 'Sale en el encabezado de los PDF y en el login.', maximo: 120 },
  { clave: 'nombreCorto', etiqueta: 'Nombre corto', obligatorio: true, ayuda: 'Sale debajo del logo, en el menú.', maximo: 60 },
  { clave: 'eslogan', etiqueta: 'Frase bajo el nombre', obligatorio: false, ayuda: 'En los comprobantes de pago.', maximo: 120 },
  { clave: 'nit', etiqueta: 'NIT', obligatorio: true, ayuda: 'Con el dígito de verificación, por ejemplo 900.123.456-7.', maximo: 30 },
  { clave: 'ciudad', etiqueta: 'Ciudad', obligatorio: true, maximo: 60 },
  { clave: 'pais', etiqueta: 'País', obligatorio: false, maximo: 60 },
  { clave: 'celular', etiqueta: 'Celular', obligatorio: true, maximo: 30 },
  { clave: 'correo', etiqueta: 'Correo', obligatorio: true, maximo: 120 },
]

export type ErroresEmpresa = Partial<Record<keyof Empresa, string>>

/** Errores por campo (vacío = todo bien). */
export function validarEmpresa(v: Pick<Empresa, 'nombre' | 'nombreCorto' | 'eslogan' | 'nit' | 'ciudad' | 'pais' | 'celular' | 'correo'>): ErroresEmpresa {
  const e: ErroresEmpresa = {}
  for (const c of CAMPOS_EMPRESA) {
    const t = (v[c.clave as keyof typeof v] ?? '').trim()
    if (c.obligatorio && !t) e[c.clave] = 'Obligatorio'
    else if (t.length > c.maximo) e[c.clave] = `Máximo ${c.maximo} caracteres`
  }
  if (!e.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.correo.trim())) e.correo = 'Escriba un correo válido'
  if (!e.celular && v.celular.replace(/\D/g, '').length < 7) e.celular = 'Escriba un número de teléfono válido'
  return e
}
