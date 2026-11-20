// Graba el video de demostración de SegurApp con datos ficticios, de forma automática:
//   1. Sirve el build demo (dist-demo) en un puerto local.
//   2. Abre Chrome, recorre las pantallas con un cursor visible y subtítulos.
//   3. Genera la narración con la voz en español de Windows (Helena).
//   4. Une video y voz en un MP4 (con ffmpeg).
// Uso:  npm run demo:build  &&  npm run demo:video
// Opciones (variables de entorno): SIN_VOZ=1 (solo subtítulos), SALIDA=carpeta, DESFASE_AUDIO=0.25
import { chromium } from 'playwright-core'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { servir } from './servidor.mjs'
import { crearPdfs } from './pdfs.mjs'

const SALIDA = resolve(process.env.SALIDA ?? 'demo-video')
const SIN_VOZ = process.env.SIN_VOZ === '1'
// VOZ: salome (mujer, colombiana; por defecto) | gonzalo (hombre, colombiano) | windows (voz básica sin internet)
const VOZ = (process.env.VOZ ?? 'salome').toLowerCase()
const NOMBRE = process.env.NOMBRE ?? 'SegurApp_demo'
const DESFASE_AUDIO = Number(process.env.DESFASE_AUDIO ?? 0.25)
const ANCHO = 1600
const ALTO = 900
const pausa = (ms) => new Promise((r) => setTimeout(r, ms))

mkdirSync(SALIDA, { recursive: true })
const crudo = join(SALIDA, 'crudo')
const vozDir = join(SALIDA, 'voz')
rmSync(crudo, { recursive: true, force: true })
mkdirSync(crudo, { recursive: true })
mkdirSync(vozDir, { recursive: true })
const { poliza, reporte } = crearPdfs(join(SALIDA, 'archivos'))

function buscarFfmpeg() {
  if (process.env.FFMPEG && existsSync(process.env.FFMPEG)) return process.env.FFMPEG
  const r = spawnSync('python', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' })
  const ruta = r.stdout?.trim()
  if (ruta && existsSync(ruta)) return ruta
  throw new Error('No encuentro ffmpeg. Instálelo con:  python -m pip install imageio-ffmpeg')
}

// ── Narración con la voz de Windows ─────────────────────────────────────────
function duracionWav(ruta) {
  const b = readFileSync(ruta)
  const bytesPorSegundo = b.readUInt32LE(28)
  let off = 12
  while (off < b.length - 8) {
    const id = b.toString('ascii', off, off + 4)
    const tam = b.readUInt32LE(off + 4)
    if (id === 'data') return tam / bytesPorSegundo
    off += 8 + tam
  }
  throw new Error('WAV sin datos: ' + ruta)
}

// Voces neuronales colombianas del servicio de lectura de Microsoft Edge (paquete edge-tts, gratis; necesita internet).
const VOCES_EDGE = { salome: 'es-CO-SalomeNeural', gonzalo: 'es-CO-GonzaloNeural' }

function generarVozEdge(textos, voz) {
  const ffmpegExe = buscarFfmpeg()
  return textos.map((texto, i) => {
    const txt = join(vozDir, `n${i}.txt`)
    const mp3 = join(vozDir, `n${i}.mp3`)
    const wav = join(vozDir, `n${i}.wav`)
    writeFileSync(txt, texto, 'utf8')
    let r = spawnSync('python', ['-m', 'edge_tts', '--voice', voz, '--file', txt, '--write-media', mp3], { encoding: 'utf8' })
    if (r.status !== 0 || !existsSync(mp3)) throw new Error('edge-tts falló: ' + (r.stderr || r.stdout).slice(-300))
    r = spawnSync(ffmpegExe, ['-y', '-loglevel', 'error', '-i', mp3, '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', wav], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error('No se pudo convertir la voz: ' + r.stderr)
    return { ruta: wav, dur: duracionWav(wav) }
  })
}

function generarVoz(textos) {
  if (VOZ !== 'windows') {
    try {
      return generarVozEdge(textos, VOCES_EDGE[VOZ] ?? VOCES_EDGE.salome)
    } catch (e) {
      console.warn('  ⚠ Voz neuronal no disponible (' + String(e.message).split(String.fromCharCode(10))[0].slice(0, 120) + '); se usa la voz de Windows.')
    }
  }
  return generarVozWindows(textos)
}

function generarVozWindows(textos) {
  writeFileSync(join(vozDir, 'textos.json'), JSON.stringify(textos), 'utf8')
  const ps1 = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    "try { $s.SelectVoice('Microsoft Helena Desktop') } catch { Write-Host 'Sin voz Helena: se usa la predeterminada' }",
    '$s.Rate = 0',
    "$dir = '" + vozDir.replace(/'/g, "''") + "'",
    "$items = @(Get-Content -Raw -Encoding UTF8 (Join-Path $dir 'textos.json') | ConvertFrom-Json | ForEach-Object { $_ })",
    'for ($i = 0; $i -lt $items.Count; $i++) {',
    '  $s.SetOutputToWaveFile((Join-Path $dir ("n" + $i + ".wav")))',
    '  $s.Speak([string]$items[$i])',
    '  $s.SetOutputToNull()',
    '}',
  ].join('\r\n')
  writeFileSync(join(vozDir, 'voz.ps1'), ps1, 'utf8')
  const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(vozDir, 'voz.ps1')], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error('Falló la voz: ' + (r.stderr || r.stdout))
  return textos.map((_, i) => {
    const ruta = join(vozDir, `n${i}.wav`)
    return { ruta, dur: duracionWav(ruta) }
  })
}

// ── Capa visual: subtítulos, tarjetas de título, cursor y clic ──────────────
const CAPA = `(() => {
  const montar = () => {
    if (document.getElementById('__demo')) return
    const estilo = document.createElement('style')
    estilo.textContent = \`
      #__demo{position:fixed;inset:0;pointer-events:none;z-index:2147483647;font-family:Inter,'Segoe UI',system-ui,sans-serif}
      #__sub{z-index:3;position:absolute;left:50%;bottom:34px;transform:translateX(-50%) translateY(10px);max-width:1180px;width:max-content;padding:14px 26px;border-radius:14px;
        background:rgba(15,32,52,.92);color:#fff;font-size:24px;line-height:1.35;text-align:center;opacity:0;transition:opacity .35s,transform .35s;box-shadow:0 8px 30px rgba(0,0,0,.25)}
      #__sub.on{opacity:1;transform:translateX(-50%) translateY(0)}
      #__tar{z-index:1;position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;color:#fff;
        background:linear-gradient(135deg,#123553 0%,#1c4870 55%,#1e9b4e 140%);opacity:0;transition:opacity .6s}
      #__tar.on{opacity:1}
      #__tar h1{font-size:76px;font-weight:800;margin:0;letter-spacing:-1px}
      #__tar p{font-size:30px;margin:0;opacity:.92;max-width:1100px;line-height:1.35}
      #__tar small{font-size:20px;opacity:.7}
      #__cur{z-index:4;position:absolute;left:0;top:0;width:30px;height:30px;transform:translate(-100px,-100px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
      .__rip{z-index:4;position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;border:4px solid #f5b301;animation:__rip .65s ease-out forwards}
      @keyframes __rip{from{transform:scale(.4);opacity:1}to{transform:scale(3.2);opacity:0}}
    \`
    document.head.appendChild(estilo)
    const raiz = document.createElement('div')
    raiz.id = '__demo'
    raiz.innerHTML = '<div id="__sub"></div><div id="__tar"><h1></h1><p></p><small></small></div>' +
      '<svg id="__cur" viewBox="0 0 24 24"><path d="M3 2l17 8.2-7.2 2.3L10.3 20z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    document.documentElement.appendChild(raiz)
    const cur = raiz.querySelector('#__cur')
    addEventListener('mousemove', (e) => { cur.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)' }, true)
    addEventListener('mousedown', (e) => {
      const r = document.createElement('div'); r.className = '__rip'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'
      raiz.appendChild(r); setTimeout(() => r.remove(), 700)
    }, true)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar()
  window.__sub = (t) => { montar(); const e = document.getElementById('__sub'); if (!t) { e.classList.remove('on'); return } e.textContent = t; e.classList.add('on') }
  window.__tarjeta = (t, s, pie) => {
    montar(); const e = document.getElementById('__tar')
    if (!t) { e.classList.remove('on'); return }
    e.querySelector('h1').textContent = t; e.querySelector('p').textContent = s || ''; e.querySelector('small').textContent = pie || ''
    e.classList.add('on')
  }
})()`

// ── Guion ───────────────────────────────────────────────────────────────────
let pagina
const intentar = async (nombre, fn) => {
  try {
    await fn()
  } catch (e) {
    console.warn(`  ⚠ ${nombre}: ${String(e.message ?? e).split('\n')[0].slice(0, 160)}`)
  }
}
const caja = async (loc) => {
  await loc.first().scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {})
  const b = await loc.first().boundingBox({ timeout: 4000 })
  if (!b) throw new Error('sin posición')
  return { x: b.x + Math.min(b.width / 2, 120), y: b.y + b.height / 2 }
}
const mover = async (loc) => {
  const { x, y } = await caja(loc)
  await pagina.mouse.move(x, y, { steps: 28 })
  await pausa(250)
}
const clic = async (loc) => {
  await mover(loc)
  await loc.first().click({ timeout: 5000 })
  await pausa(350)
}
const escribir = async (loc, texto) => {
  await clic(loc)
  await pagina.keyboard.type(texto, { delay: 85 })
}
const desplazar = async (dy, pasos = 12, espera = 55) => {
  await pagina.mouse.move(ANCHO * 0.62, ALTO * 0.55, { steps: 6 })
  for (let i = 0; i < pasos; i++) {
    await pagina.mouse.wheel(0, dy / pasos)
    await pausa(espera)
  }
}
const enlace = (nombre) => pagina.getByRole('link', { name: nombre })
const boton = (nombre) => pagina.getByRole('button', { name: nombre })
// "Guardar" exacto: no confundir con "Guardar borrador" ni "Guardar póliza".
const botonGuardar = () => pagina.getByRole('button', { name: 'Guardar', exact: true })
const ir = async (nombre) => {
  await clic(enlace(nombre).first())
  await pagina.waitForLoadState('networkidle').catch(() => {})
  await pausa(700)
}
async function subirArchivo(texto, ruta) {
  const [selector] = await Promise.all([pagina.waitForEvent('filechooser'), clic(boton(texto).first())])
  await selector.setFiles(ruta)
}

const guion = [
  { narr: 'SegurApp es el sistema que organiza el trabajo diario de una agencia de seguros: pólizas, vencimientos, pagos de comisiones y reportes para la gerencia.',
    accion: async () => { await pausa(800) }, tarjeta: ['SegurApp', 'La gestión de su agencia de seguros, en un solo lugar', 'Demostración con datos ficticios'] },
  { narr: 'Al entrar, el panel de inicio muestra lo que necesita atención hoy: las pólizas por vencer, los casos por revisar y el acceso directo a cada módulo.',
    accion: async () => { await mover(enlace(/^Vencimientos/)); await pausa(900); await mover(enlace(/^Casos por revisar/).last()) } },
  { narr: 'El módulo de pólizas reúne todo el portafolio. Se busca por cliente, documento, número, placa o aseguradora, y la lista responde al instante.',
    accion: async () => { await ir('Pólizas'); await escribir(pagina.getByPlaceholder(/Buscar por código/), 'Barrera'); await pausa(1500); await pagina.getByPlaceholder(/Buscar por código/).fill(''); await pausa(500) } },
  { narr: 'Cada póliza guarda al cliente, la vigencia, los valores y cómo se reparte la comisión entre los asesores.',
    accion: async () => { await clic(pagina.getByText('WLM774').first()); await pagina.waitForLoadState('networkidle').catch(() => {}); await pausa(900); await desplazar(520); await pausa(600); await desplazar(520) } },
  { narr: 'Para registrar una póliza nueva basta con subir el documento. La inteligencia artificial lo lee y llena el formulario sola.',
    accion: async () => { await ir('Pólizas'); await clic(pagina.getByRole('button', { name: 'Nueva póliza' }).or(pagina.getByRole('link', { name: 'Nueva póliza' })).first()); await pausa(900); await subirArchivo(/Importar desde PDF/, poliza) } },
  { narr: 'Reconoce al cliente, la aseguradora, el producto, las fechas, la placa del vehículo y los valores. La persona solo revisa y confirma.',
    accion: async () => { await pausa(2800); await desplazar(430); await pausa(800); await desplazar(430) } },
  { narr: 'Se elige el asesor responsable y se guarda. El sistema le asigna su código, y la póliza queda disponible de inmediato en la lista, en los reportes y en el tablero.',
    accion: async () => {
      await intentar('asesor', async () => {
        await clic(pagina.locator('label', { hasText: 'Asesor 1' }).first().locator('button').first())
        await pausa(400)
        await clic(pagina.getByRole('option', { name: /Carolina/ }).first().or(pagina.getByText('Carolina Mejía').first()))
      })
      await pagina.mouse.wheel(0, -4000)
      await pausa(500)
      await clic(botonGuardar())
      await pausa(1800)
    } },
  { narr: 'Cuando la aseguradora paga las comisiones, envía un reporte. En comisiones se registran esos reportes, con su período y sus totales.',
    accion: async () => {
      await pausa(2200)
      await intentar('cerrar dialogo', async () => { await clic(boton('Listo')) })
      await ir('Reportes de Comisiones')
      await pausa(1500)
    } },
  { narr: 'Se sube el reporte de la aseguradora, y la inteligencia artificial lee la cabecera y todas las líneas del documento.',
    accion: async () => { await clic(pagina.getByRole('button', { name: 'Nuevo reporte' }).or(pagina.getByRole('link', { name: 'Nuevo reporte' })).first()); await pausa(900); await subirArchivo(/Importar desde PDF/, reporte); await pausa(2000) } },
  { narr: 'Cada línea se cruza con la póliza del sistema por su número y su anexo. Las que coinciden quedan listas, y las dudosas se revisan a mano.',
    accion: async () => { await clic(botonGuardar()); await pausa(1800); await pagina.getByRole('dialog').hover().catch(() => {}); await desplazar(420, 14); await pausa(600); await desplazar(-420, 10) } },
  { narr: 'Al confirmar se crean los pagos, cada póliza queda como pagada y se calculan las comisiones recibidas.',
    accion: async () => { await clic(pagina.getByRole('dialog').getByRole('button').last()); await pausa(1800); await desplazar(560); await pausa(900) } },
  { narr: 'Con los reportes se genera la cuenta de cobro a la aseguradora, con IVA y retenciones, lista para descargar en PDF.',
    accion: async () => { await ir('Facturas'); await pausa(900); await clic(pagina.getByText(/2-274\d/).first()); await pagina.waitForLoadState('networkidle').catch(() => {}); await pausa(900); await mover(boton(/Cuenta de cobro/).or(pagina.getByText(/Cuenta de cobro \(PDF\)/)).first()); await pausa(1500) } },
  { narr: 'El control de vencimientos usa un semáforo. Muestra a quién llamar primero, con su teléfono y su WhatsApp, y permite marcar en qué va cada renovación.',
    accion: async () => {
      await ir('Inicio'); await pausa(500)
      await clic(enlace(/^Vencimientos/).first()); await pagina.waitForLoadState('networkidle').catch(() => {}); await pausa(1200)
      await clic(boton(/urgentes/).first()); await pausa(1100)
      await intentar('estado', async () => { await pagina.locator('select').nth(1).selectOption({ label: 'Contactado' }); await pausa(900) })
      await clic(boton(/urgentes/).first()); await pausa(400)
    } },
  { narr: 'Para los vehículos, el sistema vigila el SOAT por placa: quién no lo tiene, a quién se le venció, y con un clic prepara el registro del nuevo.',
    accion: async () => { await ir('Inicio'); await pausa(400); await clic(enlace(/SOAT de los vehículos/).first()); await pagina.waitForLoadState('networkidle').catch(() => {}); await pausa(1500); await mover(enlace(/Registrar SOAT/).first()); await pausa(1200) } },
  { narr: 'Para la gerencia, el tablero reúne la producción por aseguradora, ramo, producto, asesor o cliente, con filtros de fechas como en una hoja de análisis.',
    accion: async () => { await ir(/^Tablero gerencial/); await pausa(1800); await clic(pagina.getByRole('tab', { name: 'Producción' })); await pausa(1200); await clic(pagina.getByRole('button', { name: 'Asesor', exact: true })); await pausa(1500); await desplazar(360); await pausa(600) } },
  { narr: 'También muestra los vencimientos y la tasa de renovación, la cartera por recaudar y la comisión recibida de cada aseguradora.',
    accion: async () => { await pagina.mouse.wheel(0, -2000); await clic(pagina.getByRole('tab', { name: 'Renovaciones' })); await pausa(1800); await clic(pagina.getByRole('tab', { name: 'Cartera y comisiones' })); await pausa(1800); await desplazar(420); await pausa(600) } },
  { narr: 'Y compara el avance contra las metas del año, por agencia y por asesor.',
    accion: async () => { await pagina.mouse.wheel(0, -3000); await clic(pagina.getByRole('tab', { name: 'Metas' })); await pausa(2200); await desplazar(380) } },
  { narr: 'El administrador controla los usuarios y sus roles: administrador, supervisor y digitador, cada uno con los permisos que le corresponden.',
    accion: async () => { await ir('Catálogos'); await pausa(1200); await clic(enlace(/^Usuarios/).first()); await pagina.waitForLoadState('networkidle').catch(() => {}); await pausa(2200) } },
  { narr: 'El sistema también detecta situaciones dudosas, como pagos mayores a la prima o pólizas repetidas, y las deja como casos para aclarar.',
    accion: async () => { await ir(/^Casos por revisar/); await pausa(2500) } },
  { narr: 'Y el administrador ve cuánto se lee con inteligencia artificial y cuánto cuesta, por día y por mes, para tener el gasto bajo control.',
    accion: async () => { await ir('Consumo de IA'); await pausa(2800) } },
  { narr: 'Menos digitación, más control sobre la agencia. Los datos que vio en este video son ficticios.',
    accion: async () => { await pausa(600) }, tarjeta: ['SegurApp', 'Menos digitación, más control', 'Todos los datos de esta demostración son ficticios'], final: true },
]

// ── Ejecución ───────────────────────────────────────────────────────────────
const ffmpeg = buscarFfmpeg()
console.log('Voz:', SIN_VOZ ? 'desactivada' : 'generando…')
const voces = SIN_VOZ ? guion.map(() => ({ ruta: null, dur: 5 })) : generarVoz(guion.map((p) => p.narr))
console.log('Narración total:', voces.reduce((s, v) => s + v.dur, 0).toFixed(0), 's')

const { url, cerrar } = await servir()
const navegador = await chromium.launch({ channel: 'chrome', headless: true })
const contexto = await navegador.newContext({ viewport: { width: ANCHO, height: ALTO }, recordVideo: { dir: crudo, size: { width: ANCHO, height: ALTO } }, locale: 'es-CO' })
await contexto.addInitScript(CAPA)
pagina = await contexto.newPage()
const tPagina = Date.now()
pagina.on('pageerror', (e) => console.warn('  ⚠ error de página:', String(e).slice(0, 160)))

await pagina.goto(url, { waitUntil: 'networkidle' })
await pagina.waitForTimeout(600)
await pagina.mouse.move(ANCHO / 2, ALTO / 2)
const tInicio = Date.now()
const marcas = []

for (let i = 0; i < guion.length; i++) {
  const p = guion[i]
  console.log(`Paso ${i + 1}/${guion.length}: ${p.narr.slice(0, 70)}…`)
  marcas.push({ ruta: voces[i].ruta, inicio: (Date.now() - tPagina) / 1000 + DESFASE_AUDIO })
  if (p.tarjeta) await pagina.evaluate(([t, s, pie]) => { window.__tarjeta(t, s, pie); window.__sub(null) }, p.tarjeta)
  else await pagina.evaluate((t) => { window.__tarjeta(null); window.__sub(t) }, p.narr)
  if (p.tarjeta) await pagina.evaluate((t) => window.__sub(t), p.narr)
  await Promise.all([intentar(`paso ${i + 1}`, p.accion), pausa(voces[i].dur * 1000 + 700)])
  if (p.tarjeta && !p.final) await pagina.evaluate(() => window.__tarjeta(null))
}
await pausa(1200)
await pagina.evaluate(() => window.__sub(null))
await pausa(400)

const video = pagina.video()
await contexto.close()
await navegador.close()
await cerrar()
const crudoWebm = await video.path()
const corte = (tInicio - tPagina) / 1000 - 0.1
console.log('Video sin editar:', crudoWebm, '(recorte inicial', corte.toFixed(1), 's)')

// Une video + voz
const salidaMp4 = join(SALIDA, `${NOMBRE}.mp4`)
const args = ['-y', '-ss', corte.toFixed(2), '-i', crudoWebm]
const conVoz = !SIN_VOZ
if (conVoz) for (const m of marcas) args.push('-i', m.ruta)
if (conVoz) {
  const filtros = marcas.map((m, i) => `[${i + 1}:a]adelay=${Math.max(0, Math.round((m.inicio - corte) * 1000))}:all=1[a${i}]`)
  args.push('-filter_complex', `${filtros.join(';')};${marcas.map((_, i) => `[a${i}]`).join('')}amix=inputs=${marcas.length}:normalize=0:dropout_transition=0[aout]`, '-map', '0:v', '-map', '[aout]')
} else args.push('-map', '0:v')
args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '25')
if (conVoz) args.push('-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-shortest')
args.push(salidaMp4)
const r = spawnSync(ffmpeg, args, { encoding: 'utf8' })
if (r.status !== 0) {
  console.error(r.stderr?.slice(-1500))
  throw new Error('ffmpeg falló')
}
console.log('\n✔ Video listo:', salidaMp4)
