// Conserva los archivos de la versión anterior (carpeta assets) en la versión nueva durante unos días.
//
// Por qué: GitHub Pages reemplaza todo en cada publicación. Quien tenía la app abierta sigue pidiendo
// los archivos con el nombre viejo (Formulario-abc123.js) y, si ya no existen, la pantalla falla.
// Los nombres llevan el código de su contenido, así que conservar los viejos no choca con los nuevos.
// Pasados DIAS días desde que se vieron por primera vez, se borran para que el sitio no crezca sin fin.
//
// Uso: node conservar-assets.mjs <assets-anterior> <assets-nuevo>
import fs from 'node:fs'
import path from 'node:path'

const DIAS = 21
const MANIFIESTO = '_vistos.txt'
const [, , viejo, nuevo] = process.argv
const hoy = new Date().toISOString().slice(0, 10)
const dias = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

if (!nuevo || !fs.existsSync(nuevo)) {
  console.error('Falta la carpeta de assets nueva')
  process.exit(1)
}

const vistos = new Map()
if (viejo && fs.existsSync(path.join(viejo, MANIFIESTO))) {
  for (const l of fs.readFileSync(path.join(viejo, MANIFIESTO), 'utf8').split('\n')) {
    const [n, f] = l.trim().split(' ')
    if (n && f) vistos.set(n, f)
  }
}

const archivosNuevos = new Set(fs.readdirSync(nuevo).filter((n) => n !== MANIFIESTO))
const salida = new Map()
for (const n of archivosNuevos) salida.set(n, vistos.get(n) ?? hoy)

let conservados = 0
let borrados = 0
if (viejo && fs.existsSync(viejo)) {
  for (const n of fs.readdirSync(viejo)) {
    if (n === MANIFIESTO || archivosNuevos.has(n)) continue
    const primera = vistos.get(n) ?? hoy
    if (dias(primera, hoy) < DIAS) {
      fs.copyFileSync(path.join(viejo, n), path.join(nuevo, n))
      salida.set(n, primera)
      conservados++
    } else borrados++
  }
}
fs.writeFileSync(path.join(nuevo, MANIFIESTO), [...salida].map(([n, f]) => `${n} ${f}`).join('\n') + '\n')
console.log(`${nuevo}: ${archivosNuevos.size} nuevos, ${conservados} de versiones anteriores conservados, ${borrados} viejos descartados`)
