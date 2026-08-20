import { describe, expect, it } from 'vitest'
import {
  addMonths,
  buildInstallments,
  competenceForPurchase,
  statementPeriod,
  toCompetence,
} from './billing'
import { centsToInput, formatCents, parseAmount, splitInstallments } from './money'
import {
  accountBalance,
  availableLimit,
  budgetProgress,
  byCategory,
  goalProjection,
  invoiceTotal,
  monthlyFlow,
  type AccountLike,
  type TransactionLike,
} from './reports'

describe('dinheiro', () => {
  it('interpreta o que a pessoa digita', () => {
    expect(parseAmount('35')).toBe(3500)
    expect(parseAmount('35,50')).toBe(3550)
    expect(parseAmount('R$ 1.234,56')).toBe(123456)
    expect(parseAmount('1234.56')).toBe(123456)
    expect(parseAmount('1.234')).toBe(123400)
    expect(parseAmount('')).toBe(0)
    expect(parseAmount('abc')).toBe(0)
  })

  it('formata centavos em reais', () => {
    expect(formatCents(123456)).toMatch(/1\.234,56/)
    expect(centsToInput(3550)).toBe('35,50')
  })

  it('não perde centavos ao parcelar', () => {
    const parts = splitInstallments(10000, 3)
    expect(parts).toEqual([3334, 3333, 3333])
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10000)
  })

  it('parcela valores que dividem exato', () => {
    expect(splitInstallments(9000, 3)).toEqual([3000, 3000, 3000])
  })
})

describe('fatura do cartão', () => {
  const card = { closingDay: 28, dueDay: 5 }

  it('compra antes do fechamento entra na fatura do mês', () => {
    expect(competenceForPurchase('2026-03-10', card)).toBe('2026-03')
    expect(competenceForPurchase('2026-03-28', card)).toBe('2026-03')
  })

  it('compra depois do fechamento vai para a fatura seguinte', () => {
    expect(competenceForPurchase('2026-03-29', card)).toBe('2026-04')
    expect(competenceForPurchase('2026-12-31', card)).toBe('2027-01')
  })

  it('calcula período e vencimento da fatura', () => {
    const period = statementPeriod('2026-03', card)
    expect(period.start).toBe('2026-03-01')
    expect(period.end).toBe('2026-03-28')
    // Vence dia 5 do mês seguinte, porque o vencimento vem antes do fechamento.
    expect(period.dueDate).toBe('2026-04-05')
  })

  it('vence no mesmo mês quando o vencimento vem depois do fechamento', () => {
    const period = statementPeriod('2026-03', { closingDay: 5, dueDay: 15 })
    expect(period.dueDate).toBe('2026-03-15')
  })

  it('não estoura em meses curtos', () => {
    const period = statementPeriod('2026-02', { closingDay: 31, dueDay: 31 })
    expect(period.end).toBe('2026-02-28')
  })

  it('avança competência virando o ano', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })

  it('distribui parcelas nas faturas seguintes', () => {
    const plan = buildInstallments(30000, 3, '2026-03-29', card)
    expect(plan.map((p) => p.competence)).toEqual(['2026-04', '2026-05', '2026-06'])
    expect(plan.map((p) => p.dueDate)).toEqual(['2026-05-05', '2026-06-05', '2026-07-05'])
    expect(plan.reduce((sum, p) => sum + p.amountCents, 0)).toBe(30000)
  })

  it('extrai competência da data', () => {
    expect(toCompetence('2026-07-15')).toBe('2026-07')
  })
})

const tx = (over: Partial<TransactionLike> & { id: string }): TransactionLike => ({
  account_id: 'acc1',
  transfer_account_id: null,
  category_id: 'cat1',
  kind: 'expense',
  amount_cents: 1000,
  date: '2026-03-10',
  competence: '2026-03',
  paid: true,
  ...over,
})

const account: AccountLike = {
  id: 'acc1',
  kind: 'checking',
  initial_balance_cents: 100000,
  credit_limit_cents: null,
}

describe('saldo', () => {
  it('soma receitas e subtrai despesas', () => {
    const balance = accountBalance(account, [
      tx({ id: '1', kind: 'income', amount_cents: 500000 }),
      tx({ id: '2', kind: 'expense', amount_cents: 150000 }),
    ])
    expect(balance).toBe(100000 + 500000 - 150000)
  })

  it('ignora lançamentos não efetivados', () => {
    expect(accountBalance(account, [tx({ id: '1', amount_cents: 5000, paid: false })])).toBe(100000)
  })

  it('trata transferência nos dois sentidos', () => {
    const destino: AccountLike = { ...account, id: 'acc2', initial_balance_cents: 0 }
    const transfer = tx({
      id: 't',
      kind: 'transfer',
      amount_cents: 30000,
      transfer_account_id: 'acc2',
    })
    expect(accountBalance(account, [transfer])).toBe(70000)
    expect(accountBalance(destino, [transfer])).toBe(30000)
  })

  it('calcula limite disponível do cartão', () => {
    const card: AccountLike = {
      id: 'card',
      kind: 'credit',
      initial_balance_cents: 0,
      credit_limit_cents: 500000,
    }
    const limit = availableLimit(card, [
      tx({ id: '1', account_id: 'card', amount_cents: 120000, paid: false }),
    ])
    expect(limit).toBe(380000)
  })

  it('soma a fatura por competência, não por data', () => {
    const total = invoiceTotal('card', '2026-04', [
      tx({ id: '1', account_id: 'card', competence: '2026-04', amount_cents: 5000 }),
      tx({ id: '2', account_id: 'card', competence: '2026-03', amount_cents: 9900 }),
    ])
    expect(total).toBe(5000)
  })
})

describe('relatórios', () => {
  const transactions = [
    tx({ id: '1', kind: 'income', amount_cents: 500000, category_id: 'salario' }),
    tx({ id: '2', kind: 'expense', amount_cents: 150000, category_id: 'moradia' }),
    tx({ id: '3', kind: 'expense', amount_cents: 50000, category_id: 'mercado' }),
    tx({ id: '4', kind: 'transfer', amount_cents: 100000, transfer_account_id: 'acc2' }),
    tx({ id: '5', kind: 'expense', amount_cents: 99999, competence: '2026-02' }),
  ]

  it('separa receita e despesa do mês e calcula a taxa de poupança', () => {
    const flow = monthlyFlow(transactions, '2026-03')
    expect(flow.income).toBe(500000)
    expect(flow.expense).toBe(200000)
    expect(flow.net).toBe(300000)
    expect(flow.savingsRate).toBe(60)
  })

  it('não conta transferência como receita nem despesa', () => {
    const flow = monthlyFlow([tx({ id: 't', kind: 'transfer', amount_cents: 100000 })], '2026-03')
    expect(flow.income).toBe(0)
    expect(flow.expense).toBe(0)
  })

  it('agrupa despesas por categoria, da maior para a menor', () => {
    const groups = byCategory(transactions, '2026-03')
    expect(groups[0]).toMatchObject({ categoryId: 'moradia', total: 150000, percent: 75 })
    expect(groups[1]).toMatchObject({ categoryId: 'mercado', total: 50000, percent: 25 })
  })

  it('classifica o consumo do orçamento', () => {
    expect(budgetProgress(100000, 50000).status).toBe('ok')
    expect(budgetProgress(100000, 85000).status).toBe('warning')
    expect(budgetProgress(100000, 120000).status).toBe('exceeded')
    expect(budgetProgress(100000, 120000).remaining).toBe(-20000)
  })
})

describe('metas', () => {
  it('calcula aporte mensal necessário', () => {
    const projection = goalProjection(1000000, 250000, '2026-12', '2026-03')
    expect(projection.percent).toBe(25)
    expect(projection.monthsLeft).toBe(9)
    expect(projection.monthlyNeeded).toBe(83334)
  })

  it('reconhece meta atingida', () => {
    const projection = goalProjection(100000, 100000, '2026-12', '2026-03')
    expect(projection.reached).toBe(true)
    expect(projection.remaining).toBe(0)
  })

  it('funciona sem data alvo', () => {
    const projection = goalProjection(100000, 20000, null, '2026-03')
    expect(projection.monthlyNeeded).toBeNull()
    expect(projection.percent).toBe(20)
  })
})
