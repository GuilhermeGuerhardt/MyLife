/**
 * Backup e restauração.
 *
 * Um arquivo que só sai e nunca volta não é backup — é despedida. Por isso
 * este módulo trata os dois lados: gerar o arquivo e validar o que chega antes
 * de deixar qualquer coisa tocar o banco.
 *
 * O formato é versionado desde o primeiro dia. Sem versão, mudar a estrutura
 * daqui a um ano transforma todo backup antigo em lixo silencioso: o import
 * "funciona", grava o que entendeu, e a pessoa só descobre o que perdeu quando
 * for procurar.
 */

export const BACKUP_VERSION = 1

export interface BackupFile {
  app: 'life'
  version: number
  exported_at: string
  /** Chave = nome da tabela; valor = todas as linhas dela. */
  tables: Record<string, unknown[]>
}

export interface TableCount {
  table: string
  count: number
}

export function buildBackup(tables: Record<string, unknown[]>, now: string): BackupFile {
  return {
    app: 'life',
    version: BACKUP_VERSION,
    exported_at: now,
    // Tabela vazia continua no arquivo: a ausência dela numa restauração
    // significaria "não mexa nesta tabela", e não "esvazie".
    tables,
  }
}

export type ParseResult =
  | { ok: true; file: BackupFile; legacy: boolean }
  | { ok: false; error: string }

/**
 * Valida um arquivo vindo de fora.
 *
 * Aceita também o formato antigo — um objeto plano de tabela para linhas, sem
 * cabeçalho — porque backups gerados pelas versões anteriores do app existem e
 * precisam continuar restauráveis.
 */
export function parseBackup(raw: unknown): ParseResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'O arquivo não parece um backup do Life.' }
  }

  const candidate = raw as Record<string, unknown>

  // Formato atual: tem cabeçalho.
  if ('app' in candidate || 'version' in candidate || 'tables' in candidate) {
    if (candidate.app !== 'life') {
      return { ok: false, error: 'Este backup é de outro aplicativo.' }
    }

    const version = Number(candidate.version)
    if (!Number.isFinite(version) || version < 1) {
      return { ok: false, error: 'O arquivo não informa uma versão válida.' }
    }
    if (version > BACKUP_VERSION) {
      return {
        ok: false,
        error: `Backup da versão ${version}, e este app entende até a ${BACKUP_VERSION}. Atualize o app antes de restaurar.`,
      }
    }

    const tables = validateTables(candidate.tables)
    if (!tables) return { ok: false, error: 'As tabelas do backup estão corrompidas.' }

    return {
      ok: true,
      legacy: false,
      file: {
        app: 'life',
        version,
        exported_at: typeof candidate.exported_at === 'string' ? candidate.exported_at : '',
        tables,
      },
    }
  }

  // Formato antigo: o objeto inteiro já é o mapa de tabelas.
  const tables = validateTables(candidate)
  if (!tables) return { ok: false, error: 'O arquivo não parece um backup do Life.' }
  if (Object.keys(tables).length === 0) {
    return { ok: false, error: 'O backup está vazio.' }
  }

  return {
    ok: true,
    legacy: true,
    file: { app: 'life', version: 0, exported_at: '', tables },
  }
}

function validateTables(value: unknown): Record<string, unknown[]> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null

  const result: Record<string, unknown[]> = {}
  for (const [table, rows] of Object.entries(value)) {
    // Uma chave que não é lista de linhas denuncia arquivo trocado ou editado
    // à mão. Ignorar em silêncio esconderia o erro justo na hora em que os
    // dados importam.
    if (!Array.isArray(rows)) return null
    result[table] = rows
  }
  return result
}

export function backupCounts(file: BackupFile): TableCount[] {
  return Object.entries(file.tables)
    .map(([table, rows]) => ({ table, count: rows.length }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
}

export function totalRows(file: BackupFile): number {
  return Object.values(file.tables).reduce((sum, rows) => sum + rows.length, 0)
}

/**
 * Separa o que este app sabe restaurar do que veio a mais. Tabela
 * desconhecida não é motivo para recusar o arquivo — pode ser backup de uma
 * versão mais nova de um módulo que ainda não chegou aqui —, mas a pessoa
 * precisa saber que ela não será restaurada.
 */
export function splitKnownTables(
  file: BackupFile,
  known: readonly string[],
): { known: Record<string, unknown[]>; unknown: string[] } {
  const set = new Set(known)
  const result: Record<string, unknown[]> = {}
  const extra: string[] = []

  for (const [table, rows] of Object.entries(file.tables)) {
    if (set.has(table)) result[table] = rows
    else extra.push(table)
  }

  return { known: result, unknown: extra }
}

export function backupFilename(isoDate: string): string {
  return `life-backup-${isoDate}.json`
}
