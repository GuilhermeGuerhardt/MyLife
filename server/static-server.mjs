/**
 * Servidor estático do Life.
 *
 * O app é 100% client-side: não existe backend, só arquivos em `dist/`. Este
 * processo é a coisa mais simples que os entrega — `node:http` puro, sem uma
 * única dependência, porque um servidor que fica ligado o dia inteiro não
 * deveria carregar o Vite inteiro na memória para copiar bytes de disco.
 *
 * Serve direto do disco a cada requisição, sem cache em memória: assim
 * `npm run build` publica a versão nova sem precisar reiniciar nada.
 */

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('../dist/', import.meta.url)))
const PORT = Number(process.env.LIFE_PORT ?? 5173)

/**
 * Só o laço local. Expor na rede exigiria pensar em quem mais alcança a porta,
 * e o pedido é o oposto disso — o app é desta máquina.
 * Para acessar do celular, troque para '0.0.0.0' e libere a porta no firewall.
 */
const HOST = process.env.LIFE_HOST ?? '127.0.0.1'

/** Combinado com o supervisor: porta ocupada não é motivo para reiniciar em laço. */
const EXIT_PORT_BUSY = 3

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

/**
 * O que nunca pode ficar preso no cache do navegador.
 *
 * `sw.js` é a raiz da atualização: se ele mesmo vier de cache, o app trava numa
 * versão antiga para sempre e nenhum build novo chega. `index.html` aponta para
 * os bundles com hash, então também precisa ser sempre fresco.
 */
function cacheHeader(pathname) {
  if (/\/(sw|workbox-[^/]+)\.js$/.test(pathname)) return 'no-cache'
  if (pathname === '/' || pathname.endsWith('.html')) return 'no-cache'
  if (pathname.endsWith('.webmanifest')) return 'no-cache'
  // Os arquivos de /assets carregam hash no nome: mudou o conteúdo, mudou a URL.
  if (pathname.startsWith('/assets/')) return 'public, max-age=31536000, immutable'
  return 'public, max-age=3600'
}

/**
 * Resolve a URL para um caminho dentro de `dist/`, ou `null` se escapar dele.
 *
 * `decodeURIComponent` antes de normalizar é o ponto: sem isso, `%2e%2e%2f`
 * passaria pela checagem como texto inocente e viraria `../` só na hora de
 * abrir o arquivo.
 */
function safePath(pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const candidate = resolve(join(ROOT, normalize(decoded)))
  if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) return null
  return candidate
}

async function fileInfo(path) {
  try {
    const info = await stat(path)
    return info.isFile() ? info : null
  } catch {
    return null
  }
}

function send(res, status, headers, body) {
  res.writeHead(status, headers)
  res.end(body)
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, { 'content-type': 'text/plain; charset=utf-8', allow: 'GET, HEAD' }, 'Método não permitido')
    return
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  let pathname = url.pathname

  // Sonda usada pelos scripts para saber se o servidor está de pé.
  if (pathname === '/__health') {
    send(res, 200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      JSON.stringify({ ok: true, pid: process.pid, uptime: Math.round(process.uptime()) }))
    return
  }

  const requested = safePath(pathname === '/' ? '/index.html' : pathname)
  if (!requested) {
    send(res, 400, { 'content-type': 'text/plain; charset=utf-8' }, 'Caminho inválido')
    return
  }

  let target = await fileInfo(requested)

  // Rota do app, não arquivo: `/financeiro/importar` não existe em disco, e é o
  // React Router quem resolve. Só vale para navegação — um /assets/x.js que
  // sumiu precisa dar 404, senão o navegador recebe HTML no lugar de script e
  // o erro que aparece no console não tem nada a ver com a causa.
  if (!target && !extname(pathname) && !pathname.startsWith('/assets/')) {
    pathname = '/index.html'
    const fallback = safePath(pathname)
    target = fallback ? await fileInfo(fallback) : null
    if (target) {
      streamFile(req, res, fallback, pathname, target)
      return
    }
  }

  if (!target) {
    send(res, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Não encontrado')
    return
  }

  streamFile(req, res, requested, pathname, target)
})

function streamFile(req, res, path, pathname, info) {
  const headers = {
    'content-type': MIME[extname(path).toLowerCase()] ?? 'application/octet-stream',
    'content-length': info.size,
    'cache-control': cacheHeader(pathname),
    'last-modified': info.mtime.toUTCString(),
    'x-content-type-options': 'nosniff',
  }

  if (req.method === 'HEAD') {
    send(res, 200, headers)
    return
  }

  res.writeHead(200, headers)
  const stream = createReadStream(path)
  stream.pipe(res)
  stream.on('error', () => res.destroy())
}

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[life] porta ${PORT} já está em uso — outro servidor está respondendo por ela`)
    process.exit(EXIT_PORT_BUSY)
  }
  console.error(`[life] erro no servidor: ${error.message}`)
  process.exit(1)
})

// Encerrar de verdade quando o supervisor (ou o Windows) pedir.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}

const dist = await fileInfo(join(ROOT, 'index.html'))
if (!dist) {
  console.error(`[life] ${ROOT} não tem index.html — rode "Atualizar Life.bat" para gerar o build`)
  process.exit(2)
}

server.listen(PORT, HOST, () => {
  console.log(`[life] servindo ${ROOT} em http://${HOST}:${PORT} (pid ${process.pid})`)
})
