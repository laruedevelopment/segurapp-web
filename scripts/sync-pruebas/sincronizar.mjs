// Copia los DATOS de la base de producción a la base de pruebas (la deja como producción hoy).
//
//  · Producción solo se LEE (transacción de solo lectura con una foto consistente).
//  · Pruebas se SOBRESCRIBE: se vacían las tablas copiadas y se vuelven a llenar. Sus cambios de estructura
//    (columnas y tablas que solo existen en pruebas) se conservan; las columnas propias de pruebas quedan vacías.
//  · Por defecto es un ENSAYO: solo muestra lo que haría. Con --aplicar pide confirmación escrita.
//
// Variables de entorno (cadenas de conexión de Postgres, NO se guardan en ningún archivo):
//   PROD_DB_URL     producción (basta un usuario de solo lectura)
//   PRUEBAS_DB_URL  pruebas (usuario con permiso de escritura, p. ej. postgres)
// Uso:  node scripts/sync-pruebas/sincronizar.mjs            (ensayo)
//       node scripts/sync-pruebas/sincronizar.mjs --aplicar  (copia de verdad)
import pg from 'pg'
import readline from 'node:readline/promises'

export const REF_PROD = 'tmuapctazakdecyddelw'
export const REF_PRUEBAS = 'oodwizkzcjqrtjyiipew'

/** Tablas propias de cada ambiente: no se copian (consumo de IA, configuración de la empresa, seguimientos de pruebas…). */
export const EXCLUIDAS = new Set(['consumo_ia', 'consumo_precios', 'consumo_config', 'ia_uso', 'config_empresa', 'seguimientos_renovacion', 'seguimientos_renovacion_hist'])
const LOTE = 2000

/** Referencia del proyecto (20 letras) que aparece en el servidor o en el usuario de la cadena de conexión. */
export function refDeUrl(url) {
  const u = new URL(url)
  const m = /db\.([a-z0-9]{20})\.supabase\.co/.exec(u.hostname) ?? /^[^.]+\.([a-z0-9]{20})$/.exec(decodeURIComponent(u.username))
  return m ? m[1] : null
}

const q = (nombre) => '"' + String(nombre).replace(/"/g, '""') + '"'
const cliente = (url) => new pg.Client({ connectionString: url, ssl: url.includes('supabase') ? { rejectUnauthorized: false } : undefined })

async function tablas(c) {
  const r = await c.query("select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1")
  return r.rows.map((x) => x.table_name)
}

async function columnas(c, tabla) {
  const r = await c.query(
    "select column_name, is_generated, identity_generation from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position",
    [tabla],
  )
  return r.rows.map((x) => ({ nombre: x.column_name, generada: x.is_generated === 'ALWAYS' }))
}

async function cuenta(c, tabla) {
  return Number((await c.query(`select count(*) as n from public.${q(tabla)}`)).rows[0].n)
}

/** Qué se copiaría: por tabla, columnas comunes (sin las generadas en destino) y diferencias. */
export async function planear(prod, pruebas) {
  const [tp, tt] = [await tablas(prod), await tablas(pruebas)]
  const comunes = tp.filter((t) => tt.includes(t) && !EXCLUIDAS.has(t))
  const plan = []
  for (const t of comunes) {
    const [cp, ct] = [await columnas(prod, t), await columnas(pruebas, t)]
    const nombresP = new Set(cp.map((c) => c.nombre))
    const copiar = ct.filter((c) => !c.generada && nombresP.has(c.nombre)).map((c) => c.nombre)
    const filasProd = await cuenta(prod, t)
    // Estimación del catálogo de Postgres (no la afecta la seguridad por filas): si dice que hay muchas filas pero
    // el conteo da 0, el usuario de producción no puede ver los datos y NO se debe copiar (se vaciaría pruebas).
    const estimadas = Number((await prod.query('select reltuples::bigint as n from pg_class where oid = $1::regclass', [`public.${q(t)}`])).rows[0].n)
    plan.push({
      tabla: t,
      ocultas: filasProd === 0 && estimadas > 50,
      filasProd,
      filasPruebas: await cuenta(pruebas, t),
      columnas: copiar,
      soloPruebas: ct.filter((c) => !nombresP.has(c.nombre) && !c.generada).map((c) => c.nombre),
      soloProd: cp.filter((c) => !ct.some((x) => x.nombre === c.nombre)).map((c) => c.nombre),
    })
  }
  return { plan, soloEnProd: tp.filter((t) => !tt.includes(t)), soloEnPruebas: tt.filter((t) => !tp.includes(t)), excluidas: tp.filter((t) => EXCLUIDAS.has(t)) }
}

/** Copia los datos. [prod] debe estar dentro de una transacción de solo lectura. */
export async function copiar(prod, pruebas, plan, log = console.log) {
  await pruebas.query('begin')
  try {
    // Sin disparadores ni revisión de llaves foráneas mientras se carga (los datos ya vienen consistentes).
    await pruebas.query("set local session_replication_role = 'replica'").catch((e) => {
      throw new Error(`El usuario de pruebas no puede desactivar los disparadores (${e.message}). Use el usuario postgres de pruebas.`)
    })
    await pruebas.query(`truncate ${plan.map((p) => `public.${q(p.tabla)}`).join(', ')} restart identity cascade`)
    for (const p of plan) {
      if (!p.columnas.length) continue
      const lista = p.columnas.map(q).join(', ')
      let copiadas = 0
      for (let desde = 0; desde < p.filasProd || desde === 0; desde += LOTE) {
        // La foto de producción es estable: se pagina por posición física. El JSON viaja como texto, sin pasar por JavaScript.
        const lote = await prod.query(
          `select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)::text as j, count(*)::int as n from (select ${lista} from public.${q(p.tabla)} order by ctid offset $1 limit $2) t`,
          [desde, LOTE],
        )
        const n = lote.rows[0].n
        if (n === 0) break
        await pruebas.query(
          `insert into public.${q(p.tabla)} (${lista}) overriding system value select ${lista} from jsonb_populate_recordset(null::public.${q(p.tabla)}, $1::jsonb)`,
          [lote.rows[0].j],
        )
        copiadas += n
      }
      log(`  ${p.tabla.padEnd(34)} ${String(copiadas).padStart(8)} filas`)
    }
    // Las secuencias siguen a la fila más alta (para que los códigos nuevos no choquen con los copiados).
    for (const p of plan) {
      if (!p.columnas.includes('id')) continue
      const sec = (await pruebas.query("select pg_get_serial_sequence($1, 'id') as s", [`public.${q(p.tabla)}`])).rows[0].s
      if (sec) await pruebas.query(`select setval($1, greatest(coalesce((select max(id) from public.${q(p.tabla)}), 0), 1), (select count(*) > 0 from public.${q(p.tabla)}))`, [sec])
    }
    await pruebas.query('commit')
  } catch (e) {
    await pruebas.query('rollback').catch(() => {})
    throw e
  }
}

async function principal() {
  const aplicar = process.argv.includes('--aplicar')
  const { PROD_DB_URL, PRUEBAS_DB_URL } = process.env
  if (!PROD_DB_URL || !PRUEBAS_DB_URL) {
    console.error('Faltan las variables PROD_DB_URL y PRUEBAS_DB_URL (ver scripts/sync-pruebas/LEEME.md).')
    process.exit(1)
  }
  const [rp, rt] = [refDeUrl(PROD_DB_URL), refDeUrl(PRUEBAS_DB_URL)]
  console.log(`Producción: ${rp ?? '(no se pudo leer)'}  ·  Pruebas: ${rt ?? '(no se pudo leer)'}`)
  if (rp !== REF_PROD || rt !== REF_PRUEBAS) {
    console.error(`\nALTO: se esperaba producción = ${REF_PROD} y pruebas = ${REF_PRUEBAS}. No se hizo nada.`)
    process.exit(1)
  }

  const prod = cliente(PROD_DB_URL)
  const pruebas = cliente(PRUEBAS_DB_URL)
  await prod.connect()
  await pruebas.connect()
  try {
    await prod.query('begin isolation level repeatable read read only')
    const { plan, soloEnProd, soloEnPruebas, excluidas } = await planear(prod, pruebas)
    console.log('\nTabla'.padEnd(36) + 'Producción'.padStart(11) + 'Pruebas hoy'.padStart(13))
    for (const p of plan) console.log(`${p.tabla.padEnd(35)}${String(p.filasProd).padStart(11)}${String(p.filasPruebas).padStart(13)}${p.soloPruebas.length ? `   (columnas solo en pruebas, quedarán vacías: ${p.soloPruebas.join(', ')})` : ''}${p.soloProd.length ? `   (columnas solo en producción, se omiten: ${p.soloProd.join(', ')})` : ''}`)
    console.log(`\nNo se copian (propias de cada ambiente): ${excluidas.join(', ') || '—'}`)
    if (soloEnProd.length) console.log(`Tablas que solo existen en producción (se omiten): ${soloEnProd.join(', ')}`)
    if (soloEnPruebas.length) console.log(`Tablas que solo existen en pruebas (se conservan, pero quedarán vacías las que dependan de las copiadas): ${soloEnPruebas.join(', ')}`)

    const ocultas = plan.filter((p) => p.ocultas).map((p) => p.tabla)
    if (ocultas.length) {
      console.error(`\nALTO: el usuario de producción ve 0 filas en ${ocultas.join(', ')}, que sí tienen datos. Casi seguro la seguridad por filas (RLS) se las oculta: use un usuario con BYPASSRLS (por ejemplo postgres). No se hizo nada.`)
      process.exitCode = 1
      return
    }
    if (!aplicar) {
      console.log('\nENSAYO: no se modificó nada. Para copiar de verdad, vuelva a ejecutar con --aplicar.')
      return
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const r = await rl.question(`\nSe BORRARÁN los datos actuales de PRUEBAS (${rt}) y se reemplazarán por los de producción. Escriba SOBRESCRIBIR PRUEBAS para continuar: `)
    rl.close()
    if (r.trim() !== 'SOBRESCRIBIR PRUEBAS') {
      console.log('Cancelado: no se modificó nada.')
      return
    }
    console.log('\nCopiando…')
    await copiar(prod, pruebas, plan)
    console.log('\nVerificando…')
    let mal = 0
    for (const p of plan) {
      const n = await cuenta(pruebas, p.tabla)
      if (n !== p.filasProd) {
        mal++
        console.log(`  ✗ ${p.tabla}: producción ${p.filasProd}, pruebas ${n}`)
      }
    }
    console.log(mal ? `\n⚠ ${mal} tabla(s) no coinciden.` : '\n✔ Pruebas quedó igual a producción (mismo número de filas en todas las tablas copiadas).')
  } finally {
    await prod.query('rollback').catch(() => {})
    await prod.end()
    await pruebas.end()
  }
}

if (import.meta.url === new URL(process.argv[1], 'file://').href || process.argv[1]?.endsWith('sincronizar.mjs')) {
  principal().catch((e) => {
    console.error('\nError:', e.message)
    process.exit(1)
  })
}
