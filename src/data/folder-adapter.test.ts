import { beforeEach, describe, expect, it } from 'vitest'
import { collection, setFolderStore, storageMode } from './adapters'
import type { FolderStore } from './folder-store'
import type { BaseRow } from './types'

interface Row extends BaseRow {
  name: string
  done?: boolean
}

/**
 * Pasta falsa: guarda os arquivos em memória e serializa as escritas do mesmo
 * jeito que a de verdade. Testar contra o disco exigiria o seletor de pastas,
 * que só existe atrás de um clique do usuário.
 */
function fakeFolder() {
  const files = new Map<string, unknown[]>()
  const queues = new Map<string, Promise<unknown>>()

  const serialize = <T>(table: string, task: () => Promise<T>): Promise<T> => {
    const previous = queues.get(table) ?? Promise.resolve()
    const next = previous.then(task, task)
    queues.set(
      table,
      next.catch(() => undefined),
    )
    return next
  }

  const store = {
    name: 'Life',
    async readTable(table: string) {
      return files.get(table) ?? []
    },
    async writeTable(table: string, rows: unknown[]) {
      files.set(table, rows)
    },
    async mutate<T>(table: string, change: (rows: unknown[]) => { rows: unknown[]; result: T }) {
      return serialize(table, async () => {
        const { rows, result } = change(files.get(table) ?? [])
        files.set(table, rows)
        return result
      })
    },
  }

  return { store: store as unknown as FolderStore, files }
}

describe('adaptador de pasta', () => {
  let folder: ReturnType<typeof fakeFolder>

  beforeEach(() => {
    folder = fakeFolder()
    setFolderStore(folder.store)
  })

  it('o modo ativo passa a ser pasta', () => {
    expect(storageMode()).toBe('folder')
    setFolderStore(null)
    expect(storageMode()).toBe('local')
  })

  it('grava o registro no arquivo da tabela', async () => {
    const habits = collection<Row>('habits')
    const created = await habits.insert({ name: 'Leitura' })

    expect(created.id).toBeTruthy()
    expect(created.created_at).toBeTruthy()
    expect(folder.files.get('habits')).toEqual([created])
  })

  it('cada tabela vai para o seu próprio arquivo', async () => {
    await collection<Row>('habits').insert({ name: 'Leitura' })
    await collection<Row>('notes').insert({ name: 'Anotação' })

    expect(folder.files.get('habits')).toHaveLength(1)
    expect(folder.files.get('notes')).toHaveLength(1)
  })

  it('lê de volta o que gravou', async () => {
    const habits = collection<Row>('habits')
    await habits.insert({ name: 'Leitura' })
    await habits.insert({ name: 'Corrida' })

    const rows = await habits.list()
    expect(rows.map((row) => row.name)).toEqual(['Leitura', 'Corrida'])
  })

  it('tabela nunca usada devolve lista vazia', async () => {
    expect(await collection<Row>('habits').list()).toEqual([])
  })

  it('atualiza sem perder os outros registros', async () => {
    const habits = collection<Row>('habits')
    const first = await habits.insert({ name: 'Leitura' })
    await habits.insert({ name: 'Corrida' })

    const updated = await habits.update(first.id, { done: true })
    expect(updated.done).toBe(true)
    expect(updated.updated_at).toBeTruthy()

    const rows = await habits.list()
    expect(rows).toHaveLength(2)
    expect(rows.find((row) => row.id === first.id)?.done).toBe(true)
  })

  it('atualizar registro inexistente falha em vez de criar', async () => {
    await expect(collection<Row>('habits').update('nao-existe', { done: true })).rejects.toThrow(
      'não encontrado',
    )
  })

  it('remove só o registro pedido', async () => {
    const habits = collection<Row>('habits')
    const first = await habits.insert({ name: 'Leitura' })
    const second = await habits.insert({ name: 'Corrida' })

    await habits.remove(first.id)
    const rows = await habits.list()
    expect(rows.map((row) => row.id)).toEqual([second.id])
  })

  it('escritas simultâneas na mesma tabela não se atropelam', async () => {
    // Cada gravação reescreve o arquivo inteiro: sem fila, a segunda apagaria
    // a primeira. Cinco inserções disparadas juntas devem sobreviver todas.
    const habits = collection<Row>('habits')
    await Promise.all(
      ['a', 'b', 'c', 'd', 'e'].map((name) => habits.insert({ name })),
    )

    const rows = await habits.list()
    expect(rows).toHaveLength(5)
    expect(new Set(rows.map((row) => row.name))).toEqual(new Set(['a', 'b', 'c', 'd', 'e']))
  })

  it('replaceAll troca o conteúdo inteiro', async () => {
    const habits = collection<Row>('habits')
    await habits.insert({ name: 'Antigo' })

    await habits.replaceAll([
      { id: 'x', created_at: '2026-01-01T00:00:00Z', name: 'Novo' } as Row,
    ])

    const rows = await habits.list()
    expect(rows.map((row) => row.name)).toEqual(['Novo'])
  })
})
