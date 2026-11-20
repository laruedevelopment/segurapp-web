// Motor mínimo que imita lo que la app usa de la API REST de Supabase (PostgREST): filtros, orden,
// paginación, relaciones embebidas, conteos, inserciones, actualizaciones y borrados sobre tablas
// que viven en memoria. Sirve solo para el modo demo (datos ficticios): no se incluye en producción.

export type Fila = Record<string, unknown>

export interface Mundo {
  /** Filas de una tabla o vista (las vistas se calculan al pedirlas); null si no existe. */
  filas(nombre: string): Fila[] | null
  /** tabla → columna → tabla a la que apunta (para las relaciones embebidas). */
  fks: Record<string, Record<string, string>>
}

/** Parte [texto] por [sep] solo en el nivel 0 de paréntesis y comillas. */
export function partir(texto: string, sep = ','): string[] {
  const out: string[] = []
  let nivel = 0
  let comillas = false
  let actual = ''
  for (const c of texto) {
    if (c === '"') comillas = !comillas
    if (!comillas) {
      if (c === '(') nivel++
      if (c === ')') nivel--
      if (c === sep && nivel === 0) {
        out.push(actual)
        actual = ''
        continue
      }
    }
    actual += c
  }
  if (actual.length) out.push(actual)
  return out
}

const esNumero = (v: unknown) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)))

function comparar(a: unknown, b: string): number {
  if (esNumero(a) && esNumero(b)) return Number(a) - Number(b)
  return String(a).localeCompare(b, 'en')
}

function patron(p: string): RegExp {
  let r = ''
  for (let i = 0; i < p.length; i++) {
    const c = p[i]
    if (c === '\\' && i + 1 < p.length) r += p[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    else if (c === '%' || c === '*') r += '.*'
    else if (c === '_') r += '.'
    else r += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${r}$`, 'is')
}

const sinComillas = (s: string) => (s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\') : s)

/** ¿La fila cumple "op.valor" sobre su columna? ([negado] invierte el resultado). */
function cumple(valor: unknown, expr: string): boolean {
  let negado = false
  let e = expr
  if (e.startsWith('not.')) {
    negado = true
    e = e.slice(4)
  }
  const i = e.indexOf('.')
  const op = i < 0 ? e : e.slice(0, i)
  const arg = i < 0 ? '' : e.slice(i + 1)
  let ok: boolean
  switch (op) {
    case 'eq':
      ok = valor != null && (esNumero(valor) && esNumero(arg) ? Number(valor) === Number(arg) : String(valor) === sinComillas(arg))
      break
    case 'neq':
      ok = valor == null || String(valor) !== sinComillas(arg)
      break
    case 'gt': ok = valor != null && comparar(valor, arg) > 0; break
    case 'gte': ok = valor != null && comparar(valor, arg) >= 0; break
    case 'lt': ok = valor != null && comparar(valor, arg) < 0; break
    case 'lte': ok = valor != null && comparar(valor, arg) <= 0; break
    case 'like':
    case 'ilike': ok = valor != null && patron(sinComillas(arg)).test(String(valor)); break
    case 'is':
      ok = arg === 'null' ? valor == null : arg === 'true' ? valor === true : arg === 'false' ? valor === false : false
      break
    case 'in': {
      const lista = partir(arg.replace(/^\(|\)$/g, '')).map((x) => sinComillas(x.trim()))
      ok = valor != null && lista.some((x) => (esNumero(valor) && esNumero(x) ? Number(valor) === Number(x) : String(valor) === x))
      break
    }
    default:
      ok = true
  }
  return negado ? !ok : ok
}

/** Una condición de `or=(...)` / `and=(...)`: "col.op.valor" o "and(...)" / "or(...)" anidados. */
function condicion(fila: Fila, texto: string): boolean {
  const t = texto.trim()
  const m = /^(and|or)\((.*)\)$/s.exec(t)
  if (m) {
    const partes = partir(m[2])
    return m[1] === 'and' ? partes.every((p) => condicion(fila, p)) : partes.some((p) => condicion(fila, p))
  }
  const i = t.indexOf('.')
  if (i < 0) return true
  return cumple(fila[t.slice(0, i)], t.slice(i + 1))
}

const RESERVADOS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns', 'or', 'and'])

export function filtrar(filas: Fila[], params: URLSearchParams): Fila[] {
  const reglas: [string, string][] = []
  for (const [k, v] of params) if (!RESERVADOS.has(k) && !k.includes('.')) reglas.push([k, v])
  const ors = params.getAll('or')
  const ands = params.getAll('and')
  return filas.filter((f) => {
    for (const [col, expr] of reglas) if (!cumple(f[col], expr)) return false
    for (const o of ors) if (!partir(o.replace(/^\(|\)$/g, '')).some((c) => condicion(f, c))) return false
    for (const a of ands) if (!partir(a.replace(/^\(|\)$/g, '')).every((c) => condicion(f, c))) return false
    return true
  })
}

export function ordenar(filas: Fila[], params: URLSearchParams): Fila[] {
  const claves = params.getAll('order').flatMap((o) => partir(o))
  if (!claves.length) return filas
  const reglas = claves.map((c) => {
    const [col, ...mods] = c.split('.')
    const desc = mods.includes('desc')
    const nulosPrimero = mods.includes('nullsfirst') ? true : mods.includes('nullslast') ? false : desc
    return { col, desc, nulosPrimero }
  })
  return [...filas].sort((a, b) => {
    for (const r of reglas) {
      const x = a[r.col]
      const y = b[r.col]
      if (x == null && y == null) continue
      if (x == null) return r.nulosPrimero ? -1 : 1
      if (y == null) return r.nulosPrimero ? 1 : -1
      const c = esNumero(x) && esNumero(y) ? Number(x) - Number(y) : String(x).localeCompare(String(y), 'es')
      if (c !== 0) return r.desc ? -c : c
    }
    return 0
  })
}

// ── select con relaciones embebidas ─────────────────────────────────────────

interface ItemSelect {
  alias?: string
  nombre: string
  inner?: string
}

function leerSelect(sel: string): ItemSelect[] {
  return partir(sel)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = /^(?:([\w]+):)?([\w*]+)(?:!\w+)?(?:\((.*)\))?$/s.exec(s.replace(/::\w+$/, ''))
      return m ? { alias: m[1], nombre: m[2], inner: m[3] } : { nombre: s }
    })
}

export function proyectar(mundo: Mundo, tabla: string, filas: Fila[], sel: string | null): Fila[] {
  if (!sel || sel.trim() === '*') return filas
  const items = leerSelect(sel)
  return filas.map((f) => {
    const out: Fila = {}
    for (const it of items) {
      if (it.nombre === '*' && it.inner === undefined) {
        Object.assign(out, f)
        continue
      }
      if (it.inner !== undefined) {
        out[it.alias ?? it.nombre] = embebido(mundo, tabla, f, it)
        continue
      }
      if (it.nombre in f) out[it.alias ?? it.nombre] = f[it.nombre]
    }
    return out
  })
}

function embebido(mundo: Mundo, tabla: string, fila: Fila, it: ItemSelect): unknown {
  const fks = mundo.fks[tabla] ?? {}
  let destino: string | null = null
  let col: string | null = null
  if (fks[it.nombre]) {
    col = it.nombre
    destino = fks[it.nombre]
  } else {
    const c = Object.keys(fks).find((k) => fks[k] === it.nombre)
    if (c) {
      col = c
      destino = it.nombre
    }
  }
  if (destino && col) {
    const rel = (mundo.filas(destino) ?? []).find((r) => r.id === fila[col!])
    return rel ? proyectar(mundo, destino, [rel], it.inner ?? '*')[0] : null
  }
  // Uno a muchos: la otra tabla apunta a esta.
  const otras = mundo.filas(it.nombre)
  const fk = Object.entries(mundo.fks[it.nombre] ?? {}).find(([, t]) => t === tabla)?.[0]
  if (otras && fk) return proyectar(mundo, it.nombre, otras.filter((r) => r[fk] === fila.id), it.inner ?? '*')
  return null
}
