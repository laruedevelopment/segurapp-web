import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const APP_ENV = (import.meta.env.VITE_APP_ENV as string | undefined) ?? 'dev'
export const ES_PRUEBAS = APP_ENV !== 'prod'

if (!url || !anonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en el archivo .env')
}

/**
 * Token de la sesión actual (lo firma la Edge Function `login`). Sin sesión
 * se usa la clave pública: la base solo deja iniciar sesión con ella.
 */
let tokenActual: string | null = null

export function fijarToken(token: string | null) {
  tokenActual = token
}

/**
 * Cliente único. No usa Supabase Auth: el login es propio (apodo + clave) y
 * el token se entrega en cada consulta a la base y a las funciones de IA.
 */
export const db = createClient(url, anonKey, {
  accessToken: async () => tokenActual ?? anonKey,
})

export const SUPABASE_URL = url
export const SUPABASE_ANON_KEY = anonKey
