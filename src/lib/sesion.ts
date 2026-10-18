import { useSyncExternalStore } from 'react'
import { db, fijarToken } from './supabase'
import type { Usuario } from './tipos'

interface EstadoSesion {
  usuario: Usuario
  token: string
  /** Segundos Unix en que vence el token (12 horas después del login). */
  expira: number
}

const CLAVE = 'segurapp.sesion'

let sesion: EstadoSesion | null = leerGuardada()
let timer: ReturnType<typeof setTimeout> | null = null
const oyentes = new Set<() => void>()

/** Qué hacer cuando vence la sesión (lo configura el router). */
let alVencer: ((mensaje?: string) => void) | null = null
export function configurarAlVencer(fn: (mensaje?: string) => void) {
  alVencer = fn
}

/**
 * Qué borrar al cerrar sesión (lo configura main.tsx: la caché de consultas).
 * El siguiente usuario del mismo equipo no debe ver lo que cargó el anterior.
 */
let alCerrar: (() => void) | null = null
export function configurarAlCerrar(fn: () => void) {
  alCerrar = fn
}

function leerGuardada(): EstadoSesion | null {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (!raw) return null
    const s = JSON.parse(raw) as EstadoSesion
    if (!s?.token || !s.expira || s.expira * 1000 <= Date.now() + 60_000) {
      localStorage.removeItem(CLAVE)
      return null
    }
    return s
  } catch {
    return null
  }
}

function avisar() {
  for (const o of oyentes) o()
}

function programarVencimiento() {
  if (timer) clearTimeout(timer)
  timer = null
  if (!sesion) return
  const restante = sesion.expira * 1000 - Date.now() - 60_000
  timer = setTimeout(() => {
    cerrarSesion()
    alVencer?.()
  }, Math.max(0, restante))
}

// Al cargar la página con una sesión guardada, se retoma.
if (sesion) {
  fijarToken(sesion.token)
  programarVencimiento()
}

// Si se cierra sesión en otra pestaña, esta también se cierra (sin esto seguiría
// con su copia del token hasta que venza).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === CLAVE && e.newValue === null && sesion) {
      cerrarSesion()
      alVencer?.('Cerró sesión en otra pestaña. Inicie sesión de nuevo.')
    }
  })
}

export function obtenerSesion() {
  return sesion
}

export function useSesion() {
  return useSyncExternalStore(
    (cb) => {
      oyentes.add(cb)
      return () => oyentes.delete(cb)
    },
    () => sesion,
  )
}

export type ResultadoLogin = { ok: true } | { ok: false; mensaje: string }

/**
 * Verifica apodo + clave con la Edge Function `login`. La verificación
 * ocurre en la base (bcrypt, bloqueo tras 5 intentos en 15 minutos); la
 * función solo firma el token de 12 horas.
 */
export async function iniciarSesion(apodo: string, clave: string): Promise<ResultadoLogin> {
  const { data, error } = await db.functions.invoke('login', {
    body: { apodo: apodo.trim(), clave },
  })
  if (error) {
    let mensaje = 'No se pudo iniciar sesión. Intente de nuevo en un momento.'
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const cuerpo = await ctx.json()
        if (cuerpo?.error) mensaje = cuerpo.error
      } catch {
        /* respuesta sin JSON */
      }
      if (ctx.status === 401) mensaje = 'Usuario o contraseña incorrectos.'
    }
    return { ok: false, mensaje }
  }

  const { usuario, accessToken, expiresAt } = data as {
    usuario: Usuario
    accessToken: string
    expiresAt: number
  }
  sesion = { usuario, token: accessToken, expira: expiresAt }
  fijarToken(accessToken)
  try {
    localStorage.setItem(CLAVE, JSON.stringify(sesion))
  } catch {
    /* sin almacenamiento: la sesión dura mientras la pestaña esté abierta */
  }
  programarVencimiento()
  avisar()
  return { ok: true }
}

/** Olvida el usuario y vuelve a la clave pública. */
export function cerrarSesion() {
  sesion = null
  fijarToken(null)
  alCerrar?.()
  if (timer) clearTimeout(timer)
  timer = null
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    /* nada */
  }
  avisar()
}

/** Roles: A = Administrador, S = acceso a comisiones, D = Digitador. */
export const rolDe = (u: Usuario | null | undefined) => (u?.rol ?? '').toUpperCase()
export const esAdmin = (u: Usuario | null | undefined) => rolDe(u) === 'A'
export const veComisiones = (u: Usuario | null | undefined) => ['A', 'S'].includes(rolDe(u))
export const usuarioId = () => sesion?.usuario.id ?? null
