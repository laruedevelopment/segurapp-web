import { db } from '@/lib/supabase'
import { fijarEmpresa, type Empresa } from '@/lib/empresa'

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

/** Guarda los datos de la empresa (solo el Administrador; la base lo exige) y los aplica en la app. */
export async function guardarEmpresa(v: Pick<Empresa, 'nombre' | 'nombreCorto' | 'eslogan' | 'nit' | 'ciudad' | 'pais' | 'celular' | 'correo'>): Promise<void> {
  const { error } = await db.rpc('config_empresa_guardar', {
    p_nombre: v.nombre,
    p_nombre_corto: v.nombreCorto,
    p_eslogan: v.eslogan,
    p_nit: v.nit,
    p_ciudad: v.ciudad,
    p_pais: v.pais,
    p_celular: v.celular,
    p_correo: v.correo,
  })
  if (error) throw error
  await cargarEmpresa()
}
