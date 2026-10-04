/**
 * O backup automático no disco: onde fica a configuração e como a cópia é
 * gravada.
 *
 * Só existe no programa de desktop. No navegador a pasta exige um clique para
 * reconceder permissão a cada sessão, e um backup que espera um clique já não
 * é automático. Lá continua valendo o "Exportar backup".
 *
 * A configuração mora no armazenamento desta máquina, e não no banco: o
 * caminho da pasta só faz sentido no computador onde ele foi escolhido.
 */

import { isTauri } from '@tauri-apps/api/core'
import { buildBackup } from '@/lib/backup/backup'
import {
  COPIAS_PADRAO,
  backupsParaApagar,
  nomeDoBackupAutomatico,
} from '@/lib/backup/automatico'
import { PathBackend, apagarBackupAutomatico, listarArquivos } from './folder-backend'
import { exportAll } from './queries'

export interface ConfigDoBackup {
  /** Caminho da pasta. `null` = desligado. */
  pasta: string | null
  /** Quantas cópias diárias guardar. */
  manter: number
  /** Dia do último backup que deu certo. */
  ultimo: string | null
  /** A mensagem da última tentativa que falhou, até a próxima dar certo. */
  erro: string | null
}

const CHAVE = 'life:backup-automatico'
export const EVENTO_BACKUP = 'life:backup-automatico-mudou'

const DESLIGADO: ConfigDoBackup = { pasta: null, manter: COPIAS_PADRAO, ultimo: null, erro: null }

export function backupAutomaticoDisponivel(): boolean {
  return isTauri()
}

export function lerConfigDoBackup(): ConfigDoBackup {
  try {
    const dado: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? 'null')
    if (typeof dado !== 'object' || dado === null) return DESLIGADO
    const { pasta, manter, ultimo, erro } = dado as Partial<ConfigDoBackup>
    return {
      pasta: typeof pasta === 'string' && pasta ? pasta : null,
      manter: typeof manter === 'number' && manter >= 1 ? Math.round(manter) : COPIAS_PADRAO,
      ultimo: typeof ultimo === 'string' ? ultimo : null,
      erro: typeof erro === 'string' ? erro : null,
    }
  } catch {
    return DESLIGADO
  }
}

export function gravarConfigDoBackup(config: ConfigDoBackup): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(config))
  } catch {
    // Sem armazenamento, a escolha vale só até fechar o app.
  }
  window.dispatchEvent(new Event(EVENTO_BACKUP))
}

/**
 * Grava a cópia de hoje e apaga as que passaram da conta.
 *
 * A limpeza vem depois da gravação, e um erro nela não desfaz o backup: sobrar
 * uma cópia velha a mais é inofensivo, ficar sem a de hoje não é.
 */
export async function fazerBackupAutomatico(
  pasta: string,
  manter: number,
  hoje: string,
): Promise<{ registros: number; apagados: number }> {
  const tabelas = await exportAll()
  const arquivo = buildBackup(tabelas, new Date().toISOString())
  const destino = new PathBackend(pasta)
  await destino.write(nomeDoBackupAutomatico(hoje), JSON.stringify(arquivo))

  let apagados = 0
  try {
    for (const nome of backupsParaApagar(await listarArquivos(pasta), manter)) {
      await apagarBackupAutomatico(destino.caminhoDe(nome))
      apagados++
    }
  } catch {
    // Fica para a próxima: a cópia de hoje já está gravada.
  }

  const registros = Object.values(tabelas).reduce((soma, linhas) => soma + linhas.length, 0)
  return { registros, apagados }
}

/**
 * Roda com a configuração gravada e anota o resultado nela.
 *
 * É o mesmo caminho para o vigia e para o botão "Fazer agora": dois caminhos
 * acabariam anotando o resultado de jeitos diferentes, e a tela mostraria um
 * "último backup" que não bate com a pasta.
 */
export async function executarBackupAutomatico(hoje: string): Promise<ConfigDoBackup> {
  const config = lerConfigDoBackup()
  if (!config.pasta) return config

  try {
    await fazerBackupAutomatico(config.pasta, config.manter, hoje)
    const certo = { ...config, ultimo: hoje, erro: null }
    gravarConfigDoBackup(certo)
    return certo
  } catch (causa) {
    const falhou = {
      ...config,
      erro: causa instanceof Error ? causa.message : String(causa),
    }
    gravarConfigDoBackup(falhou)
    return falhou
  }
}
