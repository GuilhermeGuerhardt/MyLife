/**
 * Formato da pasta de trabalho.
 *
 * A ideia é a mesma do Obsidian: os dados do app são arquivos comuns numa
 * pasta que você escolhe. Apontando essa pasta para dentro do Google Drive ou
 * do OneDrive, é o próprio serviço que sincroniza entre computadores — o app
 * não precisa de servidor, de conta nem de rede.
 *
 * **Um arquivo por tabela**, e não um único arquivo gigante. Três razões:
 * gravar um hábito reescreve 2 kB em vez de 2 MB; o Drive sincroniza só o que
 * mudou, o que reduz a chance de conflito; e a pasta fica legível — dá para
 * abrir `transactions.json` e entender o que tem lá.
 */

/** Arquivo de controle da pasta. Serve para reconhecer uma pasta já usada. */
export const MANIFEST_FILE = 'life.json'

export const WORKSPACE_VERSION = 1

export interface WorkspaceManifest {
  app: 'life'
  version: number
  updated_at: string
  /** Só informativo: ajuda a saber de onde veio a pasta. */
  device: string
}

export function tableFilename(table: string): string {
  return `${table}.json`
}

export function tableFromFilename(filename: string): string | null {
  if (filename === MANIFEST_FILE || !filename.endsWith('.json')) return null
  return filename.slice(0, -'.json'.length)
}

export function buildManifest(device: string, now: string): WorkspaceManifest {
  return { app: 'life', version: WORKSPACE_VERSION, updated_at: now, device }
}

export type ManifestCheck =
  | { ok: true; manifest: WorkspaceManifest }
  | { ok: false; error: string }

/**
 * Confere se a pasta é (ou pode virar) uma pasta do Life.
 *
 * Pasta vazia é aceita — é o caso de quem está começando. O que não se aceita
 * é uma pasta com manifesto de outro app ou de uma versão futura: gravar por
 * cima de dados que não são nossos é o erro irreversível deste recurso.
 */
export function checkManifest(raw: unknown): ManifestCheck {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'A pasta tem um arquivo life.json que não é do Life.' }
  }

  const candidate = raw as Record<string, unknown>
  if (candidate.app !== 'life') {
    return { ok: false, error: 'Esta pasta pertence a outro aplicativo.' }
  }

  const version = Number(candidate.version)
  if (!Number.isFinite(version) || version < 1) {
    return { ok: false, error: 'O arquivo life.json não informa uma versão válida.' }
  }
  if (version > WORKSPACE_VERSION) {
    return {
      ok: false,
      error: `A pasta foi criada por uma versão mais nova do app (${version}). Atualize antes de usá-la.`,
    }
  }

  return {
    ok: true,
    manifest: {
      app: 'life',
      version,
      updated_at: typeof candidate.updated_at === 'string' ? candidate.updated_at : '',
      device: typeof candidate.device === 'string' ? candidate.device : '',
    },
  }
}

/**
 * Lê o conteúdo de um arquivo de tabela.
 *
 * Arquivo ausente devolve lista vazia: a tabela ainda não foi usada. Já um
 * arquivo corrompido **lança** — devolver `[]` faria o app parecer vazio e a
 * próxima gravação apagaria o que estava lá.
 */
export function parseTableFile(text: string, table: string): unknown[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error(`O arquivo ${tableFilename(table)} não é um JSON válido.`)
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`O arquivo ${tableFilename(table)} deveria conter uma lista.`)
  }
  return parsed
}

/** Indentado de propósito: o diff do Drive e a leitura humana agradecem. */
export function serializeTable(rows: unknown[]): string {
  return `${JSON.stringify(rows, null, 2)}\n`
}

/** Nome curto para identificar a máquina no manifesto. */
export function deviceName(userAgent: string): string {
  if (/android/i.test(userAgent)) return 'Android'
  if (/iphone|ipad/i.test(userAgent)) return 'iOS'
  if (/mac/i.test(userAgent)) return 'Mac'
  if (/windows/i.test(userAgent)) return 'Windows'
  if (/linux/i.test(userAgent)) return 'Linux'
  return 'Desconhecido'
}

/** Arquivos que o sistema operacional cria sozinho em qualquer pasta. */
const ARQUIVOS_DO_SISTEMA = new Set(['desktop.ini', 'thumbs.db', '.ds_store', 'icon\r'])

export type PastaSemManifesto =
  | { ok: true; existing: boolean }
  | { ok: false; error: string }

/**
 * Pasta sem `life.json`: dá para usar?
 *
 * Só quando ela está vazia, ou quando o que tem lá é do próprio Life (tabelas,
 * backups, arquivos que o Windows cria sozinho). Antes, qualquer pasta sem o
 * manifesto passava como "nova", e escolher sem querer a pasta de um projeto
 * espalhava vinte JSONs no meio dos arquivos dele. Pior: se ela tivesse um
 * `accounts.json` de outro programa, ele seria sobrescrito.
 *
 * Tabela do Life sem o manifesto conta como pasta já usada: o manifesto se
 * perdeu, mas os dados são dela, e copiar os do aparelho por cima apagaria
 * o que estava lá.
 */
export function checarPastaSemManifesto(
  nomes: string[],
  tabelasConhecidas: readonly string[],
): PastaSemManifesto {
  const tabelas = new Set(tabelasConhecidas.map(tableFilename))
  const ehDoLife = (nome: string) =>
    tabelas.has(nome) || /^life-(backup|auto)-.+\.json$/.test(nome) || nome.endsWith('.tmp')
  const ehDoSistema = (nome: string) =>
    ARQUIVOS_DO_SISTEMA.has(nome.toLowerCase()) || nome.startsWith('.') || nome.startsWith('~$')

  const estranhos = nomes.filter((nome) => !ehDoLife(nome) && !ehDoSistema(nome)).sort()
  if (estranhos.length > 0) {
    const amostra = estranhos.slice(0, 3).join(', ')
    const resto = estranhos.length > 3 ? ` e mais ${estranhos.length - 3}` : ''
    return {
      ok: false,
      error: `Esta pasta já tem outros arquivos (${amostra}${resto}). Escolha uma pasta vazia, ou uma que já seja do Life.`,
    }
  }

  return { ok: true, existing: nomes.some((nome) => tabelas.has(nome)) }
}
