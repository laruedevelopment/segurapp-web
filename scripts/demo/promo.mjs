// Video COMERCIAL corto y dinámico de SegurApp (para ofrecerlo a otras agencias), con datos ficticios:
// ganchos con texto grande, cortinillas entre escenas, acercamientos a la pantalla, voz y música propia.
// Uso:  npm run demo:build  &&  node scripts/demo/promo.mjs
// Variables: CONTACTO="texto de contacto del cierre", SIN_VOZ=1, SIN_MUSICA=1, VOZ=gonzalo|salome, NOMBRE, SALIDA
import { chromium } from 'playwright-core'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { servir } from './servidor.mjs'
import { crearPdfs } from './pdfs.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const SALIDA = resolve(process.env.SALIDA ?? 'demo-video')
const NOMBRE = process.env.NOMBRE ?? 'SegurApp_promo'
const SIN_VOZ = process.env.SIN_VOZ === '1'
const SIN_MUSICA = process.env.SIN_MUSICA === '1'
const CONTACTO = process.env.CONTACTO ?? ''
const VOZ = { salome: 'es-CO-SalomeNeural', gonzalo: 'es-CO-GonzaloNeural' }[(process.env.VOZ ?? 'gonzalo').toLowerCase()] ?? 'es-CO-GonzaloNeural'
const ANCHO = 1600
const ALTO = 900
const pausa = (ms) => new Promise((r) => setTimeout(r, ms))

const trabajo = join(SALIDA, 'promo')
rmSync(trabajo, { recursive: true, force: true })
mkdirSync(trabajo, { recursive: true })
const { poliza, reporte } = crearPdfs(join(SALIDA, 'archivos'))

const py = spawnSync('python', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' })
const ffmpeg = process.env.FFMPEG ?? py.stdout?.trim()
if (!ffmpeg || !existsSync(ffmpeg)) throw new Error('No encuentro ffmpeg. Instálelo con:  python -m pip install imageio-ffmpeg')
const correr = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 })
  if (r.status !== 0) throw new Error(`${cmd} falló: ${(r.stderr || r.stdout || '').slice(-800)}`)
}

function duracionWav(ruta) {
  const b = readFileSync(ruta)
  const porSegundo = b.readUInt32LE(28)
  let off = 12
  while (off < b.length - 8) {
    const tam = b.readUInt32LE(off + 4)
    if (b.toString('ascii', off, off + 4) === 'data') return tam / porSegundo
    off += 8 + tam
  }
  throw new Error('WAV sin datos: ' + ruta)
}

function voz(texto, i) {
  if (SIN_VOZ) return { ruta: null, dur: 3.5 }
  const txt = join(trabajo, `v${i}.txt`)
  const mp3 = join(trabajo, `v${i}.mp3`)
  const wav = join(trabajo, `v${i}.wav`)
  writeFileSync(txt, texto, 'utf8')
  correr('python', ['-m', 'edge_tts', '--voice', VOZ, '--rate=+10%', '--file', txt, '--write-media', mp3])
  correr(ffmpeg, ['-y', '-loglevel', 'error', '-i', mp3, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB', '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', wav])
  return { ruta: wav, dur: duracionWav(wav) }
}

// ── Capa visual ─────────────────────────────────────────────────────────────
const CAPA = `(() => {
  const montar = () => {
    if (document.getElementById('__p')) return
    const estilo = document.createElement('style')
    estilo.textContent = \`
      /* Pantallas que todavía no se ofrecen */
      a[href$="/oportunidades"],a[href$="/empresa"]{display:none!important}
      body{transition:transform .9s cubic-bezier(.65,0,.25,1)}
      #__p{position:fixed;inset:0;pointer-events:none;z-index:2147483647;font-family:Inter,'Segoe UI',system-ui,sans-serif;overflow:hidden}
      #__cortina{position:absolute;inset:-10% -25%;background:linear-gradient(115deg,#0f2a44,#1c4870 55%,#1e9b4e);transform:translateX(-120%) skewX(-12deg);transition:transform .42s cubic-bezier(.7,0,.2,1);z-index:3}
      #__cortina.on{transform:translateX(0) skewX(-12deg)}
      #__cortina.fuera{transform:translateX(120%) skewX(-12deg)}
      #__tit{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;color:#fff;z-index:4;padding:0 90px}
      #__tit .g{font-size:84px;font-weight:900;letter-spacing:-2px;line-height:1.08;opacity:0;transform:translateY(60px) scale(.9);animation:__sube .55s cubic-bezier(.2,1.4,.4,1) forwards}
      #__tit .s{font-size:36px;font-weight:600;opacity:0;animation:__sube .55s ease-out forwards;color:#d7f5e3}
      #__tit .chips{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;max-width:1200px}
      #__tit .chip{font-size:26px;font-weight:700;padding:10px 22px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3);opacity:0;animation:__sube .4s ease-out forwards}
      @keyframes __sube{to{opacity:1;transform:translateY(0) scale(1)}}
      #__rot{position:absolute;left:40px;bottom:40px;z-index:2;display:flex;align-items:center;gap:18px;padding:18px 30px 18px 22px;border-radius:18px;background:#0f2a44;color:#fff;
        box-shadow:0 16px 40px rgba(0,0,0,.35);transform:translateX(-130%);transition:transform .5s cubic-bezier(.2,1.2,.35,1)}
      #__rot.on{transform:translateX(0)}
      #__rot i{width:10px;align-self:stretch;border-radius:6px;background:#2fbf6b}
      #__rot b{display:block;font-size:38px;font-weight:850;letter-spacing:-.5px}
      #__rot span{display:block;font-size:21px;opacity:.85;margin-top:2px}
      #__cur{position:absolute;left:0;top:0;width:38px;height:38px;transform:translate(-100px,-100px);filter:drop-shadow(0 3px 4px rgba(0,0,0,.45));z-index:2}
      .__rip{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;border:5px solid #f5b301;animation:__rip .6s ease-out forwards;z-index:2}
      @keyframes __rip{from{transform:scale(.4);opacity:1}to{transform:scale(4);opacity:0}}
    \`
    document.head.appendChild(estilo)
    const raiz = document.createElement('div')
    raiz.id = '__p'
    raiz.innerHTML = '<div id="__cortina" class="on"></div><div id="__tit"></div><div id="__rot"><i></i><div><b></b><span></span></div></div>' +
      '<svg id="__cur" viewBox="0 0 24 24"><path d="M3 2l17 8.2-7.2 2.3L10.3 20z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    document.documentElement.appendChild(raiz)
    const cur = raiz.querySelector('#__cur')
    addEventListener('mousemove', (e) => { cur.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)' }, true)
    addEventListener('mousedown', (e) => {
      const r = document.createElement('div'); r.className = '__rip'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'
      raiz.appendChild(r); setTimeout(() => r.remove(), 650)
    }, true)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar()
  const el = (id) => { montar(); return document.getElementById(id) }
  window.__cortina = (cerrar) => {
    const c = el('__cortina')
    if (cerrar) { c.style.transition = 'none'; c.className = ''; void c.offsetWidth; c.style.transition = ''; c.className = 'on' } else c.className = 'fuera'
  }
  // lineas: [{t:'texto', c:'g'|'s', d:retardo}] y chips opcionales
  window.__titulo = (lineas, chips) => {
    const t = el('__tit'); t.textContent = ''
    for (const l of lineas || []) { const d = document.createElement('div'); d.className = l.c; d.textContent = l.t; d.style.animationDelay = (l.d || 0) + 's'; t.appendChild(d) }
    if (chips) {
      const g = document.createElement('div'); g.className = 'chips'
      chips.forEach((x, i) => { const s = document.createElement('div'); s.className = 'chip'; s.textContent = x; s.style.animationDelay = (0.5 + i * 0.16) + 's'; g.appendChild(s) })
      t.appendChild(g)
    }
  }
  window.__rotulo = (titulo, sub) => {
    const r = el('__rot')
    if (!titulo) { r.classList.remove('on'); return }
    r.querySelector('b').textContent = titulo; r.querySelector('span').textContent = sub || ''; r.classList.add('on')
  }
})()`

// ── Acciones ────────────────────────────────────────────────────────────────
let pagina
const avisos = []
const intentar = async (nombre, fn) => {
  try {
    await fn()
  } catch (e) {
    avisos.push(`${nombre}: ${String(e.message ?? e).split(String.fromCharCode(10))[0].slice(0, 160)}`)
  }
}
const caja = async (loc) => {
  await loc.first().scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {})
  const b = await loc.first().boundingBox({ timeout: 4000 })
  if (!b) throw new Error('sin posición')
  return b
}
const mover = async (loc) => {
  const b = await caja(loc)
  await pagina.mouse.move(b.x + Math.min(b.width / 2, 120), b.y + b.height / 2, { steps: 16 })
}
const clic = async (loc) => {
  await mover(loc)
  await loc.first().click({ timeout: 5000 })
  await pausa(180)
}
/** Acercamiento de cámara hacia un elemento (o un punto relativo de la pantalla). */
const acercar = async (objetivo, escala = 1.45) => {
  let x = ANCHO / 2
  let y = ALTO / 2
  if (Array.isArray(objetivo)) [x, y] = [ANCHO * objetivo[0], ALTO * objetivo[1]]
  else {
    const b = await caja(objetivo)
    ;[x, y] = [b.x + b.width / 2, b.y + b.height / 2]
  }
  await pagina.evaluate(([px, py_, s]) => {
    const r = document.body.getBoundingClientRect()
    document.body.style.transformOrigin = (px - r.left) + 'px ' + (py_ - r.top) + 'px'
    document.body.style.transform = 'scale(' + s + ')'
  }, [x, y, escala])
  await pausa(950)
}
const alejar = async () => {
  await pagina.evaluate(() => { document.body.style.transform = 'scale(1)' })
  await pausa(900)
  await pagina.evaluate(() => { document.body.style.transform = ''; document.body.style.transformOrigin = '' })
}
const desplazar = async (dy, pasos = 10) => {
  await pagina.mouse.move(ANCHO * 0.62, ALTO * 0.55, { steps: 4 })
  for (let i = 0; i < pasos; i++) {
    await pagina.mouse.wheel(0, dy / pasos)
    await pausa(45)
  }
}
const enlace = (nombre) => pagina.getByRole('link', { name: nombre })
const boton = (nombre) => pagina.getByRole('button', { name: nombre })
const ir = async (nombre) => {
  await enlace(nombre).first().click({ timeout: 5000 })
  await pagina.waitForLoadState('networkidle').catch(() => {})
  await pausa(500)
}
const subir = async (nombre, ruta) => {
  const [selector] = await Promise.all([pagina.waitForEvent('filechooser'), clic(boton(nombre).first())])
  await selector.setFiles(ruta)
}
const rotulo = (t, s) => pagina.evaluate(([a, b]) => window.__rotulo(a, b), [t, s])
const titulo = (lineas, chips) => pagina.evaluate(([l, c]) => window.__titulo(l, c), [lineas, chips ?? null])
const cortina = async (cerrar) => {
  await pagina.evaluate((c) => window.__cortina(c), cerrar)
  await pausa(450)
}

// ── Guion ───────────────────────────────────────────────────────────────────
// carta: pantalla de texto sobre la cortina · escena: preparar (oculto) y luego actuar (visible)
const g = (t, d = 0) => ({ t, c: 'g', d })
const s = (t, d = 0.35) => ({ t, c: 's', d })
const guion = [
  { narr: '¿Pólizas en hojas de Excel?', carta: [g('¿Pólizas en hojas de Excel?')], min: 1.8 },
  { narr: '¿Renovaciones que se pasan?', carta: [g('¿Renovaciones que se pasan?')], min: 1.8 },
  { narr: '¿Comisiones que no cuadran?', carta: [g('¿Comisiones que no cuadran?')], min: 1.8 },
  { narr: 'Conozca SegurApp: todos sus ramos y toda su agencia, en un solo lugar.', carta: [g('SegurApp'), s('Para todos los seguros que usted vende')],
    chips: ['Vida', 'Salud y accidentes', 'Hogar', 'Pymes y empresas', 'Cumplimiento', 'Responsabilidad civil', 'Vehículos', 'y los que usted maneje'], min: 4.2 },

  { narr: 'Sea de cumplimiento, vida u hogar: suba el PDF y la inteligencia artificial digita la póliza por usted.',
    preparar: async () => { await ir('Pólizas'); await pagina.getByRole('button', { name: 'Nueva póliza' }).or(pagina.getByRole('link', { name: 'Nueva póliza' })).first().click(); await pausa(700) },
    actuar: async () => {
      await rotulo('Suba el PDF y listo', 'La inteligencia artificial llena la póliza, del ramo que sea')
      await subir(/Importar desde PDF/, poliza)
      await acercar([0.55, 0.2], 1.3)
      await pausa(1700)
      await alejar()
      await desplazar(330)
      await acercar([0.52, 0.45], 1.45)
      await pausa(900)
      await alejar()
      await intentar('asesor', async () => {
        await clic(pagina.locator('label', { hasText: 'Asesor 1' }).first().locator('button').first())
        await clic(pagina.getByRole('option', { name: /Carolina/ }).first().or(pagina.getByText('Carolina Mejía').first()))
      })
      await pagina.mouse.wheel(0, -4000)
      await pausa(300)
      await intentar('guardar póliza', async () => { await clic(pagina.getByRole('button', { name: 'Guardar', exact: true })) })
      await pausa(1200)
    } },
  { narr: 'El semáforo de vencimientos le dice a quién renovar primero, en cualquier ramo. Un clic, y está en su WhatsApp.',
    preparar: async () => {
      await intentar('cerrar aviso', async () => { await boton('Listo').click({ timeout: 4000 }); await pausa(300) })
      await ir('Inicio'); await enlace(/^Vencimientos/).first().click(); await pagina.waitForLoadState('networkidle').catch(() => {}); await pausa(700) },
    actuar: async () => {
      await rotulo('Que no se le pase ninguna', 'Semáforo, WhatsApp y estado de cada renovación')
      await acercar(boton(/urgentes/), 1.55)
      await clic(boton(/urgentes/))
      await alejar()
      await acercar(pagina.locator('a[href^="https://wa.me"]'), 1.7)
      await mover(pagina.locator('a[href^="https://wa.me"]'))
      await pausa(900)
      await alejar()
    } },
  { narr: 'Encuentre cualquier póliza por cliente, ramo, contrato o aseguradora.',
    preparar: async () => { await ir('Pólizas') },
    actuar: async () => {
      await rotulo('Todo a la mano', 'Cliente, documento, ramo, contrato o aseguradora')
      const buscar = pagina.getByPlaceholder(/Buscar por código/)
      await acercar(buscar, 1.35)
      for (const texto of ['Hogar', 'Vida', 'Cumplimiento', 'Pyme']) {
        await buscar.fill('')
        await buscar.pressSequentially(texto, { delay: 45 })
        await pausa(850)
      }
      await alejar()
    } },
  { narr: 'Suba el reporte de la aseguradora: cada pago se cruza con su póliza.',
    preparar: async () => {
      await ir('Reportes de Comisiones')
      await pagina.getByRole('button', { name: 'Nuevo reporte' }).or(pagina.getByRole('link', { name: 'Nuevo reporte' })).first().click()
      await pausa(700)
    },
    actuar: async () => {
      await rotulo('Comisiones que sí cuadran', 'Cada pago se cruza con su póliza y anexo')
      await subir(/Importar desde PDF/, reporte)
      await intentar('lectura del reporte', async () => { await pagina.getByText(/Se detectaron/).first().waitFor({ timeout: 9000 }) })
      await intentar('guardar reporte', async () => { await clic(pagina.getByRole('button', { name: 'Guardar', exact: true })) })
      await intentar('cruce', async () => { await pagina.getByRole('dialog').waitFor({ timeout: 6000 }) })
      await pausa(600)
      await acercar([0.4, 0.4], 1.35)
      await pausa(1600)
      await alejar()
    } },
  { narr: 'La cuenta de cobro sale lista, con sus impuestos.',
    preparar: async () => {
      await intentar('confirmar cruce', async () => { await pagina.getByRole('dialog').getByRole('button').last().click({ timeout: 3000 }); await pausa(700) })
      await ir('Facturas')
      await pagina.getByText(/2-274[0-9]/).first().click()
      await pagina.waitForLoadState('networkidle').catch(() => {})
      await pausa(600)
    },
    actuar: async () => {
      await rotulo('Cobre sin enredos', 'IVA y retenciones calculados, PDF listo')
      await acercar([0.55, 0.45], 1.4)
      await pausa(700)
      await alejar()
      await mover(boton(/Cuenta de cobro/).or(pagina.getByText(/Cuenta de cobro \(PDF\)/)))
    } },
  { narr: 'Y la gerencia ve la producción por ramo, la cartera, las renovaciones y las metas, al instante.',
    preparar: async () => { await ir(/^Tablero gerencial/); await pausa(900); await pagina.getByRole('tab', { name: 'Producción' }).click(); await pausa(500) },
    actuar: async () => {
      await rotulo('Decida con datos', 'Producción, cartera, renovaciones y metas')
      await intentar('ramo', async () => { await clic(pagina.getByRole('button', { name: 'Ramo', exact: true })) })
      await desplazar(260)
      await acercar([0.55, 0.55], 1.3)
      await pausa(500)
      await alejar()
      await pagina.mouse.wheel(0, -2000)
      await clic(pagina.getByRole('tab', { name: 'Cartera y comisiones' }))
      await pausa(900)
      await clic(pagina.getByRole('tab', { name: 'Metas' }))
      await intentar('metas', async () => { await pagina.getByText('Metas y cumplimiento').first().waitFor({ timeout: 6000 }) })
      await pausa(1700)
    } },
  { narr: 'SegurApp. Menos digitación y más ventas. Pida hoy su demostración.',
    carta: [g('Menos digitación.'), g('Más tiempo para vender.', 0.45), s(CONTACTO ? `Pida su demostración · ${CONTACTO}` : 'Pida hoy su demostración', 1.1), s('Datos ficticios con fines demostrativos', 1.5)], min: 5 },
]

// ── Ejecución ───────────────────────────────────────────────────────────────
console.log('Generando voz…')
const voces = guion.map((p, i) => voz(p.narr, i))
const { url, cerrar } = await servir()
const navegador = await chromium.launch({ channel: 'chrome', headless: true })
const contexto = await navegador.newContext({ viewport: { width: ANCHO, height: ALTO }, recordVideo: { dir: trabajo, size: { width: ANCHO, height: ALTO } }, locale: 'es-CO' })
await contexto.addInitScript(CAPA)
pagina = await contexto.newPage()
const tPagina = Date.now()
pagina.on('pageerror', (e) => avisos.push('error de página: ' + String(e).slice(0, 160)))
await pagina.goto(url, { waitUntil: 'networkidle' })
await pausa(700)
const tInicio = Date.now()
const marcas = []
const marcar = (i) => marcas.push({ ruta: voces[i].ruta, inicio: (Date.now() - tPagina) / 1000 + 0.2 })

for (let i = 0; i < guion.length; i++) {
  const p = guion[i]
  console.log(`Escena ${i + 1}/${guion.length}: ${p.narr.slice(0, 60)}`)
  const anteriorEsCarta = i === 0 || !!guion[i - 1].carta
  await rotulo(null)
  if (!anteriorEsCarta) await cortina(true)
  if (p.carta) {
    marcar(i)
    await titulo(p.carta, p.chips)
    await pausa(Math.max(p.min * 1000, voces[i].dur * 1000 + 350))
    if (!guion[i + 1]?.carta && i < guion.length - 1) await titulo([])
  } else {
    await titulo([])
    await intentar(`preparar ${i + 1}`, p.preparar)
    await cortina(false)
    marcar(i)
    await Promise.all([intentar(`escena ${i + 1}`, p.actuar), pausa(voces[i].dur * 1000 + 500)])
  }
}
const tFin = Date.now()

const video = pagina.video()
await contexto.close()
await navegador.close()
await cerrar()
const crudo = await video.path()
const corte = (tInicio - tPagina) / 1000
const duracion = (tFin - tInicio) / 1000

const salidaMp4 = join(SALIDA, `${NOMBRE}.mp4`)
const args = ['-y', '-ss', corte.toFixed(2), '-i', crudo]
const pistas = []
const filtros = []
if (!SIN_VOZ) {
  marcas.forEach((m) => args.push('-i', m.ruta))
  marcas.forEach((m, i) => filtros.push(`[${i + 1}:a]adelay=${Math.max(0, Math.round((m.inicio - corte) * 1000))}:all=1[a${i}]`))
  filtros.push(`${marcas.map((_, i) => `[a${i}]`).join('')}amix=inputs=${marcas.length}:normalize=0:dropout_transition=0,apad,atrim=0:${duracion.toFixed(2)}[voz]`)
  pistas.push('voz')
}
if (!SIN_MUSICA) {
  const wav = join(trabajo, 'musica.wav')
  correr('python', [join(AQUI, 'musica.py'), wav, duracion.toFixed(2)])
  args.push('-i', wav)
  const n = SIN_VOZ ? 1 : marcas.length + 1
  filtros.push(`[${n}:a]volume=${SIN_VOZ ? 0.6 : 0.22}[mus]`)
  pistas.push('mus')
}
if (pistas.length) {
  // Con voz y música, la música baja sola mientras se habla.
  if (pistas.length === 2) filtros.push('[voz]asplit=2[v1][v2]', '[mus][v1]sidechaincompress=threshold=0.03:ratio=5:attack=20:release=350[baja]', '[baja][v2]amix=inputs=2:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=11[aout]')
  else filtros.push(`[${pistas[0]}]loudnorm=I=-15:TP=-1.5:LRA=11[aout]`)
  args.push('-filter_complex', filtros.join(';'), '-map', '0:v', '-map', '[aout]', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100')
} else args.push('-map', '0:v')
args.push('-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-t', duracion.toFixed(2), '-movflags', '+faststart', salidaMp4)
correr(ffmpeg, args)
for (const a of avisos) console.warn('  ⚠ ' + a)
console.log(`\n✔ Video listo (${duracion.toFixed(0)} s): ${salidaMp4}`)
