// Visita las pantallas del demo, toma una foto de cada una y lista los errores de consola.
// Uso: node scripts/demo/revisar.mjs [carpeta de salida]
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { servir } from './servidor.mjs'

const salida = process.argv[2] ?? 'demo-video/revision'
mkdirSync(salida, { recursive: true })
const { url, cerrar } = await servir()
const navegador = await chromium.launch({ channel: 'chrome', headless: true })
const pagina = await navegador.newPage({ viewport: { width: 1440, height: 810 } })
const problemas = []
pagina.on('console', (m) => {
  const t = m.text()
  if (m.type() === 'error' || t.includes('[demo]')) problemas.push(`${pagina.url().replace(url, '')} → ${t.slice(0, 220)}`)
})
pagina.on('pageerror', (e) => problemas.push(`${pagina.url().replace(url, '')} → ERROR ${String(e).slice(0, 220)}`))

const rutas = (process.argv[3] ?? '/,/polizas,/polizas/30001,/polizas/nueva,/polizas/vencimientos,/polizas/soat,/tablero,/comisiones,/comisiones/nuevo,/facturas,/catalogos,/catalogos/usuarios,/casos,/consumo,/dashboard,/empresa').split(',')
for (const r of rutas) {
  await pagina.goto(url + r.replace(/^\//, ''), { waitUntil: 'networkidle' }).catch(() => {})
  await pagina.waitForTimeout(1200)
  const nombre = r === '/' ? 'inicio' : r.replace(/^\//, '').replace(/\//g, '_')
  await pagina.screenshot({ path: `${salida}/${nombre}.png` })
  console.log('foto', nombre)
}
console.log(problemas.length ? '\nPROBLEMAS:\n' + [...new Set(problemas)].join('\n') : '\nSin errores de consola')
await navegador.close()
await cerrar()
