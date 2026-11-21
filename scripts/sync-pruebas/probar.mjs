import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Prueba de sincronizar.mjs contra dos bases de Postgres desechables (no toca ninguna base real).
// Uso: en una carpeta aparte  npm i embedded-postgres pg  y luego  node ruta/a/probar.mjs
const REPO = new URL('./sincronizar.mjs', import.meta.url).href
const { planear, copiar, refDeUrl, EXCLUIDAS } = await import(REPO)

let bien = 0, mal = 0
const ok = (n, c, x = '') => { c ? (bien++, console.log('  PASS', n)) : (mal++, console.log('  FAIL', n, x)) }

async function servidor(puerto, nombre) {
  const dir = path.join(os.tmpdir(), `pgsync-${nombre}-${process.pid}`)
  fs.rmSync(dir, { recursive: true, force: true })
  const s = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'x', port: puerto, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'] })
  await s.initialise(); await s.start(); await s.createDatabase('t')
  const c = new pg.Client({ host: 'localhost', port: puerto, user: 'postgres', password: 'x', database: 't' })
  await c.connect()
  return { s, c }
}

const esquemaBase = `
create table usuarios(id bigint generated always as identity primary key, apodo text, clave text);
create table polizas(
  id bigint generated always as identity primary key, nro text,
  nro_norm text generated always as (upper(regexp_replace(nro, '[^0-9A-Za-z]', '', 'g'))) stored,
  usuario_id bigint references usuarios(id), prima numeric(14,2), fcreado timestamptz default now(), tags text[], datos jsonb, obs text);
create table abonos(id serial primary key, poliza_id bigint references polizas(id), valor numeric);
create table consumo_ia(id serial primary key, x text);
`
const [P, T] = [await servidor(45511, 'prod'), await servidor(45512, 'pruebas')]
try {
  await P.c.query(esquemaBase + 'create table solo_prod(id int); insert into solo_prod values (1);')
  await T.c.query(esquemaBase + `
    alter table polizas add column origen text;
    create table seguimientos_renovacion(poliza_id bigint references polizas(id), estado text);
    create table config_empresa(id int primary key, nombre text);
    create table solo_pruebas(id int);`)

  // Datos de "producción"
  await P.c.query(`insert into usuarios(apodo, clave) values ('JAVIER','hash1'),('ANA','hash2'),('LUIS','hash3')`)
  await P.c.query(`insert into polizas(nro, usuario_id, prima, fcreado, tags, datos, obs)
    select 'AB-' || g || '-0', 1 + g % 3, (g * 1234.57)::numeric(14,2), timestamptz '2026-01-01 08:30:15.123456+00' + (g || ' minutes')::interval,
           case when g % 4 = 0 then null else array['x','y ' || g, 'con "comillas"'] end,
           jsonb_build_object('g', g, 'lista', jsonb_build_array(1, 2, g), 'txt', 'ñandú ' || g),
           case when g % 5 = 0 then null else 'observación ' || g end
    from generate_series(1, 4500) g`)
  await P.c.query(`insert into abonos(poliza_id, valor) select 1 + g % 4500, g * 10.5 from generate_series(1, 3000) g`)
  await P.c.query(`insert into consumo_ia(x) values ('prod')`)

  // Datos viejos de "pruebas" (se deben borrar), incluidos los propios de pruebas
  await T.c.query(`insert into usuarios(apodo, clave) values ('JAVIER','otro')`)
  await T.c.query(`insert into polizas(nro, usuario_id, prima, origen) values ('VIEJA-1', 1, 5, 'ia')`)
  await T.c.query(`insert into abonos(poliza_id, valor) values (1, 7)`)
  await T.c.query(`insert into seguimientos_renovacion values (1, 'C')`)
  await T.c.query(`insert into config_empresa values (1, 'Agencia Demo')`)
  await T.c.query(`insert into consumo_ia(x) values ('pruebas-1'), ('pruebas-2')`)

  console.log('\nReferencias de proyecto')
  ok('db.<ref>.supabase.co', refDeUrl('postgresql://postgres:x@db.tmuapctazakdecyddelw.supabase.co:5432/postgres') === 'tmuapctazakdecyddelw')
  ok('pooler postgres.<ref>', refDeUrl('postgresql://postgres.oodwizkzcjqrtjyiipew:x@aws-0-us-east-1.pooler.supabase.com:5432/postgres') === 'oodwizkzcjqrtjyiipew')
  ok('usuario de solo lectura copia.<ref>', refDeUrl('postgresql://copia_lectura.tmuapctazakdecyddelw:x@aws-0-us-east-1.pooler.supabase.com:5432/postgres') === 'tmuapctazakdecyddelw')
  ok('url ajena -> null', refDeUrl('postgresql://u:p@localhost:5432/db') === null)

  console.log('\nPlan')
  await P.c.query('begin isolation level repeatable read read only')
  const { plan, soloEnProd, soloEnPruebas, excluidas } = await planear(P.c, T.c)
  const nombres = plan.map((p) => p.tabla).sort()
  ok('copia solo las tablas comunes y no excluidas', JSON.stringify(nombres) === JSON.stringify(['abonos', 'polizas', 'usuarios']), nombres.join())
  ok('excluidas: consumo_ia', excluidas.includes('consumo_ia') && EXCLUIDAS.has('config_empresa'))
  ok('solo en producción / solo en pruebas', soloEnProd.includes('solo_prod') && soloEnPruebas.includes('solo_pruebas'))
  const pol = plan.find((p) => p.tabla === 'polizas')
  ok('la columna generada no se copia', !pol.columnas.includes('nro_norm'))
  ok('la columna solo de pruebas se reporta', pol.soloPruebas.includes('origen') && !pol.columnas.includes('origen'))

  console.log('\nCopia')
  await copiar(P.c, T.c, plan, () => {})
  await P.c.query('rollback')
  const n = async (c, t) => Number((await c.query(`select count(*) n from ${t}`)).rows[0].n)
  for (const t of ['usuarios', 'polizas', 'abonos']) ok(`mismas filas en ${t}`, (await n(P.c, t)) === (await n(T.c, t)), `${await n(P.c, t)} vs ${await n(T.c, t)}`)
  const huella = async (c, tabla, cols) => (await c.query(`select md5(string_agg(t::text, '|' order by id)) h from (select ${cols} from ${tabla}) t`)).rows[0].h
  ok('polizas idénticas (incluye fechas con microsegundos, arreglos, jsonb, ñ y nulos)', (await huella(P.c, 'polizas', 'id, nro, usuario_id, prima, fcreado, tags, datos, obs')) === (await huella(T.c, 'polizas', 'id, nro, usuario_id, prima, fcreado, tags, datos, obs')))
  ok('abonos idénticos', (await huella(P.c, 'abonos', '*')) === (await huella(T.c, 'abonos', '*')))
  ok('usuarios con la clave de producción', (await T.c.query(`select clave from usuarios where apodo='JAVIER'`)).rows[0].clave === 'hash1')
  ok('la columna generada se recalculó en pruebas', (await T.c.query(`select nro_norm from polizas where id = 1`)).rows[0].nro_norm === 'AB10')
  ok('la columna propia de pruebas quedó vacía', (await T.c.query(`select count(*) n from polizas where origen is not null`)).rows[0].n === '0')
  ok('no quedó la póliza vieja de pruebas', (await n(T.c, 'polizas')) === 4500 && (await T.c.query(`select 1 from polizas where nro='VIEJA-1'`)).rowCount === 0)
  ok('seguimientos de pruebas vaciados (dependían de polizas)', (await n(T.c, 'seguimientos_renovacion')) === 0)
  ok('config_empresa de pruebas intacta', (await T.c.query(`select nombre from config_empresa`)).rows[0].nombre === 'Agencia Demo')
  ok('consumo_ia de pruebas intacto', (await n(T.c, 'consumo_ia')) === 2)
  const nueva = await T.c.query(`insert into polizas(nro, usuario_id, prima) values ('NUEVA', 1, 1) returning id`)
  ok('la secuencia sigue después del máximo copiado', Number(nueva.rows[0].id) === 4501, nueva.rows[0].id)
  ok('producción no se tocó', (await n(P.c, 'polizas')) === 4500 && (await n(P.c, 'consumo_ia')) === 1)

  console.log('\nSi algo falla a la mitad, pruebas queda como estaba')
  await T.c.query('delete from polizas where nro = $1', ['NUEVA'])
  const antes = await n(T.c, 'polizas')
  await P.c.query('begin isolation level repeatable read read only')
  const planRoto = plan.map((p) => (p.tabla === 'abonos' ? { ...p, columnas: [...p.columnas, 'columna_que_no_existe'] } : p))
  let fallo = false
  try { await copiar(P.c, T.c, planRoto, () => {}) } catch { fallo = true }
  await P.c.query('rollback')
  ok('el error se propaga', fallo)
  ok('pruebas conserva sus filas (transacción revertida)', (await n(T.c, 'polizas')) === antes && (await n(T.c, 'abonos')) === 3000)

  console.log('Candado: usuario de producción que no puede ver las filas (RLS)')
  await P.c.query(`create role lector login password 'x'; grant usage on schema public to lector; grant select on all tables in schema public to lector;
                   alter table polizas enable row level security; analyze polizas;`)
  const L = new pg.Client({ host: 'localhost', port: 45511, user: 'lector', password: 'x', database: 't' })
  await L.connect()
  await L.query('begin isolation level repeatable read read only')
  const veo = await planear(L, T.c)
  await L.query('rollback'); await L.end()
  ok('el usuario sin permiso de ver filas ve 0 en polizas', veo.plan.find((p) => p.tabla === 'polizas').filasProd === 0)
  ok('se marca como "ocultas" (la copia se detendría)', veo.plan.find((p) => p.tabla === 'polizas').ocultas === true)
  ok('una tabla sin RLS no se marca', veo.plan.find((p) => p.tabla === 'abonos').ocultas === false)
  await P.c.query('begin isolation level repeatable read read only')
  const dueno = await planear(P.c, T.c)
  await P.c.query('rollback')
  ok('el dueño (postgres) sí ve todo y no se marca', dueno.plan.every((p) => !p.ocultas) && dueno.plan.find((p) => p.tabla === 'polizas').filasProd === 4500)
} finally {
  console.log(`\nRESULTADO: ${bien} bien, ${mal} mal`)
  await P.c.end(); await T.c.end(); await P.s.stop(); await T.s.stop()
  process.exit(mal ? 1 : 0)
}
