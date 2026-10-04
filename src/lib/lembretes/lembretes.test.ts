import { describe, expect, it } from 'vitest'
import {
  agruparEnvios,
  anotarEnviados,
  lembretesDeAgora,
  naoEnviados,
  type DadosDosLembretes,
  type LancamentoLike,
  type Lembrete,
  type TipoDeLembrete,
} from './lembretes'

const TODOS = new Set<TipoDeLembrete>(['contas', 'prazos', 'recorrentes', 'conferencia', 'habitos'])

const conta = {
  id: 'cc',
  name: 'Conta corrente',
  kind: 'checking' as const,
  initial_balance_cents: 100000,
  credit_limit_cents: null,
  archived: false,
}

const cartao = {
  id: 'cartao',
  name: 'Nubank',
  kind: 'credit' as const,
  initial_balance_cents: 0,
  credit_limit_cents: 500000,
  closing_day: 20,
  due_day: 28,
  archived: false,
}

const tx = (over: Partial<LancamentoLike> & { id: string }): LancamentoLike => ({
  account_id: 'cc',
  transfer_account_id: null,
  category_id: null,
  kind: 'expense',
  amount_cents: 1000,
  date: '2026-10-04',
  competence: '2026-10',
  paid: true,
  recurring_id: null,
  description: 'Lançamento',
  ...over,
})

const vazio = (over: Partial<DadosDosLembretes> = {}): DadosDosLembretes => ({
  hoje: '2026-10-25',
  hora: 10,
  contas: [conta, cartao],
  lancamentos: [],
  conferencias: [],
  recorrentes: [],
  prazos: [],
  tarefas: [],
  habitos: [],
  registrosDeHabito: [],
  ...over,
})

const ids = (lembretes: Lembrete[]) => lembretes.map((lembrete) => lembrete.id)

describe('contas e faturas', () => {
  // Compra de 03/10 cai na fatura que fecha em 20/10 e vence em 28/10.
  const compra = tx({ id: 'compra', account_id: 'cartao', date: '2026-10-03', amount_cents: 45000, paid: false })

  it('avisa a fatura a três dias do vencimento', () => {
    const lembretes = lembretesDeAgora(vazio({ lancamentos: [compra] }), TODOS)
    expect(lembretes).toHaveLength(1)
    expect(lembretes[0]).toMatchObject({
      id: 'fatura:cartao:2026-10:perto',
      titulo: 'Fatura do Nubank vence em 3 dias',
    })
    expect(lembretes[0]!.corpo).toContain('450,00')
  })

  it('não avisa a fatura que ainda está longe', () => {
    expect(lembretesDeAgora(vazio({ hoje: '2026-10-20', lancamentos: [compra] }), TODOS)).toEqual([])
  })

  it('a fatura vencida é outro aviso, e vem antes', () => {
    const luz = tx({ id: 'luz', date: '2026-10-30', amount_cents: 12000, paid: false, description: 'Luz' })
    const lembretes = lembretesDeAgora(
      vazio({ hoje: '2026-10-29', lancamentos: [compra, luz] }),
      TODOS,
    )
    expect(ids(lembretes)).toEqual(['fatura:cartao:2026-10:vencida', 'conta:luz:perto'])
  })

  it('a compra no cartão não avisa sozinha, mesmo com a data passada', () => {
    const lembretes = lembretesDeAgora(vazio({ lancamentos: [compra] }), TODOS)
    expect(ids(lembretes).some((id) => id.startsWith('conta:'))).toBe(false)
  })

  it('pagamento da fatura tira o aviso', () => {
    const pagamento = tx({
      id: 'pg',
      kind: 'transfer',
      transfer_account_id: 'cartao',
      amount_cents: 45000,
      invoice_competence: '2026-10',
    })
    // Só contas: o pagamento movimenta a conta, e a conferência avisaria.
    expect(
      lembretesDeAgora(vazio({ lancamentos: [compra, pagamento] }), new Set(['contas'])),
    ).toEqual([])
  })

  it('atraso de mais de uma semana já não vira balão', () => {
    const velha = tx({ id: 'velha', date: '2026-10-10', paid: false })
    expect(lembretesDeAgora(vazio({ lancamentos: [velha] }), TODOS)).toEqual([])
  })

  it('cartão arquivado não avisa', () => {
    const arquivado = { ...cartao, archived: true }
    expect(
      lembretesDeAgora(vazio({ contas: [conta, arquivado], lancamentos: [compra] }), TODOS),
    ).toEqual([])
  })
})

describe('prazos e tarefas', () => {
  const prova = { id: 'p1', title: 'Cálculo II', kind: 'prova' as const, date: '2026-10-27', done: false }

  it('avisa dois dias antes e no dia, com ids diferentes', () => {
    const antes = lembretesDeAgora(vazio({ prazos: [prova] }), TODOS)
    const noDia = lembretesDeAgora(vazio({ hoje: '2026-10-27', prazos: [prova] }), TODOS)
    expect(antes[0]).toMatchObject({ id: 'prazo:p1:perto', corpo: 'Prova em 2 dias, 27/10.' })
    expect(noDia[0]).toMatchObject({ id: 'prazo:p1:hoje', corpo: 'Prova hoje, 27/10.' })
  })

  it('aula e prazo concluído não avisam', () => {
    const aula = { ...prova, id: 'a1', kind: 'aula' as const }
    const feita = { ...prova, id: 'p2', done: true }
    expect(lembretesDeAgora(vazio({ prazos: [aula, feita] }), TODOS)).toEqual([])
  })

  it('tarefa com data avisa na véspera e no dia; sem data, nunca', () => {
    const tarefas = [
      { id: 't1', title: 'Renovar o seguro', date: '2026-10-26', done: false },
      { id: 't2', title: 'Sem prazo', date: null, done: false },
    ]
    expect(ids(lembretesDeAgora(vazio({ tarefas }), TODOS))).toEqual(['tarefa:t1:perto'])
  })
})

describe('recorrentes', () => {
  const aluguel = {
    id: 'aluguel',
    description: 'Aluguel',
    account_id: 'cc',
    category_id: null,
    kind: 'expense' as const,
    amount_cents: 150000,
    day_of_month: 5,
    start_date: '2026-01-05',
    end_date: null,
    active: true,
  }

  it('avisa depois que o dia chega, uma vez no mês', () => {
    expect(lembretesDeAgora(vazio({ hoje: '2026-10-04', recorrentes: [aluguel] }), TODOS)).toEqual([])
    expect(ids(lembretesDeAgora(vazio({ recorrentes: [aluguel] }), TODOS))).toEqual([
      'recorrente:aluguel:2026-10',
    ])
  })

  it('já lançada no mês, não avisa', () => {
    const lancado = tx({ id: 'a', date: '2026-10-05', recurring_id: 'aluguel', amount_cents: 150000 })
    expect(
      lembretesDeAgora(
        vazio({ recorrentes: [aluguel], lancamentos: [lancado] }),
        new Set(['recorrentes']),
      ),
    ).toEqual([])
  })
})

describe('conferência', () => {
  it('conta com movimento e nunca conferida avisa uma vez por mês', () => {
    const lancamentos = [tx({ id: 'm', date: '2026-10-02' })]
    const lembretes = lembretesDeAgora(vazio({ lancamentos }), TODOS)
    expect(lembretes[0]).toMatchObject({
      id: 'conferencia:cc:2026-10',
      corpo: '1 movimento e nenhuma conferência ainda.',
    })
  })

  it('conferida há menos de 30 dias, não avisa', () => {
    const lancamentos = [tx({ id: 'm', date: '2026-10-22' })]
    const conferencias = [
      { account_id: 'cc', date: '2026-10-15', balance_cents: 0, difference_cents: 0, created_at: '2026-10-15' },
    ]
    expect(lembretesDeAgora(vazio({ lancamentos, conferencias }), TODOS)).toEqual([])
  })
})

describe('hábitos', () => {
  const ler = { id: 'h1', name: 'Ler', cadence: 'daily' as const, target_per_week: 7, archived: false }
  const treino = { id: 'h2', name: 'Treinar', cadence: 'weekly' as const, target_per_week: 3, archived: false }

  it('só depois das 20h', () => {
    expect(lembretesDeAgora(vazio({ habitos: [ler], hora: 19 }), TODOS)).toEqual([])
    expect(lembretesDeAgora(vazio({ habitos: [ler], hora: 20 }), TODOS)[0]).toMatchObject({
      id: 'habitos:2026-10-25',
      titulo: 'Um hábito por marcar hoje',
      corpo: 'Ler',
    })
  })

  it('o feito hoje e o semanal folgado ficam de fora', () => {
    // Domingo, 25/10: a semana acabou de começar e o treino ainda tem folga.
    const registros = [{ habit_id: 'h1', date: '2026-10-25' }]
    expect(
      lembretesDeAgora(vazio({ hora: 21, habitos: [ler, treino], registrosDeHabito: registros }), TODOS),
    ).toEqual([])
  })

  it('o semanal entra quando a meta depende de hoje', () => {
    // Sexta, 30/10: faltam 2 treinos e restam 2 dias (sexta e sábado).
    const registros = [{ habit_id: 'h2', date: '2026-10-26' }]
    const lembretes = lembretesDeAgora(
      vazio({ hoje: '2026-10-30', hora: 21, habitos: [treino], registrosDeHabito: registros }),
      TODOS,
    )
    expect(lembretes[0]?.corpo).toBe('Treinar')
  })
})

it('tipo desligado não gera aviso', () => {
  const lancamentos = [tx({ id: 'm', date: '2026-10-02' })]
  expect(lembretesDeAgora(vazio({ lancamentos }), new Set(['contas']))).toEqual([])
})

describe('o que já foi enviado', () => {
  const lembrete = (id: string): Lembrete => ({
    id,
    tipo: 'contas',
    titulo: id,
    corpo: '',
    rota: '/',
    urgencia: 0,
  })

  it('não repete o que já saiu', () => {
    expect(ids(naoEnviados([lembrete('a'), lembrete('b')], { a: '2026-10-01' }))).toEqual(['b'])
  })

  it('anota o de hoje e esquece o que passou de 90 dias', () => {
    expect(anotarEnviados({ velho: '2026-07-01', recente: '2026-09-01' }, ['novo'], '2026-10-25')).toEqual({
      recente: '2026-09-01',
      novo: '2026-10-25',
    })
  })

  it('mais de três viram dois balões e um resumo', () => {
    const envios = agruparEnvios(['a', 'b', 'c', 'd', 'e'].map(lembrete))
    expect(envios.map((envio) => envio.titulo)).toEqual(['a', 'b', 'Mais 3 avisos'])
    expect(envios[2]!.corpo).toBe('c · d · e')
  })

  it('até três, um balão cada', () => {
    expect(agruparEnvios(['a', 'b', 'c'].map(lembrete))).toHaveLength(3)
  })
})
