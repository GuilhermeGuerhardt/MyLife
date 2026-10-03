import { describe, expect, it } from 'vitest'
import {
  balanceOn,
  compareBalances,
  daysSinceCheck,
  lastCheck,
  needsCheck,
  unchecked,
  type CheckLike,
} from './conferencia'
import type { AccountLike, TransactionLike } from './reports'

const conta: AccountLike = {
  id: 'acc1',
  kind: 'checking',
  initial_balance_cents: 100000,
  credit_limit_cents: null,
}

const tx = (over: Partial<TransactionLike> & { id: string }): TransactionLike => ({
  account_id: 'acc1',
  transfer_account_id: null,
  category_id: null,
  kind: 'expense',
  amount_cents: 1000,
  date: '2026-03-10',
  competence: '2026-03',
  paid: true,
  ...over,
})

const check = (over: Partial<CheckLike> = {}): CheckLike => ({
  account_id: 'acc1',
  date: '2026-03-10',
  balance_cents: 99000,
  difference_cents: 0,
  created_at: '2026-03-10T12:00:00.000Z',
  ...over,
})

describe('saldo numa data', () => {
  const movimento = [
    tx({ id: 'a', date: '2026-03-05', amount_cents: 5000 }),
    tx({ id: 'b', date: '2026-03-10', amount_cents: 2000 }),
    tx({ id: 'c', date: '2026-03-20', amount_cents: 7000 }),
  ]

  it('conta até o dia, inclusive', () => {
    expect(balanceOn(conta, movimento, '2026-03-10')).toBe(93000)
  })

  /**
   * O extrato do banco é a fotografia de um dia. Se o saldo de hoje entrasse na
   * comparação, toda conta com conta agendada acusaria diferença.
   */
  it('o que vem depois não entra', () => {
    expect(balanceOn(conta, movimento, '2026-03-10')).not.toBe(
      balanceOn(conta, movimento, '2026-03-20'),
    )
    expect(balanceOn(conta, movimento, '2026-03-20')).toBe(86000)
  })

  it('o previsto não mexe no saldo, mesmo em dia passado', () => {
    const comPrevisto = [...movimento, tx({ id: 'd', date: '2026-03-08', paid: false })]
    expect(balanceOn(conta, comPrevisto, '2026-03-10')).toBe(93000)
  })
})

describe('comparação com o banco', () => {
  it('bate quando os dois dão o mesmo número', () => {
    expect(compareBalances(93000, 93000)).toEqual({
      appCents: 93000,
      bankCents: 93000,
      differenceCents: 0,
      status: 'ok',
    })
  })

  it('app com mais dinheiro é saída que faltou lançar', () => {
    expect(compareBalances(93000, 90000).status).toBe('sobrando')
    expect(compareBalances(93000, 90000).differenceCents).toBe(3000)
  })

  it('banco com mais dinheiro é entrada que faltou lançar', () => {
    expect(compareBalances(90000, 93000).status).toBe('faltando')
    expect(compareBalances(90000, 93000).differenceCents).toBe(-3000)
  })
})

describe('última conferência', () => {
  it('é a de data mais recente', () => {
    const lista = [
      check({ date: '2026-02-28' }),
      check({ date: '2026-03-10' }),
      check({ date: '2026-01-31' }),
    ]
    expect(lastCheck(lista, 'acc1')?.date).toBe('2026-03-10')
  })

  it('conferir de novo no mesmo dia vale a última', () => {
    const lista = [
      check({ created_at: '2026-03-10T09:00:00.000Z', difference_cents: -3000 }),
      check({ created_at: '2026-03-10T18:00:00.000Z', difference_cents: 0 }),
    ]
    expect(lastCheck(lista, 'acc1')?.difference_cents).toBe(0)
  })

  it('não mistura contas', () => {
    const lista = [check({ account_id: 'acc2', date: '2026-04-01' }), check()]
    expect(lastCheck(lista, 'acc1')?.date).toBe('2026-03-10')
    expect(lastCheck(lista, 'acc3')).toBeNull()
  })
})

describe('o que falta conferir', () => {
  const movimento = [
    tx({ id: 'a', date: '2026-03-05' }),
    tx({ id: 'b', date: '2026-03-10' }),
    tx({ id: 'c', date: '2026-03-20' }),
    tx({ id: 'd', date: '2026-03-25', account_id: 'acc2' }),
  ]

  it('só o que veio depois da conferência', () => {
    expect(unchecked(movimento, 'acc1', check()).map((t) => t.id)).toEqual(['c'])
  })

  it('sem conferência nenhuma, tudo da conta conta', () => {
    expect(unchecked(movimento, 'acc1', null).map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  /**
   * O previsto não está no extrato do banco: anunciá-lo como pendência mandaria
   * a pessoa procurar no banco um lançamento que ainda não aconteceu.
   */
  it('o previsto não conta como movimento a conferir', () => {
    const comPrevisto = [...movimento, tx({ id: 'f', date: '2026-03-30', paid: false })]
    expect(unchecked(comPrevisto, 'acc1', check()).map((t) => t.id)).toEqual(['c'])
  })

  it('transferência recebida também é movimento da conta', () => {
    const comTransferencia = [
      ...movimento,
      tx({ id: 'e', date: '2026-03-22', account_id: 'acc2', transfer_account_id: 'acc1' }),
    ]
    expect(unchecked(comTransferencia, 'acc1', check()).map((t) => t.id)).toEqual(['c', 'e'])
  })
})

describe('lembrete de conferência', () => {
  const hoje = '2026-10-02'

  it('conta a distância em dias desde a última', () => {
    expect(daysSinceCheck(check({ date: '2026-09-30' }), hoje)).toBe(2)
    expect(daysSinceCheck(check({ date: '2026-08-01' }), hoje)).toBe(62)
    expect(daysSinceCheck(null, hoje)).toBeNull()
  })

  /**
   * Cobrar conferência de conta parada é ruído, e ruído ensina a ignorar o
   * aviso: sem movimento novo, não há o que procurar no extrato.
   */
  it('conta sem movimento novo não cobra nada', () => {
    expect(needsCheck(null, hoje, 0)).toBe(false)
    expect(needsCheck(check({ date: '2026-01-01' }), hoje, 0)).toBe(false)
  })

  it('nunca conferida com movimento entra no lembrete', () => {
    expect(needsCheck(null, hoje, 3)).toBe(true)
  })

  it('depois de um mes sem conferir, lembra', () => {
    expect(needsCheck(check({ date: '2026-09-25' }), hoje, 3)).toBe(false)
    expect(needsCheck(check({ date: '2026-09-02' }), hoje, 3)).toBe(true)
  })
})
