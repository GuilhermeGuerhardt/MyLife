import { describe, expect, it } from 'vitest'
import { isOpen, summarizeOpenMonth, type OpenLike } from './open-month'
import type { PendingOccurrence, RecurringLike } from './recurring'

const HOJE = '2026-08-21'

function tx(over: Partial<OpenLike> = {}): OpenLike {
  return { kind: 'expense', amount_cents: 10000, date: '2026-08-10', paid: false, ...over }
}

function pend(over: Partial<RecurringLike> & { date?: string } = {}): PendingOccurrence {
  const { date = '2026-08-15', ...rest } = over
  return {
    date,
    rule: {
      id: 'r1',
      description: 'Regra',
      account_id: 'acc',
      category_id: null,
      kind: 'expense',
      amount_cents: 20000,
      day_of_month: 15,
      start_date: '2026-01-01',
      end_date: null,
      active: true,
      ...rest,
    },
  }
}

describe('o que conta como em aberto', () => {
  it('previsto conta', () => {
    expect(isOpen(tx({ paid: false }))).toBe(true)
  })

  it('pago não conta', () => {
    expect(isOpen(tx({ paid: true }))).toBe(false)
  })

  it('transferência não conta, nem quando prevista', () => {
    expect(isOpen(tx({ kind: 'transfer', paid: false }))).toBe(false)
  })
})

describe('resumo do mês em aberto', () => {
  it('separa o que falta sair do que falta entrar', () => {
    const r = summarizeOpenMonth(
      [
        tx({ kind: 'expense', amount_cents: 180000 }),
        tx({ kind: 'expense', amount_cents: 11990 }),
        tx({ kind: 'income', amount_cents: 742000 }),
      ],
      [],
      HOJE,
    )
    expect(r.toPayCents).toBe(191990)
    expect(r.toReceiveCents).toBe(742000)
    expect(r.balanceCents).toBe(742000 - 191990)
    expect(r.count).toBe(3)
  })

  it('soma as recorrentes pendentes junto dos lançamentos', () => {
    const r = summarizeOpenMonth(
      [tx({ kind: 'expense', amount_cents: 10000 })],
      [pend({ kind: 'expense', amount_cents: 20000 })],
      HOJE,
    )
    expect(r.toPayCents).toBe(30000)
    expect(r.count).toBe(2)
  })

  it('recorrente de receita entra no que falta receber', () => {
    const r = summarizeOpenMonth([], [pend({ kind: 'income', amount_cents: 500000 })], HOJE)
    expect(r.toReceiveCents).toBe(500000)
    expect(r.toPayCents).toBe(0)
    expect(r.balanceCents).toBe(500000)
  })

  it('ignora o que já foi pago', () => {
    const r = summarizeOpenMonth(
      [tx({ paid: true, amount_cents: 999900 }), tx({ paid: false, amount_cents: 10000 })],
      [],
      HOJE,
    )
    expect(r.count).toBe(1)
    expect(r.toPayCents).toBe(10000)
  })

  it('ignora transferência prevista', () => {
    const r = summarizeOpenMonth([tx({ kind: 'transfer', amount_cents: 50000 })], [], HOJE)
    expect(r).toEqual({
      count: 0,
      toPayCents: 0,
      toReceiveCents: 0,
      balanceCents: 0,
      overdueCount: 0,
    })
  })

  it('conta vencidos dos dois lados', () => {
    const r = summarizeOpenMonth(
      [tx({ date: '2026-08-02' }), tx({ date: '2026-08-30' })],
      [pend({ date: '2026-08-05' }), pend({ date: '2026-08-25' })],
      HOJE,
    )
    expect(r.overdueCount).toBe(2)
  })

  it('vencer hoje ainda não é atraso', () => {
    const r = summarizeOpenMonth([tx({ date: HOJE })], [], HOJE)
    expect(r.overdueCount).toBe(0)
  })

  it('mês sem nada em aberto resume em zero', () => {
    expect(summarizeOpenMonth([], [], HOJE)).toEqual({
      count: 0,
      toPayCents: 0,
      toReceiveCents: 0,
      balanceCents: 0,
      overdueCount: 0,
    })
  })

  it('saldo negativo quando falta sair mais do que entrar', () => {
    const r = summarizeOpenMonth(
      [tx({ kind: 'expense', amount_cents: 300000 }), tx({ kind: 'income', amount_cents: 100000 })],
      [],
      HOJE,
    )
    expect(r.balanceCents).toBe(-200000)
  })
})
