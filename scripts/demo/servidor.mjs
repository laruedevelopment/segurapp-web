// Sirve la carpeta dist-demo en un puerto local (con la regla de "cualquier ruta → index.html").
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'dist-demo')
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' }

export async function servir(puerto = 0) {
  const servidor = createServer(async (req, res) => {
    let ruta = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname))
    while (ruta.startsWith('/') || ruta.startsWith(String.fromCharCode(92))) ruta = ruta.slice(1)
    for (const candidato of [join(RAIZ, ruta), join(RAIZ, 'index.html')]) {
      if (!candidato.startsWith(RAIZ)) continue
      try {
        const datos = await readFile(candidato)
        res.writeHead(200, { 'content-type': TIPOS[extname(candidato)] ?? 'application/octet-stream' })
        return res.end(datos)
      } catch {
        /* siguiente candidato */
      }
    }
    res.writeHead(404).end()
  })
  await new Promise((r) => servidor.listen(puerto, '127.0.0.1', r))
  const url = `http://127.0.0.1:${servidor.address().port}/`
  return { url, cerrar: () => new Promise((r) => servidor.close(r)) }
}
