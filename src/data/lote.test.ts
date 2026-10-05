// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

// O banco é simulado: o que interessa no SQLite é que o lote vá num comando só.
const banco = vi.hoisted(() => ({
  linhas: new Map<string, string>(),
  comandos: [] as Array<{ sql: string; params: unknown[] }>,
}))

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: {
    load: async () => ({
      select: async (sql: string, params: string[]) => {
        const [, ...ids] = params
        if (sql.includes('id IN')) {
          return ids.filter((id) => banco.linhas.has(id)).map((id) => ({ data: banco.linhas.get(id) }))
        }
        return [...banco.linhas.values()].map((data) => ({ data }))
      },
      execute: async (sql: string, params: unknown[]) => {
        banco.comandos.push({ sql, params })
        if (sql.startsWith('INSERT')) {
          for (let i = 0; i < params.length; i += 5) banco.linhas.set(params[i + 1] as string, params[i + 2] as string)
        }
        if (sql.startsWith('DELETE')) {
          for (const id of params.slice(1)) banco.linhas.delete(id as string)
        }
      },
    }),
  },
}))

const { aplicarPatches } = await import('./lote')
const { collection } = await import('./adapters')
const { sqliteCollection } = await import('./sqlite-store')

interface Linha {
  id: string
  created_at: string
  updated_at?: string | null
  paid: boolean
}

const linha = (id: string, paid = false): Linha => ({ id, created_at: '2026-10-01', paid })

describe('aplicar um lote', () => {
  it('altera todos e devolve os alterados', () => {
    const { rows, alterados } = aplicarPatches(
      [linha('a'), linha('b'), linha('c')],
      [
        { id: 'a', patch: { paid: true } },
        { id: 'c', patch: { paid: true } },
      ],
      'transactions',
    )
    expect(rows.map((r) => r.paid)).toEqual([true, false, true])
    expect(alterados.map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('um id que sumiu recusa o lote inteiro, antes de alterar qualquer um', () => {
    const originais = [linha('a'), linha('b')]
    expect(() =>
      aplicarPatches(
        originais,
        [
          { id: 'a', patch: { paid: true } },
          { id: 'sumiu', patch: { paid: true } },
        ],
        'transactions',
      ),
    ).toThrow(/sumiu não encontrado/)
    expect(originais[0]!.paid).toBe(false)
  })
})

describe('no navegador', () => {
  beforeEach(() => localStorage.clear())

  it('tudo ou nada', async () => {
    const tabela = collection<Linha>('lote_teste')
    await tabela.replaceAll([linha('a'), linha('b')])

    await expect(
      tabela.updateMany([
        { id: 'a', patch: { paid: true } },
        { id: 'x', patch: { paid: true } },
      ]),
    ).rejects.toThrow()
    expect((await tabela.list()).map((r) => r.paid)).toEqual([false, false])

    await tabela.updateMany([{ id: 'b', patch: { paid: true } }])
    await tabela.removeMany(['a'])
    expect(await tabela.list()).toMatchObject([{ id: 'b', paid: true }])
  })
})

describe('no SQLite', () => {
  beforeEach(() => {
    banco.linhas.clear()
    banco.comandos.length = 0
    for (const id of ['a', 'b', 'c']) banco.linhas.set(id, JSON.stringify(linha(id)))
  })

  it('o lote vai num comando só', async () => {
    const tabela = sqliteCollection<Linha>('transactions')
    await tabela.updateMany([
      { id: 'a', patch: { paid: true } },
      { id: 'b', patch: { paid: true } },
    ])

    expect(banco.comandos).toHaveLength(1)
    expect(banco.comandos[0]!.sql).toMatch(/^INSERT INTO rows .* VALUES \(\$1, \$2, \$3, \$4, \$5\), \(\$6, /s)
    expect(banco.comandos[0]!.sql).toMatch(/ON CONFLICT \(collection, id\) DO UPDATE/)
    expect(JSON.parse(banco.linhas.get('a')!).paid).toBe(true)
    expect(JSON.parse(banco.linhas.get('c')!).paid).toBe(false)
  })

  it('id que sumiu: nenhum comando de escrita', async () => {
    const tabela = sqliteCollection<Linha>('transactions')
    await expect(
      tabela.updateMany([
        { id: 'a', patch: { paid: true } },
        { id: 'sumiu', patch: { paid: true } },
      ]),
    ).rejects.toThrow()
    expect(banco.comandos).toEqual([])
  })

  it('remover vários é um DELETE só', async () => {
    await sqliteCollection<Linha>('transactions').removeMany(['a', 'c'])
    expect(banco.comandos).toHaveLength(1)
    expect(banco.comandos[0]!.sql).toBe('DELETE FROM rows WHERE collection = $1 AND id IN ($2, $3)')
    expect([...banco.linhas.keys()]).toEqual(['b'])
  })
})
