/**
 * Banco local em SQLite, para quando o app roda como programa de desktop.
 *
 * Uma tabela só — `rows(collection, id, data, created_at, updated_at)` — com a
 * linha inteira guardada como JSON em `data`. A escolha não é preguiça: toda
 * tela do app carrega a coleção completa e filtra em memória, e nenhuma delas
 * consulta por campo. Um esquema com 24 tabelas tipadas cobraria uma migração a
 * cada campo novo em `types.ts` para servir consultas que ninguém faz.
 *
 * `id`, `created_at` e `updated_at` aparecem duas vezes de propósito: como
 * coluna, porque ordenar e localizar por eles precisa de SQL, e dentro do JSON,
 * porque é de lá que o app lê. A cópia é escrita num lugar só, na `gravar`.
 */

import Database from '@tauri-apps/plugin-sql'
import { uid } from '@/lib/utils'
import type { Collection } from './adapters'
import type { BaseRow } from './types'

const ARQUIVO = 'sqlite:life.db'

interface Registro {
  data: string
}

let conexao: Promise<Database> | null = null

/**
 * Uma conexão para o app inteiro, criada na primeira necessidade.
 *
 * `Database.load` abre o arquivo e roda as migrações declaradas no Rust. Chamar
 * de novo a cada coleção abriria 24 conexões para o mesmo arquivo.
 */
export function abrirBanco(): Promise<Database> {
  conexao ??= Database.load(ARQUIVO)
  return conexao
}

function gravar<T extends BaseRow>(linha: T): [string, string, string, string] {
  return [linha.id, JSON.stringify(linha), linha.created_at ?? '', linha.updated_at ?? '']
}

function ler<T>(registros: Registro[]): T[] {
  const linhas: T[] = []
  for (const registro of registros) {
    try {
      linhas.push(JSON.parse(registro.data) as T)
    } catch {
      // Uma linha corrompida não pode derrubar a tela inteira: some dela e o
      // resto da coleção continua utilizável.
    }
  }
  return linhas
}

export function sqliteCollection<T extends BaseRow>(colecao: string): Collection<T> {
  return {
    async list() {
      const db = await abrirBanco()
      const registros = await db.select<Registro[]>(
        'SELECT data FROM rows WHERE collection = $1 ORDER BY created_at',
        [colecao],
      )
      return ler<T>(registros)
    },

    async insert(item) {
      const db = await abrirBanco()
      const agora = new Date().toISOString()
      const linha = { id: uid(), created_at: agora, updated_at: agora, ...item } as unknown as T
      const [id, data, criado, atualizado] = gravar(linha)
      await db.execute(
        'INSERT INTO rows (collection, id, data, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        [colecao, id, data, criado, atualizado],
      )
      return linha
    },

    async update(id, patch) {
      const db = await abrirBanco()
      const [atual] = await db.select<Registro[]>(
        'SELECT data FROM rows WHERE collection = $1 AND id = $2',
        [colecao, id],
      )
      if (!atual) throw new Error(`Registro ${id} não encontrado em ${colecao}`)

      const linha = {
        ...(JSON.parse(atual.data) as T),
        ...patch,
        updated_at: new Date().toISOString(),
      } as T
      const [, data, , atualizado] = gravar(linha)
      await db.execute(
        'UPDATE rows SET data = $1, updated_at = $2 WHERE collection = $3 AND id = $4',
        [data, atualizado, colecao, id],
      )
      return linha
    },

    async remove(id) {
      const db = await abrirBanco()
      await db.execute('DELETE FROM rows WHERE collection = $1 AND id = $2', [colecao, id])
    },

    /**
     * Troca a coleção inteira. Usado pela semeadura inicial e pela restauração
     * de backup — as duas querem o estado final, não um acréscimo.
     *
     * Dentro de uma transação porque o apagar e o inserir precisam ser um só
     * evento: uma queda de energia no meio deixaria a coleção vazia, e a
     * semeadura não sabe repor o que já não está no arquivo.
     */
    async replaceAll(items) {
      const db = await abrirBanco()
      await db.execute('BEGIN')
      try {
        await db.execute('DELETE FROM rows WHERE collection = $1', [colecao])
        for (const item of items) {
          const [id, data, criado, atualizado] = gravar(item)
          await db.execute(
            'INSERT INTO rows (collection, id, data, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
            [colecao, id, data, criado, atualizado],
          )
        }
        await db.execute('COMMIT')
      } catch (erro) {
        await db.execute('ROLLBACK')
        throw erro
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Vinda do navegador
// ---------------------------------------------------------------------------

const PREFIXO_LOCAL = 'life:table:'
const MARCA = '__migracao_localstorage__'

/**
 * Traz o que já existia no `localStorage` para o banco, uma única vez.
 *
 * Quem usou o Life no navegador antes do programa de desktop tem meses de
 * registro guardados lá. Sem esta passagem, a primeira abertura do app nativo
 * mostraria um dashboard vazio — e a pessoa concluiria, com razão, que perdeu
 * tudo.
 *
 * A marca fica no próprio banco, não no `localStorage`: assim reinstalar o
 * programa sobre um banco existente não repete a importação, e limpar o
 * navegador não a dispara de novo.
 */
export async function migrarDoLocalStorage(): Promise<number> {
  const db = await abrirBanco()

  const [marca] = await db.select<Registro[]>(
    'SELECT data FROM rows WHERE collection = $1 AND id = $2',
    [MARCA, MARCA],
  )
  if (marca) return 0

  let importadas = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i)
      if (!chave?.startsWith(PREFIXO_LOCAL)) continue

      const colecao = chave.slice(PREFIXO_LOCAL.length)
      const cru = localStorage.getItem(chave)
      if (!cru) continue

      const linhas = JSON.parse(cru) as BaseRow[]
      if (!Array.isArray(linhas) || linhas.length === 0) continue

      // A coleção só é trazida se ainda não houver nada dela no banco: um
      // segundo computador com o mesmo arquivo não deve ter os dados
      // sobrescritos pelo que o navegador daquela máquina guardou.
      const existentes = await db.select<Registro[]>(
        'SELECT data FROM rows WHERE collection = $1 LIMIT 1',
        [colecao],
      )
      if (existentes.length > 0) continue

      await sqliteCollection(colecao).replaceAll(linhas)
      importadas += linhas.length
    }
  } catch {
    // Falhar aqui não pode impedir o app de abrir. Sem a marca gravada, a
    // próxima abertura tenta de novo.
    return importadas
  }

  const agora = new Date().toISOString()
  await db.execute(
    'INSERT INTO rows (collection, id, data, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
    [MARCA, MARCA, JSON.stringify({ importadas, em: agora }), agora, agora],
  )
  return importadas
}
