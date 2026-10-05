/**
 * Camada de persistência.
 *
 * Uma única interface (`Collection`) com três implementações: SQLite (o
 * programa de desktop), `localStorage` (o app aberto no navegador) e a pasta de
 * trabalho em disco. Nenhuma tela sabe qual está ativa, e é justamente isso que
 * permitiu trocar o destino padrão de nuvem para banco local sem tocar em
 * nenhuma delas.
 */

import { isTauri } from '@tauri-apps/api/core'
import { uid } from '@/lib/utils'
import type { FolderStore } from './folder-store'
import { sqliteCollection } from './sqlite-store'
import { aplicarPatches } from './lote'
import type { BaseRow } from './types'

export interface Collection<T extends BaseRow> {
  list(): Promise<T[]>
  insert(item: Omit<T, keyof BaseRow> & Partial<BaseRow>): Promise<T>
  update(id: string, patch: Partial<T>): Promise<T>
  remove(id: string): Promise<void>
  replaceAll(items: T[]): Promise<void>
  /**
   * Altera vários de uma vez, tudo ou nada: se um deles não existe, nenhum é
   * gravado. Ver `aplicarPatches`.
   */
  updateMany(items: Array<{ id: string; patch: Partial<T> }>): Promise<T[]>
  /** Remove vários de uma vez, numa gravação só. */
  removeMany(ids: string[]): Promise<void>
}

const PREFIX = 'life:table:'

function readLocal<T>(table: string): T[] {
  try {
    const raw = localStorage.getItem(PREFIX + table)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

function writeLocal<T>(table: string, rows: T[]): void {
  localStorage.setItem(PREFIX + table, JSON.stringify(rows))
}

function localCollection<T extends BaseRow>(table: string): Collection<T> {
  return {
    async list() {
      return readLocal<T>(table)
    },
    async insert(item) {
      const now = new Date().toISOString()
      const row = { id: uid(), created_at: now, updated_at: now, ...item } as unknown as T
      const rows = readLocal<T>(table)
      rows.push(row)
      writeLocal(table, rows)
      return row
    },
    async update(id, patch) {
      const rows = readLocal<T>(table)
      const index = rows.findIndex((r) => r.id === id)
      if (index === -1) throw new Error(`Registro ${id} não encontrado em ${table}`)
      const updated = { ...rows[index]!, ...patch, updated_at: new Date().toISOString() }
      rows[index] = updated
      writeLocal(table, rows)
      return updated
    },
    async remove(id) {
      writeLocal(
        table,
        readLocal<T>(table).filter((r) => r.id !== id),
      )
    },
    async replaceAll(items) {
      writeLocal(table, items)
    },
    // Uma leitura e uma escrita para o lote inteiro: ou a chave muda toda, ou
    // não muda.
    async updateMany(items) {
      const { rows, alterados } = aplicarPatches(readLocal<T>(table), items, table)
      writeLocal(table, rows)
      return alterados
    },
    async removeMany(ids) {
      const fora = new Set(ids)
      writeLocal(
        table,
        readLocal<T>(table).filter((r) => !fora.has(r.id)),
      )
    },
  }
}

/**
 * Pasta de trabalho no disco. Terceiro destino possível, ligado em tempo de
 * execução — o usuário escolhe a pasta depois que o app já subiu.
 */
function folderCollection<T extends BaseRow>(table: string, store: FolderStore): Collection<T> {
  return {
    async list() {
      return (await store.readTable(table)) as T[]
    },
    async insert(item) {
      const now = new Date().toISOString()
      const row = { id: uid(), created_at: now, updated_at: now, ...item } as unknown as T
      return store.mutate(table, (rows) => ({ rows: [...rows, row], result: row }))
    },
    async update(id, patch) {
      return store.mutate(table, (rows) => {
        const list = rows as T[]
        const index = list.findIndex((r) => r.id === id)
        if (index === -1) throw new Error(`Registro ${id} não encontrado em ${table}`)
        const updated = { ...list[index]!, ...patch, updated_at: new Date().toISOString() }
        const next = [...list]
        next[index] = updated
        return { rows: next, result: updated }
      })
    },
    async remove(id) {
      await store.mutate(table, (rows) => ({
        rows: (rows as T[]).filter((r) => r.id !== id),
        result: undefined,
      }))
    },
    async replaceAll(items) {
      await store.writeTable(table, items)
    },
    // Uma gravação do arquivo para o lote inteiro, que no disco é atômica: o
    // arquivo novo só substitui o antigo depois de escrito por completo.
    async updateMany(items) {
      return store.mutate(table, (rows) => {
        const { rows: proximas, alterados } = aplicarPatches(rows as T[], items, table)
        return { rows: proximas, result: alterados }
      })
    },
    async removeMany(ids) {
      const fora = new Set(ids)
      await store.mutate(table, (rows) => ({
        rows: (rows as T[]).filter((r) => !fora.has(r.id)),
        result: undefined,
      }))
    },
  }
}

export type StorageMode = 'folder' | 'sqlite' | 'local'

/**
 * Roda dentro do programa de desktop?
 *
 * Avaliado uma vez: a resposta não muda durante a execução, e chamar a cada
 * operação de banco colocaria a checagem no caminho quente de toda tela.
 */
const NO_DESKTOP = isTauri()

let folderStore: FolderStore | null = null

/**
 * Liga ou desliga o modo pasta. Chamado depois que o usuário escolhe (ou
 * desconecta) a pasta, e no boot quando a permissão ainda está de pé.
 */
export function setFolderStore(store: FolderStore | null): void {
  folderStore = store
}

export function currentFolder(): FolderStore | null {
  return folderStore
}

export function storageMode(): StorageMode {
  if (folderStore) return 'folder'
  return NO_DESKTOP ? 'sqlite' : 'local'
}

/**
 * A escolha do destino acontece a cada chamada, não na criação da coleção:
 * o app inteiro monta os hooks no boot, e a pasta só é conectada depois.
 * Resolver na criação congelaria todo mundo no modo inicial.
 */
export function collection<T extends BaseRow>(table: string): Collection<T> {
  const local = localCollection<T>(table)
  // O módulo do SQLite só é carregado no desktop: no navegador ele importaria
  // o plugin do Tauri, que não existe ali.
  const banco = NO_DESKTOP ? sqliteCollection<T>(table) : null

  const active = (): Collection<T> =>
    folderStore ? folderCollection<T>(table, folderStore) : (banco ?? local)

  return {
    list: () => active().list(),
    insert: (item) => active().insert(item),
    update: (id, patch) => active().update(id, patch),
    remove: (id) => active().remove(id),
    replaceAll: (items) => active().replaceAll(items),
    updateMany: (items) => active().updateMany(items),
    removeMany: (ids) => active().removeMany(ids),
  }
}
