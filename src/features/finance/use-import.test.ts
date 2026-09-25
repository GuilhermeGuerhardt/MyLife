import { describe, expect, it } from 'vitest'
import type { Category } from '@/data/types'
import type { ImportRow } from '@/lib/finance/import'
import type { Account } from '@/data/types'
import {
  chaveDaCategoria,
  CREATE,
  labelKinds,
  lerChaveDaCategoria,
  montarLancamentos,
  suggestCategories,
  type AlvosDaImportacao,
} from './use-import'

const linha = (categoryLabel: string, kind: 'income' | 'expense'): ImportRow => ({
  line: 2,
  date: '2026-09-11',
  kind,
  amountCents: 60000,
  description: 'Devolução',
  detail: null,
  accountLabel: 'Banco Azul',
  transferToLabel: '',
  categoryLabel,
  paid: true,
  installment: null,
  error: null,
  duplicate: false,
  repeated: false,
})

const categoria = (name: string, kind: 'income' | 'expense'): Category => ({
  id: `${kind}-${name}`,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
  name,
  kind,
  color: '#000000',
  icon: 'tag',
  keywords: [],
})

describe('chave da categoria', () => {
  it('vai e volta', () => {
    expect(lerChaveDaCategoria(chaveDaCategoria('Empréstimo', 'income'))).toEqual({
      label: 'Empréstimo',
      kind: 'income',
    })
  })

  it('aguenta rótulo com barra no nome', () => {
    const chave = chaveDaCategoria('Luz | Água', 'expense')
    expect(lerChaveDaCategoria(chave)).toEqual({ label: 'Luz | Água', kind: 'expense' })
  })
})

describe('rótulos de categoria do arquivo', () => {
  it('um rótulo de um tipo só rende uma entrada', () => {
    expect(labelKinds([linha('Mercado', 'expense'), linha('Mercado', 'expense')])).toEqual([
      { label: 'Mercado', kind: 'expense' },
    ])
  })

  /**
   * O caso que quebrava: num extrato real "Empréstimo" é o dinheiro que saiu e
   * o que voltou. Com uma entrada só, os dois iam para a mesma categoria — e
   * categoria tem tipo, então a receita ficava com uma categoria de despesa.
   */
  it('um rótulo nos dois tipos rende duas entradas', () => {
    expect(labelKinds([linha('Empréstimo', 'expense'), linha('Empréstimo', 'income')])).toEqual([
      { label: 'Empréstimo', kind: 'expense' },
      { label: 'Empréstimo', kind: 'income' },
    ])
  })

  it('linha sem categoria não entra', () => {
    expect(labelKinds([linha('   ', 'expense')])).toEqual([])
  })
})

describe('sugestão de categoria', () => {
  const catalogo = [categoria('Empréstimo', 'expense'), categoria('Empréstimo', 'income')]

  it('cada tipo acha a categoria do seu tipo', () => {
    const sugestao = suggestCategories(
      [
        { label: 'Empréstimo', kind: 'expense' },
        { label: 'Empréstimo', kind: 'income' },
      ],
      catalogo,
    )

    expect(sugestao[chaveDaCategoria('Empréstimo', 'expense')]).toBe('expense-Empréstimo')
    expect(sugestao[chaveDaCategoria('Empréstimo', 'income')]).toBe('income-Empréstimo')
  })

  it('sem categoria do tipo certo, propõe criar', () => {
    const sugestao = suggestCategories(
      [{ label: 'Empréstimo', kind: 'income' }],
      [categoria('Empréstimo', 'expense')],
    )
    expect(sugestao[chaveDaCategoria('Empréstimo', 'income')]).toBe(CREATE)
  })
})

describe('linhas viram lançamentos', () => {
  const conta = (id: string, over: Partial<Account> = {}): Account => ({
    id,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    name: id,
    kind: 'checking',
    bank: null,
    initial_balance_cents: 0,
    credit_limit_cents: null,
    closing_day: null,
    due_day: null,
    color: '#000000',
    archived: false,
    ...over,
  })

  const alvos = (over: Partial<AlvosDaImportacao> = {}): AlvosDaImportacao => ({
    contas: new Map([
      ['Banco Azul', 'conta-1'],
      ['Poupança', 'conta-2'],
    ]),
    categorias: new Map([[chaveDaCategoria('Mercado', 'expense'), 'cat-1']]),
    contasPorId: new Map([['conta-1', conta('conta-1')]]),
    fallbackAccountId: 'conta-1',
    ...over,
  })

  const gasto = (over: Partial<ImportRow> = {}): ImportRow => ({
    ...linha('Mercado', 'expense'),
    description: 'Padaria',
    amountCents: 1250,
    ...over,
  })

  it('a linha comum vira um lançamento na conta e na categoria apontadas', () => {
    const [lancamento] = montarLancamentos([gasto()], alvos())
    expect(lancamento).toMatchObject({
      account_id: 'conta-1',
      transfer_account_id: null,
      category_id: 'cat-1',
      kind: 'expense',
      amount_cents: 1250,
      tags: ['importado'],
    })
  })

  it('sem rótulo de conta, cai na conta escolhida como padrão', () => {
    const [lancamento] = montarLancamentos([gasto({ accountLabel: '' })], alvos())
    expect(lancamento!.account_id).toBe('conta-1')
  })

  it('a transferência liga as duas contas e não leva categoria', () => {
    const [lancamento] = montarLancamentos(
      [
        gasto({
          kind: 'transfer',
          categoryLabel: '',
          transferToLabel: 'Poupança',
          description: 'Transferência de Banco Azul para Poupança',
        }),
      ],
      alvos(),
    )
    expect(lancamento).toMatchObject({
      account_id: 'conta-1',
      transfer_account_id: 'conta-2',
      category_id: null,
      kind: 'transfer',
    })
  })

  it('transferência sem destino conhecido não vira lançamento nenhum', () => {
    // Gravar só a saída inventaria um gasto que não houve.
    const lancamentos = montarLancamentos(
      [gasto({ kind: 'transfer', categoryLabel: '', transferToLabel: 'Conta que não existe' })],
      alvos(),
    )
    expect(lancamentos).toEqual([])
  })

  it('transferência de uma conta para ela mesma também não entra', () => {
    const lancamentos = montarLancamentos(
      [gasto({ kind: 'transfer', categoryLabel: '', transferToLabel: 'Banco Azul' })],
      alvos(),
    )
    expect(lancamentos).toEqual([])
  })

  it('parcelas da mesma compra dividem o grupo, e outra compra tem o seu', () => {
    const lancamentos = montarLancamentos(
      [
        gasto({ description: 'Geladeira', installment: { n: 1, total: 12 } }),
        gasto({ description: 'Geladeira', installment: { n: 2, total: 12 } }),
        gasto({ description: 'Notebook', installment: { n: 1, total: 12 } }),
      ],
      alvos(),
    )

    expect(lancamentos[0]!.installment_group_id).toBe(lancamentos[1]!.installment_group_id)
    expect(lancamentos[2]!.installment_group_id).not.toBe(lancamentos[0]!.installment_group_id)
    expect(lancamentos[0]!.installment_n).toBe(1)
    expect(lancamentos[0]!.installment_total).toBe(12)
  })

  it('no cartão, a competência é a da fatura, não a do calendário', () => {
    // Compra depois do fechamento entra na fatura do mês seguinte.
    const cartao = conta('conta-1', { kind: 'credit', closing_day: 20, due_day: 1 })
    const [lancamento] = montarLancamentos(
      [gasto({ date: '2026-09-25' })],
      alvos({ contasPorId: new Map([['conta-1', cartao]]) }),
    )
    expect(lancamento!.competence).toBe('2026-10')
  })

  it('na conta corrente, a competência é a do mês da data', () => {
    const [lancamento] = montarLancamentos([gasto({ date: '2026-09-25' })], alvos())
    expect(lancamento!.competence).toBe('2026-09')
  })
})
