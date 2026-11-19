import { db } from '@/lib/supabase'
import { fijarEmpresa } from '@/lib/empresa'

/** Lee los datos de la empresa de su base y los aplica. Si la tabla no existe o falla, la app sigue con los valores de respaldo. */
export async function cargarEmpresa(): Promise<boolean> {
  const { data, error } = await db
    .from('config_empresa')
    .select('nombre, nombre_corto, eslogan, nit, ciudad, pais, celular, correo, sistema')
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return false
  fijarEmpresa({
    nombre: data.nombre,
    nombreCorto: data.nombre_corto,
    eslogan: data.eslogan,
    nit: data.nit,
    ciudad: data.ciudad,
    pais: data.pais,
    celular: data.celular,
    correo: data.correo,
    sistema: data.sistema,
  })
  return true
}
