import { describe, expect, it } from 'vitest'
import { abertoDoMes, fimDoMes, saldoNoDia, saldoPorMes } from './saldo-por-mes'
import type { RecurringLike } from './recurring'
import type { AccountLike, TransactionLike } from './reports'

const conta: AccountLike = {
  id: 'cc',
  kind: 'checking',
  initial_balance_cents: 100000,
  credit_limit_cents: null,
}

const cartao: AccountLike = {
  id: 'cartao',
  kind: 'credit',
  initial_balance_cents: 0,
  credit_limit_cents: 500000,
  closing_day: 20,
  due_day: 28,
}

const tx = (
  over: Partial<TransactionLike & { recurring_id: string | null }> & { id: string },
): TransactionLike & { recurring_id: string | null } => ({
  recurring_id: null,
  account_id: 'cc',
  transfer_account_id: null,
  category_id: null,
  kind: 'expense',
  amount_cents: 1000,
  date: '2026-08-10',
  competence: '2026-08',
  paid: true,
  ...over,
})

describe('fim do mês', () => {
  it('respeita o tamanho do mês', () => {
    expect(fimDoMes('2026-02')).toBe('2026-02-28')
    expect(fimDoMes('2026-09')).toBe('2026-09-30')
    expect(fimDoMes('2026-10')).toBe('2026-10-31')
  })
})

describe('saldo num dia', () => {
  it('conta até o dia e deixa o cartão de fora', () => {
    const lancamentos = [
      tx({ id: 'a', date: '2026-08-10', amount_cents: 20000 }),
      tx({ id: 'b', date: '2026-09-05', amount_cents: 5000 }),
      tx({ id: 'c', account_id: 'cartao', date: '2026-08-12', amount_cents: 9000 }),
    ]
    expect(saldoNoDia([conta, cartao], lancamentos, '2026-08-31')).toBe(80000)
  })
})

describe('saldo por mês', () => {
  const lancamentos = [
    tx({ id: 'sal-ago', kind: 'income', date: '2026-08-01', amount_cents: 50000 }),
    tx({ id: 'ali-ago', date: '2026-08-05', amount_cents: 30000 }),
    tx({ id: 'sal-set', kind: 'income', date: '2026-09-01', competence: '2026-09', amount_cents: 50000 }),
    tx({ id: 'ali-out', date: '2026-10-02', competence: '2026-10', amount_cents: 10000 }),
    // Ainda não pago: não entra no saldo de hoje, entra pelo "aberto" do mês.
    tx({ id: 'luz-out', date: '2026-10-20', competence: '2026-10', amount_cents: 4000, paid: false }),
  ]
  const aberto: Record<string, number> = { '2026-10': -4000, '2026-11': -20000, '2026-12': 15000 }

  it('mês fechado é realizado, o atual e os seguintes são previstos', () => {
    const pontos = saldoPorMes(
      [conta],
      lancamentos,
      ['2026-08', '2026-09', '2026-10', '2026-11'],
      '2026-10-04',
      (mes) => aberto[mes] ?? 0,
    )

    expect(pontos).toEqual([
      { competence: '2026-08', saldoCents: 120000, previsto: false },
      { competence: '2026-09', saldoCents: 170000, previsto: false },
      // Hoje: 160.000, menos a luz que falta pagar.
      { competence: '2026-10', saldoCents: 156000, previsto: true },
      { competence: '2026-11', saldoCents: 136000, previsto: true },
    ])
  })

  it('acumula meses fora da janela até o mês olhado', () => {
    // A janela começa em dezembro, mas dezembro depende de outubro e novembro.
    const [dezembro] = saldoPorMes([conta], lancamentos, ['2026-12'], '2026-10-04', (mes) => aberto[mes] ?? 0)
    expect(dezembro).toEqual({ competence: '2026-12', saldoCents: 151000, previsto: true })
  })

  it('sem conta nenhuma, tudo é zero', () => {
    const pontos = saldoPorMes([], [], ['2026-09', '2026-10'], '2026-10-04', () => 0)
    expect(pontos.map((ponto) => ponto.saldoCents)).toEqual([0, 0])
  })
})

describe('o que o mês ainda vai mexer no saldo', () => {
  const aluguel: RecurringLike = {
    id: 'aluguel',
    description: 'Aluguel',
    account_id: 'cc',
    category_id: null,
    kind: 'expense',
    amount_cents: 150000,
    day_of_month: 5,
    start_date: '2026-01-05',
    end_date: null,
    active: true,
  }

  it('soma o previsto, a recorrente não lançada e a fatura do mês', () => {
    const lancamentos = [
      tx({ id: 'luz', date: '2026-11-10', competence: '2026-11', amount_cents: 12000, paid: false }),
      tx({ id: 'bonus', kind: 'income', date: '2026-11-20', competence: '2026-11', amount_cents: 40000, paid: false }),
      // Compra de 15/10 cai na fatura que fecha em 20/10 e vence em 28/10:
      // fica fora de novembro.
      tx({ id: 'compra-out', account_id: 'cartao', date: '2026-10-15', competence: '2026-10', amount_cents: 8000, paid: false }),
      // Compra de 25/10 cai na fatura que vence em 28/11.
      tx({ id: 'compra-nov', account_id: 'cartao', date: '2026-10-25', competence: '2026-10', amount_cents: 30000, paid: false }),
    ]

    expect(abertoDoMes([conta, cartao], lancamentos, [aluguel], '2026-11', '2026-10-04')).toBe(
      40000 - 12000 - 150000 - 30000,
    )
  })

  it('compra no cartão não conta duas vezes: só a fatura entra', () => {
    const lancamentos = [
      tx({ id: 'compra', account_id: 'cartao', date: '2026-10-02', competence: '2026-10', amount_cents: 9000, paid: false }),
    ]
    expect(abertoDoMes([conta, cartao], lancamentos, [], '2026-10', '2026-10-04')).toBe(-9000)
  })

  it('recorrente já lançada no mês não entra de novo', () => {
    const lancamentos = [
      tx({ id: 'a', date: '2026-11-05', competence: '2026-11', amount_cents: 150000, recurring_id: 'aluguel', paid: false }),
    ]
    expect(abertoDoMes([conta], lancamentos, [aluguel], '2026-11', '2026-10-04')).toBe(-150000)
  })
})
