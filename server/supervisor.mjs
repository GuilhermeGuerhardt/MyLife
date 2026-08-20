/**
 * Supervisor do servidor do Life.
 *
 * Mantém `static-server.mjs` de pé: se ele morrer — por bug, por falta de
 * memória, por alguém encerrar o processo — sobe outro. O Agendador de Tarefas
 * do Windows também sabe reiniciar tarefa que falha, mas só quando a tarefa
 * inteira termina; aqui o reinício é imediato e o log fica em um lugar só.
 *
 * A espera cresce a cada queda rápida. Sem isso, um erro que mata o servidor no
 * primeiro segundo viraria um laço girando o processador para sempre, e o log
 * encheria o disco antes de alguém perceber.
 */

import { spawn } from 'node:child_process'
import { appendFileSync, renameSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SERVER = fileURLToPath(new URL('./static-server.mjs', import.meta.url))
const LOG = fileURLToPath(new URL('./life-server.log', import.meta.url))

/** Combinado com o servidor: a porta está ocupada. */
const EXIT_PORT_BUSY = 3

/** Rodou pelo menos isto? Então foi uma queda, não um erro de partida. */
const HEALTHY_MS = 30_000
const FIRST_DELAY_MS = 1_000
const MAX_DELAY_MS = 60_000
const MAX_LOG_BYTES = 1_000_000

/** Depois disso, aceitar que quem responde na porta é outra instância. */
const PORT_BUSY_LIMIT = 3

let delay = FIRST_DELAY_MS
let portBusyStreak = 0
let child = null
let stopping = false

function rotateIfBig() {
  try {
    if (statSync(LOG).size > MAX_LOG_BYTES) renameSync(LOG, `${LOG}.old`)
  } catch {
    // Log ainda não existe, ou está em uso: nenhum dos dois é motivo para parar.
  }
}

function log(message) {
  const line = `${new Date().toISOString()} ${message}\n`
  rotateIfBig()
  try {
    appendFileSync(LOG, line)
  } catch {
    // Um log que não pode ser escrito não pode derrubar o servidor.
  }
}

/** Repassa a saída do filho linha a linha, para o log não virar um bloco só. */
function pipeOutput(stream, prefix) {
  let buffer = ''
  stream.setEncoding('utf8')
  stream.on('data', (chunk) => {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) if (line.trim()) log(`${prefix} ${line.trim()}`)
  })
}

function start() {
  const startedAt = Date.now()

  child = spawn(process.execPath, [SERVER], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: process.env,
  })

  pipeOutput(child.stdout, '   ')
  pipeOutput(child.stderr, '!! ')

  child.on('error', (error) => log(`!! não consegui iniciar o servidor: ${error.message}`))

  child.on('exit', (code, signal) => {
    child = null
    if (stopping) return

    const uptime = Date.now() - startedAt

    if (code === EXIT_PORT_BUSY) {
      portBusyStreak++
      if (portBusyStreak >= PORT_BUSY_LIMIT) {
        log(`== a porta segue ocupada após ${PORT_BUSY_LIMIT} tentativas; encerrando`)
        log('== provavelmente já existe um servidor do Life rodando — isto aqui era a segunda cópia')
        process.exit(0)
      }
    } else {
      portBusyStreak = 0
    }

    // Só quem se manteve de pé um tempo razoável merece recomeçar do zero.
    delay = uptime >= HEALTHY_MS ? FIRST_DELAY_MS : Math.min(delay * 2, MAX_DELAY_MS)

    const reason = signal ? `sinal ${signal}` : `código ${code}`
    log(`== servidor caiu (${reason}) depois de ${Math.round(uptime / 1000)}s; religando em ${delay / 1000}s`)
    setTimeout(start, delay)
  })
}

function stop(signal) {
  stopping = true
  log(`== supervisor encerrando (${signal})`)
  if (child) child.kill()
  process.exit(0)
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  process.on(signal, () => stop(signal))
}

log(`== supervisor iniciado (pid ${process.pid})`)
start()
