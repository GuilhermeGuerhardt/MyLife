import { describe, expect, it } from 'vitest'
import {
  addMonths,
  buildInstallments,
  competenceFor,
  competenceForPurchase,
  invoiceDueIn,
  statementPeriod,
  toCompetence,
} from './billing'
import {
  centsToInput,
  formatCents,
  mascaraDeDinheiro,
  parseAmount,
  splitInstallments,
} from './money'
import {
  accountBalance,
  availableLimit,
  budgetProgress,
  byCategory,
  commitmentProjection,
  faturasAPagar,
  goalProjection,
  invoiceTotal,
  invoicesDueIn,
  invoicesOfMonth,
  lateInvoices,
  monthlyFlow,
  isOverdue,
  openInvoiceTotal,
  overdueSummary,
  paidOnInvoice,
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
    expect(centsToInput(123456)).toBe('1.234,56')
    expect(centsToInput(0)).toBe('0,00')
    expect(centsToInput(-123456)).toBe('-1.234,56')
  })

  /**
   * A máscara conta pelos centavos, como o caixa eletrônico: cada dígito novo
   * empurra os outros para a esquerda. É o que tira da pessoa a tarefa de achar
   * a vírgula e o ponto do milhar no meio da digitação.
   */
  it('escreve a vírgula sozinha enquanto se digita', () => {
    expect(mascaraDeDinheiro('')).toBe('')
    expect(mascaraDeDinheiro('3')).toBe('0,03')
    expect(mascaraDeDinheiro('35')).toBe('0,35')
    expect(mascaraDeDinheiro('355')).toBe('3,55')
    expect(mascaraDeDinheiro('3550')).toBe('35,50')
    expect(mascaraDeDinheiro('123456')).toBe('1.234,56')
    expect(mascaraDeDinheiro('123456789')).toBe('1.234.567,89')
  })

  it('a máscara ignora o que não é dígito', () => {
    // Colar de um extrato dá no mesmo que digitar os números.
    expect(mascaraDeDinheiro('R$ 1.234,56')).toBe('1.234,56')
    expect(mascaraDeDinheiro('35,50')).toBe('35,50')
    expect(mascaraDeDinheiro('abc')).toBe('')
  })

  /**
   * O saldo inicial é o único campo em que o menos faz falta: existe gente que
   * começa a usar o app com a conta no vermelho, e sem sinal não dá para dizer.
   */
  it('a máscara preserva o sinal de menos', () => {
    expect(mascaraDeDinheiro('-')).toBe('-')
    expect(mascaraDeDinheiro('-3550')).toBe('-35,50')
    expect(mascaraDeDinheiro('-1.234,56')).toBe('-1.234,56')
    expect(parseAmount(mascaraDeDinheiro('-3550'))).toBe(-3550)
    // No meio do número ele não é sinal, é tecla errada.
    expect(mascaraDeDinheiro('35-50')).toBe('35,50')
  })

  it('a máscara não deixa zero à esquerda crescer', () => {
    // Apagar tudo e digitar de novo não pode deixar "0,0300" para trás.
    expect(mascaraDeDinheiro('0003')).toBe('0,03')
    expect(mascaraDeDinheiro('0')).toBe('0,00')
  })

  it('o que a máscara escreve, o parse lê de volta', () => {
    for (const digitos of ['7', '35', '3550', '123456', '99999999']) {
      expect(parseAmount(mascaraDeDinheiro(digitos))).toBe(Number(digitos))
    }
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

  /**
   * Cada parcela carrega a própria data, então a fatura dela sai da mesma conta
   * que a de qualquer compra — não existe mais regra especial para parcelamento.
   */
  it('a fatura de cada parcela sai da data da parcela', () => {
    const plano = buildInstallments(120000, 12, '2026-03-29', card)
    for (const parcela of plano) {
      expect(competenceForPurchase(parcela.date, card)).toBe(parcela.invoice)
    }
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

  /**
   * Cada parcela acontece no seu mês: a de março em março, a de abril em abril.
   * Era o contrário — as três nasciam com a data da compra e eram empurradas
   * para a fatura certa pela competência —, e aí o mês da compra mostrava um
   * gasto que não era dele.
   */
  it('cada parcela cai no seu mês, com a data do mês dela', () => {
    const plan = buildInstallments(30000, 3, '2026-03-29', card)
    expect(plan.map((p) => p.date)).toEqual(['2026-03-29', '2026-04-29', '2026-05-29'])
    expect(plan.map((p) => p.competence)).toEqual(['2026-03', '2026-04', '2026-05'])
    // Fecha dia 28: cada parcela entra na fatura do mês seguinte ao dela.
    expect(plan.map((p) => p.invoice)).toEqual(['2026-04', '2026-05', '2026-06'])
    expect(plan.reduce((sum, p) => sum + p.amountCents, 0)).toBe(30000)
  })

  it('a parcela encolhe o dia em mês curto', () => {
    const plan = buildInstallments(30000, 3, '2025-12-31', { closingDay: 28, dueDay: 5 })
    expect(plan.map((p) => p.date)).toEqual(['2025-12-31', '2026-01-31', '2026-02-28'])
  })

  it('competência é sempre o mês do fato, cartão ou não', () => {
    expect(competenceFor('2026-09-24')).toBe('2026-09')
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

  /**
   * A fatura é a janela entre dois fechamentos, não um campo gravado: fechando
   * dia 28, a de abril cobre de 29/03 a 28/04.
   */
  it('soma a fatura pela janela de datas que ela cobre', () => {
    const cartao: AccountLike = {
      id: 'card',
      kind: 'credit',
      initial_balance_cents: 0,
      credit_limit_cents: 500000,
      closing_day: 28,
      due_day: 5,
    }
    const total = invoiceTotal(cartao, '2026-04', [
      tx({ id: '1', account_id: 'card', date: '2026-04-10', amount_cents: 5000 }),
      tx({ id: '2', account_id: 'card', date: '2026-03-29', amount_cents: 1500 }),
      // Antes do fechamento anterior: e da fatura passada.
      tx({ id: '3', account_id: 'card', date: '2026-03-20', amount_cents: 9900 }),
      // Depois do fechamento: e da proxima.
      tx({ id: '4', account_id: 'card', date: '2026-04-29', amount_cents: 7700 }),
    ])
    expect(total).toBe(6500)
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

describe('atraso', () => {
  const hoje = '2026-03-15'

  it('previsto com data passada está atrasado', () => {
    expect(isOverdue(tx({ id: 'a', paid: false, date: '2026-03-10' }), hoje)).toBe(true)
  })

  it('pago nunca está atrasado, por mais velho que seja', () => {
    expect(isOverdue(tx({ id: 'a', paid: true, date: '2020-01-01' }), hoje)).toBe(false)
  })

  it('previsto para o futuro não está atrasado', () => {
    expect(isOverdue(tx({ id: 'a', paid: false, date: '2026-03-20' }), hoje)).toBe(false)
  })

  it('vencer hoje ainda não é atraso', () => {
    expect(isOverdue(tx({ id: 'a', paid: false, date: hoje }), hoje)).toBe(false)
  })

  it('transferência não vence', () => {
    expect(
      isOverdue(tx({ id: 'a', paid: false, kind: 'transfer', date: '2026-01-01' }), hoje),
    ).toBe(false)
  })

  it('resume quantas, quanto e desde quando', () => {
    const resumo = overdueSummary(
      [
        tx({ id: 'a', paid: false, date: '2026-03-02', amount_cents: 5000 }),
        tx({ id: 'b', paid: false, date: '2026-02-28', amount_cents: 3000 }),
        tx({ id: 'c', paid: true, date: '2026-01-05', amount_cents: 9900 }),
        tx({ id: 'd', paid: false, date: '2026-03-30', amount_cents: 1000 }),
      ],
      hoje,
    )
    expect(resumo.count).toBe(2)
    expect(resumo.totalCents).toBe(8000)
    expect(resumo.oldestDate).toBe('2026-02-28')
  })

  it('sem atrasos, resume em zero e sem data', () => {
    const resumo = overdueSummary([tx({ id: 'a', paid: true })], hoje)
    expect(resumo).toEqual({ count: 0, totalCents: 0, oldestDate: null })
  })
})

describe('fatura paga', () => {
  const cartao: AccountLike = {
    id: 'card',
    kind: 'credit',
    initial_balance_cents: 0,
    credit_limit_cents: 500000,
    closing_day: 28,
    due_day: 5,
  }

  // Fatura de março: compras de 01/03 a 28/03. A de abril começa em 29/03.
  const compras: TransactionLike[] = [
    tx({ id: 'a', account_id: 'card', date: '2026-03-05', amount_cents: 12700, paid: false }),
    tx({ id: 'b', account_id: 'card', date: '2026-03-20', amount_cents: 8900, paid: false }),
    tx({ id: 'c', account_id: 'card', date: '2026-04-02', amount_cents: 5590, paid: false }),
  ]

  const quitarMarco = (lista: TransactionLike[]) =>
    lista.map((t) => (t.date <= '2026-03-28' ? { ...t, paid: true } : t))

  it('o total da fatura conta tudo da janela dela', () => {
    expect(invoiceTotal(cartao, '2026-03', compras)).toBe(21600)
  })

  it('o total da fatura não muda depois de paga', () => {
    expect(invoiceTotal(cartao, '2026-03', quitarMarco(compras))).toBe(21600)
  })

  it('o que falta pagar zera depois de quitada', () => {
    expect(openInvoiceTotal(cartao, '2026-03', compras)).toBe(21600)
    expect(openInvoiceTotal(cartao, '2026-03', quitarMarco(compras))).toBe(0)
  })

  it('quitar uma fatura não mexe na seguinte', () => {
    expect(openInvoiceTotal(cartao, '2026-04', quitarMarco(compras))).toBe(5590)
  })
})

describe('comprometido', () => {
  const parcelas: TransactionLike[] = [
    tx({ id: 'p1', competence: '2026-03', amount_cents: 20000, paid: false, installment_group_id: 'g1' }),
    tx({ id: 'p2', competence: '2026-04', amount_cents: 20000, paid: false, installment_group_id: 'g1' }),
    tx({ id: 'p3', competence: '2026-05', amount_cents: 20000, paid: false, installment_group_id: 'g1' }),
    tx({ id: 'c1', competence: '2026-04', amount_cents: 7500, paid: false }),
  ]

  it('soma as despesas em aberto dos meses seguintes', () => {
    const projecao = commitmentProjection(parcelas, '2026-03', 12)
    expect(projecao.total).toBe(47500)
    expect(projecao.months).toHaveLength(12)
    expect(projecao.months[0]).toEqual({ competence: '2026-04', total: 27500 })
    expect(projecao.months[1]).toEqual({ competence: '2026-05', total: 20000 })
  })

  it('o mês atual não entra: ele já está na tela', () => {
    const projecao = commitmentProjection(parcelas, '2026-03', 12)
    expect(projecao.months.some((mes) => mes.competence === '2026-03')).toBe(false)
  })

  it('o que já foi pago some da conta', () => {
    const quitada = parcelas.map((t) => (t.id === 'p2' ? { ...t, paid: true } : t))
    expect(commitmentProjection(quitada, '2026-03', 12).total).toBe(27500)
  })

  it('receita e transferência não comprometem nada', () => {
    const outros: TransactionLike[] = [
      tx({ id: 'r', competence: '2026-04', kind: 'income', amount_cents: 500000, paid: false }),
      tx({ id: 't', competence: '2026-04', kind: 'transfer', amount_cents: 100000, paid: false }),
    ]
    expect(commitmentProjection(outros, '2026-03', 12).total).toBe(0)
  })

  it('aponta o mês mais pesado e quantas compras parceladas pesam', () => {
    const projecao = commitmentProjection(parcelas, '2026-03', 12)
    expect(projecao.heaviest).toEqual({ competence: '2026-04', total: 27500 })
    expect(projecao.purchases).toBe(1)
  })

  it('sem nada à frente, não aponta mês nenhum', () => {
    const projecao = commitmentProjection([tx({ id: 'a', paid: true })], '2026-03', 12)
    expect(projecao.total).toBe(0)
    expect(projecao.heaviest).toBeNull()
    expect(projecao.lastCompetence).toBeNull()
  })

  /**
   * A dívida que passa do período precisa aparecer de algum jeito: um carnê de
   * 24 meses somado só até o décimo segundo esconderia metade de si mesmo.
   */
  it('diz até quando vai a dívida, mesmo além do período somado', () => {
    const longa = [
      ...parcelas,
      tx({ id: 'p24', competence: '2028-02', amount_cents: 20000, paid: false, installment_group_id: 'g1' }),
    ]
    const projecao = commitmentProjection(longa, '2026-03', 12)
    expect(projecao.total).toBe(47500)
    expect(projecao.lastCompetence).toBe('2028-02')
  })
})

describe('quem vence é a fatura', () => {
  const hoje = '2026-10-08'
  const cartao: AccountLike = {
    id: 'card',
    kind: 'credit',
    initial_balance_cents: 0,
    credit_limit_cents: 500000,
    closing_day: 25,
    due_day: 5,
  }
  const cartoes = new Set(['card'])

  /**
   * A compra no cartão nasce em aberto de propósito: quem a quita é a fatura.
   * Tratar a data da compra como prazo transformava todo cartão usado numa
   * fileira de alerta vermelho no dia seguinte à compra.
   */
  it('compra no cartão não vence sozinha', () => {
    const compra = tx({ id: 'c', account_id: 'card', date: '2026-09-24', paid: false })
    expect(isOverdue(compra, hoje)).toBe(true)
    expect(isOverdue(compra, hoje, cartoes)).toBe(false)
  })

  it('conta comum continua vencendo', () => {
    const boleto = tx({ id: 'b', account_id: 'acc1', date: '2026-10-01', paid: false })
    expect(isOverdue(boleto, hoje, cartoes)).toBe(true)
  })

  it('o resumo ignora o cartão e soma só o resto', () => {
    const resumo = overdueSummary(
      [
        tx({ id: 'c', account_id: 'card', date: '2026-09-24', amount_cents: 25000, paid: false }),
        tx({ id: 'b', account_id: 'acc1', date: '2026-10-01', amount_cents: 7000, paid: false }),
      ],
      hoje,
      cartoes,
    )
    expect(resumo.count).toBe(1)
    expect(resumo.totalCents).toBe(7000)
  })

  it('a fatura vencida aparece com o que falta pagar', () => {
    const compras = [
      tx({ id: 'c1', account_id: 'card', date: '2026-09-02', amount_cents: 25000, paid: false }),
      tx({ id: 'c2', account_id: 'card', date: '2026-09-10', amount_cents: 10000, paid: false }),
    ]
    const atrasadas = lateInvoices([cartao], compras, hoje)
    expect(atrasadas).toHaveLength(1)
    expect(atrasadas[0]!.competence).toBe('2026-09')
    // Fecha dia 25 de setembro, vence dia 5 de outubro.
    expect(atrasadas[0]!.dueDate).toBe('2026-10-05')
    expect(atrasadas[0]!.totalCents).toBe(35000)
  })

  it('quitar a fatura tira ela do aviso, sem estado novo para manter', () => {
    const compras = [
      tx({ id: 'c1', account_id: 'card', date: '2026-09-02', amount_cents: 25000, paid: true }),
    ]
    expect(lateInvoices([cartao], compras, hoje)).toEqual([])
  })

  it('fatura que ainda não venceu fica de fora', () => {
    const compras = [
      tx({ id: 'c1', account_id: 'card', date: '2026-10-02', amount_cents: 25000, paid: false }),
    ]
    expect(lateInvoices([cartao], compras, hoje)).toEqual([])
  })

  describe('o que falta pagar dos cartões', () => {
    // Fecha dia 25, vence dia 5. A compra de 30/08 cai na fatura que fechou em
    // 25/09 e venceu em 05/10; a de 28/09, na que vence em 05/11.
    const venceu = tx({ id: 'v', account_id: 'card', date: '2026-08-30', amount_cents: 15000, paid: false })
    const aVencer = tx({ id: 'a', account_id: 'card', date: '2026-09-28', amount_cents: 58000, paid: false })

    it('soma a fatura do mês e a vencida que ficou para trás', () => {
      // Novembro olhado em 08/10: a de 05/10 venceu, a de 05/11 é a do mês.
      expect(faturasAPagar([cartao], [venceu, aVencer], '2026-11', hoje)).toEqual({
        doMesCents: 58000,
        vencidasCents: 15000,
        vencidas: 1,
        totalCents: 73000,
      })
    })

    it('a vencida que é a própria fatura do mês entra uma vez só', () => {
      // Outubro olhado em 08/10: a fatura do mês é a que venceu em 05/10.
      expect(faturasAPagar([cartao], [venceu], '2026-10', hoje)).toEqual({
        doMesCents: 15000,
        vencidasCents: 0,
        vencidas: 0,
        totalCents: 15000,
      })
    })

    it('fatura quitada não entra', () => {
      const paga = { ...venceu, paid: true }
      expect(faturasAPagar([cartao], [paga, aVencer], '2026-11', hoje).vencidasCents).toBe(0)
    })
  })

  /**
   * O mês em que a fatura vence quase nunca é o da competência dela: fecha em
   * setembro, vence em outubro. Era isso que fazia a compra aparecer como conta
   * a pagar no mês errado.
   */
  it('a fatura entra no mês em que vence, não no da competência', () => {
    const compras = [
      tx({ id: 'c1', account_id: 'card', date: '2026-09-02', amount_cents: 32000, paid: false }),
    ]
    expect(invoicesDueIn([cartao], compras, '2026-09')).toEqual([])
    const emOutubro = invoicesDueIn([cartao], compras, '2026-10')
    expect(emOutubro).toHaveLength(1)
    expect(emOutubro[0]!.dueDate).toBe('2026-10-05')
    expect(emOutubro[0]!.totalCents).toBe(32000)
  })

  it('estorno abate a fatura, e a fatura zerada não aparece', () => {
    const compras = [
      tx({ id: 'c1', account_id: 'card', date: '2026-09-02', amount_cents: 32000, paid: false }),
      tx({
        id: 'e1',
        account_id: 'card',
        date: '2026-09-10',
        kind: 'income',
        amount_cents: 32000,
        paid: false,
      }),
    ]
    expect(invoicesDueIn([cartao], compras, '2026-10')).toEqual([])
  })

  it('conta que não é cartão nunca gera fatura', () => {
    const corrente: AccountLike = {
      id: 'acc1',
      kind: 'checking',
      initial_balance_cents: 0,
      credit_limit_cents: null,
    }
    const abertos = [tx({ id: 'b', date: '2026-09-02', paid: false })]
    expect(lateInvoices([corrente], abertos, hoje)).toEqual([])
  })
})

describe('pagamento parcial da fatura', () => {
  const cartao: AccountLike = {
    id: 'card',
    kind: 'credit',
    initial_balance_cents: 0,
    credit_limit_cents: 500000,
    closing_day: 25,
    due_day: 5,
  }

  // Fecha dia 25: a fatura de setembro cobre de 26/08 a 25/09.
  const compras: TransactionLike[] = [
    tx({ id: 'c1', account_id: 'card', date: '2026-09-02', amount_cents: 30000, paid: false }),
    tx({ id: 'c2', account_id: 'card', date: '2026-09-10', amount_cents: 20000, paid: false }),
  ]

  /** O pagamento mora na conta de onde o dinheiro saiu, apontando para a fatura. */
  const pagamento = (amount_cents: number) =>
    tx({
      id: `p${amount_cents}`,
      account_id: 'acc1',
      transfer_account_id: 'card',
      kind: 'transfer',
      competence: '2026-10',
      invoice_competence: '2026-09',
      amount_cents,
      paid: true,
    })

  it('o que falta pagar desconta o que ja foi pago', () => {
    expect(openInvoiceTotal(cartao, '2026-09', compras)).toBe(50000)
    expect(openInvoiceTotal(cartao, '2026-09', [...compras, pagamento(20000)])).toBe(30000)
  })

  it('dois pagamentos parciais somam', () => {
    const comPagamentos = [...compras, pagamento(20000), pagamento(15000)]
    expect(paidOnInvoice('card', '2026-09', comPagamentos)).toBe(35000)
    expect(openInvoiceTotal(cartao, '2026-09', comPagamentos)).toBe(15000)
  })

  it('pagamento nao vaza para a fatura do mes seguinte', () => {
    const outroMes = [
      ...compras,
      tx({ id: 'c3', account_id: 'card', date: '2026-10-02', amount_cents: 12000, paid: false }),
      pagamento(50000),
    ]
    expect(openInvoiceTotal(cartao, '2026-09', outroMes)).toBe(0)
    expect(openInvoiceTotal(cartao, '2026-10', outroMes)).toBe(12000)
  })

  /**
   * A fatura paga pela metade continua existindo, e continua vencendo: é
   * justamente ela que precisa aparecer no aviso.
   */
  it('a fatura paga pela metade continua em aberto, pelo que falta', () => {
    const atrasadas = lateInvoices([cartao], [...compras, pagamento(20000)], '2026-10-08')
    expect(atrasadas).toHaveLength(1)
    expect(atrasadas[0]!.totalCents).toBe(30000)
  })

  it('fatura paga inteira some do aviso mesmo sem marcar compra por compra', () => {
    expect(lateInvoices([cartao], [...compras, pagamento(50000)], '2026-10-08')).toEqual([])
  })

  it('transferencia comum para o cartao nao conta como pagamento de fatura', () => {
    const transferenciaSolta = tx({
      id: 't',
      account_id: 'acc1',
      transfer_account_id: 'card',
      kind: 'transfer',
      amount_cents: 20000,
      competence: '2026-10',
      paid: true,
    })
    expect(openInvoiceTotal(cartao, '2026-09', [...compras, transferenciaSolta])).toBe(50000)
  })
})

describe('qual fatura pertence ao mês', () => {
  /**
   * Fatura tem dois meses: o em que fecha e o em que vence. Quem abre outubro
   * quer a conta que paga em outubro — a que fechou em setembro —, não a que
   * ainda está acumulando e só vence em novembro.
   */
  it('vencimento antes do fechamento: o mês mostra a fatura do mês anterior', () => {
    const inter = { closingDay: 20, dueDay: 15 }
    expect(invoiceDueIn('2026-10', inter)).toBe('2026-09')
    expect(statementPeriod('2026-09', inter).dueDate).toBe('2026-10-15')
  })

  it('vencimento depois do fechamento: fecha e vence no mesmo mês', () => {
    const cedo = { closingDay: 5, dueDay: 15 }
    expect(invoiceDueIn('2026-10', cedo)).toBe('2026-10')
    expect(statementPeriod('2026-10', cedo).dueDate).toBe('2026-10-15')
  })

  it('vira o ano para trás sem tropeçar', () => {
    expect(invoiceDueIn('2026-01', { closingDay: 20, dueDay: 15 })).toBe('2025-12')
  })
})

describe('a fatura na lista de lançamentos', () => {
  const cartao: AccountLike = {
    id: 'card',
    kind: 'credit',
    initial_balance_cents: 0,
    credit_limit_cents: 500000,
    closing_day: 20,
    due_day: 15,
  }

  // Fatura que vence em 15/10: compras de 21/08 a 20/09.
  const compras: TransactionLike[] = [
    tx({ id: 'c1', account_id: 'card', date: '2026-08-28', amount_cents: 20000, paid: false }),
    tx({ id: 'c2', account_id: 'card', date: '2026-09-15', amount_cents: 15000, paid: false }),
    // Ja e da fatura seguinte.
    tx({ id: 'c3', account_id: 'card', date: '2026-09-24', amount_cents: 5000, paid: false }),
  ]

  it('mostra no mês a fatura que vence nele, com o que ela somou', () => {
    const [fatura] = invoicesOfMonth([cartao], compras, '2026-10')
    expect(fatura).toMatchObject({
      competence: '2026-09',
      dueDate: '2026-10-15',
      totalCents: 35000,
      openCents: 35000,
    })
  })

  /** O valor é derivado: compra nova entra na conta sem ninguém editar nada. */
  it('o valor acompanha a compra nova', () => {
    const maisUma = [
      ...compras,
      tx({ id: 'c4', account_id: 'card', date: '2026-09-18', amount_cents: 7000, paid: false }),
    ]
    expect(invoicesOfMonth([cartao], maisUma, '2026-10')[0]!.totalCents).toBe(42000)
  })

  it('a fatura paga continua na lista, com o que falta zerado', () => {
    const quitada = compras.map((t) => (t.date <= '2026-09-20' ? { ...t, paid: true } : t))
    const [fatura] = invoicesOfMonth([cartao], quitada, '2026-10')
    expect(fatura!.totalCents).toBe(35000)
    expect(fatura!.openCents).toBe(0)
  })

  it('mês sem fatura nenhuma não inventa linha', () => {
    expect(invoicesOfMonth([cartao], compras, '2026-08')).toEqual([])
  })
})
