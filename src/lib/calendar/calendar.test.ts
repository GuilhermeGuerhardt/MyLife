import { describe, expect, it } from 'vitest'
import {
  assessmentEvents,
  billEvents,
  classEvents,
  deadlineEvents,
  dietPlanEvents,
  goalEvents,
  invoiceEvents,
  programEvents,
  monthRange,
  recurringEvents,
  sortAgenda,
  upcoming,
  workoutEvents,
  type AgendaEvent,
} from './agenda'
import { toIcs } from './ics'

const subject = {
  id: 's1',
  program_id: 'p1',
  name: 'Cálculo II',
  status: 'doing',
  weekday: 2, // terça
  start_time: '19:00',
  end_time: '20:40',
  room: 'B12',
}

describe('aulas', () => {
  it('projeta a grade semanal em todas as terças do intervalo', () => {
    // 2026-03-15 é domingo; as terças são 17, 24 e 31.
    const events = classEvents([subject], '2026-03-15', '2026-03-31')
    expect(events.map((e) => e.date)).toEqual(['2026-03-17', '2026-03-24', '2026-03-31'])
    expect(events[0]).toMatchObject({ time: '19:00', endTime: '20:40', detail: 'Sala B12' })
  })

  it('ignora disciplinas que não estão sendo cursadas', () => {
    const done = { ...subject, id: 's2', status: 'done' }
    expect(classEvents([done], '2026-03-15', '2026-03-31')).toEqual([])
  })

  it('ignora disciplinas sem dia da semana cadastrado', () => {
    const noDay = { ...subject, id: 's3', weekday: null }
    expect(classEvents([noDay], '2026-03-15', '2026-03-31')).toEqual([])
  })
})

describe('provas e entregas', () => {
  const nameOf = (id: string | null) => (id === 's1' ? 'Cálculo II' : null)

  it('classifica prova, trabalho e entrega', () => {
    const events = deadlineEvents(
      [
        {
          id: 'd1',
          title: 'P1',
          kind: 'prova',
          date: '2026-03-20',
          done: false,
          program_id: 'p1',
          subject_id: 's1',
          notes: null,
        },
        {
          id: 'd2',
          title: 'Relatório',
          kind: 'trabalho',
          date: '2026-03-22',
          done: false,
          program_id: 'p1',
          subject_id: null,
          notes: 'PDF no portal',
        },
      ],
      nameOf,
    )
    expect(events[0]).toMatchObject({ source: 'exam', detail: 'Cálculo II' })
    expect(events[1]).toMatchObject({ source: 'assignment', detail: 'PDF no portal' })
  })

  it('avaliação com nota lançada some da agenda', () => {
    const lookup = () => ({ name: 'Cálculo II', program_id: 'p1' })
    const events = assessmentEvents(
      [
        { id: 'a1', subject_id: 's1', name: 'P1', date: '2026-03-20', grade: 8 },
        { id: 'a2', subject_id: 's1', name: 'P2', date: '2026-04-20', grade: null },
        { id: 'a3', subject_id: 's1', name: 'P3', date: null, grade: null },
      ],
      lookup,
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ date: '2026-04-20', title: 'P2 · Cálculo II' })
  })
})

describe('treinos', () => {
  it('entram já concluídos: sessão registrada é sessão feita', () => {
    const events = workoutEvents(
      [
        {
          id: 'w1',
          activity_type_id: 'act1',
          date: '2026-03-16',
          duration_min: 45,
          calories_estimated: 471.4,
        },
      ],
      () => 'Natação',
    )
    expect(events[0]).toMatchObject({
      title: 'Natação',
      detail: '45 min · 471 kcal',
      done: true,
      area: 'health',
    })
  })
})

describe('financeiro na agenda', () => {
  const card = { id: 'c1', name: 'Crédito Azul', kind: 'credit', closing_day: 28, due_day: 5 }
  const checking = { id: 'a1', name: 'Itaú', kind: 'checking', closing_day: null, due_day: null }

  it('compra no cartão não vira conta a pagar — quem vence é a fatura', () => {
    const transactions = [
      {
        id: 't1',
        account_id: 'c1',
        kind: 'expense' as const,
        amount_cents: 5000,
        date: '2026-03-10',
        description: 'Mercado',
        paid: false,
      },
      {
        id: 't2',
        account_id: 'a1',
        kind: 'expense' as const,
        amount_cents: 12000,
        date: '2026-03-12',
        description: 'Luz',
        paid: false,
      },
    ]
    const bills = billEvents(transactions, [card, checking], '2026-03-01', '2026-03-31')
    expect(bills.map((b) => b.title)).toEqual(['Luz'])
  })

  it('despesa já paga sai da agenda', () => {
    const paid = [
      {
        id: 't3',
        account_id: 'a1',
        kind: 'expense' as const,
        amount_cents: 9900,
        date: '2026-03-12',
        description: 'Internet',
        paid: true,
      },
    ]
    expect(billEvents(paid, [checking], '2026-03-01', '2026-03-31')).toEqual([])
  })

  it('a fatura vence no mês seguinte ao fechamento e soma o período certo', () => {
    const transactions = [
      // Fecha 28/02, vence 05/03.
      {
        id: 't4',
        account_id: 'c1',
        kind: 'expense' as const,
        amount_cents: 10000,
        date: '2026-02-10',
        description: 'Tênis',
        paid: false,
      },
      // Já é da fatura seguinte: comprou depois do fechamento.
      {
        id: 't5',
        account_id: 'c1',
        kind: 'expense' as const,
        amount_cents: 3000,
        date: '2026-03-01',
        description: 'Padaria',
        paid: false,
      },
    ]
    const invoices = invoiceEvents([card], transactions, '2026-03-01', '2026-03-31')
    expect(invoices).toHaveLength(1)
    expect(invoices[0]).toMatchObject({
      date: '2026-03-05',
      amountCents: 10000,
      title: 'Fatura Crédito Azul',
    })
  })

  it('fatura zerada não polui o calendário', () => {
    expect(invoiceEvents([card], [], '2026-03-01', '2026-03-31')).toEqual([])
  })

  it('projeta recorrentes mês a mês respeitando início e fim', () => {
    const events = recurringEvents(
      [
        {
          id: 'r1',
          description: 'Aluguel',
          kind: 'expense',
          amount_cents: 150000,
          day_of_month: 10,
          start_date: '2026-02-10',
          end_date: '2026-04-10',
          active: true,
        },
      ],
      '2026-03-01',
      '2026-05-31',
    )
    expect(events.map((e) => e.date)).toEqual(['2026-03-10', '2026-04-10'])
  })

  it('recorrente no dia 31 cai no último dia dos meses curtos', () => {
    const events = recurringEvents(
      [
        {
          id: 'r2',
          description: 'Assinatura',
          kind: 'expense',
          amount_cents: 3990,
          day_of_month: 31,
          start_date: '2026-01-01',
          end_date: null,
          active: true,
        },
      ],
      '2026-02-01',
      '2026-02-28',
    )
    expect(events.map((e) => e.date)).toEqual(['2026-02-28'])
  })
})

describe('ordenação e próximos', () => {
  const events: AgendaEvent[] = [
    {
      id: '1',
      date: '2026-03-17',
      time: '19:00',
      endTime: null,
      title: 'Aula',
      detail: null,
      source: 'class',
      area: 'education',
      href: null,
      done: false,
    },
    {
      id: '2',
      date: '2026-03-17',
      time: null,
      endTime: null,
      title: 'Prova',
      detail: null,
      source: 'exam',
      area: 'education',
      href: null,
      done: false,
    },
    {
      id: '3',
      date: '2026-03-16',
      time: null,
      endTime: null,
      title: 'Corrida',
      detail: null,
      source: 'workout',
      area: 'health',
      href: null,
      done: true,
    },
  ]

  it('o dia inteiro vem antes do que tem hora marcada', () => {
    const sorted = sortAgenda(events)
    expect(sorted.map((e) => e.id)).toEqual(['3', '2', '1'])
  })

  it('os próximos ignoram o passado e o que já foi feito', () => {
    const next = upcoming(events, '2026-03-17')
    expect(next.map((e) => e.id)).toEqual(['2', '1'])
  })

  it('o intervalo do mês começa no domingo e termina no sábado', () => {
    const range = monthRange('2026-03')
    expect(range.from).toBe('2026-03-01') // 1º de março de 2026 é domingo
    expect(range.to).toBe('2026-04-04')
  })
})

describe('export .ics', () => {
  const events: AgendaEvent[] = [
    {
      id: 'class:s1:2026-03-17',
      date: '2026-03-17',
      time: '19:00',
      endTime: '20:40',
      title: 'Cálculo II',
      detail: 'Sala B12',
      source: 'class',
      area: 'education',
      href: null,
      done: false,
    },
    {
      id: 'invoice:c1:2026-03',
      date: '2026-03-05',
      time: null,
      endTime: null,
      title: 'Fatura Crédito Azul; vence hoje',
      detail: 'Fechou em 2026-02-28',
      source: 'invoice',
      area: 'finance',
      href: null,
      done: false,
      amountCents: 10000,
    },
  ]

  const ics = toIcs(events)

  it('abre e fecha o calendário com CRLF', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('evento com hora usa horário flutuante, sem Z nem TZID', () => {
    expect(ics).toContain('DTSTART:20260317T190000')
    expect(ics).toContain('DTEND:20260317T204000')
    expect(ics).not.toContain('DTSTART:20260317T190000Z')
  })

  it('evento de dia inteiro termina no dia seguinte, porque DTEND é exclusivo', () => {
    expect(ics).toContain('DTSTART;VALUE=DATE:20260305')
    expect(ics).toContain('DTEND;VALUE=DATE:20260306')
  })

  it('escapa os caracteres reservados do formato', () => {
    expect(ics).toContain('SUMMARY:Fatura Crédito Azul\\; vence hoje')
  })

  it('cada evento vira um VEVENT com UID estável', () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics).toContain('UID:class:s1:2026-03-17@life.app')
  })

  it('dobra linhas longas em 75 octetos sem cortar acento no meio', () => {
    const long: AgendaEvent = {
      ...events[0]!,
      id: 'long',
      title: 'Introdução à Análise de Séries Temporais Aplicadas à Economia Brasileira Contemporânea',
    }
    const folded = toIcs([long])
    const lines = folded.split('\r\n')
    const encoder = new TextEncoder()
    expect(lines.every((line) => encoder.encode(line).length <= 75)).toBe(true)
    // Desdobrar devolve o texto original.
    expect(folded.replace(/\r\n /g, '')).toContain(long.title)
  })
})


describe('metas financeiras na agenda', () => {
  const goal = {
    id: 'g1',
    name: 'Reserva de emergência',
    target_cents: 1_000_000,
    current_cents: 250_000,
    target_date: '2026-09-15',
    done: false,
  }

  it('mostra a data-alvo com o que ainda falta', () => {
    const [event] = goalEvents([goal], '2026-09-01', '2026-09-30')
    expect(event).toMatchObject({
      date: '2026-09-15',
      title: 'Meta: Reserva de emergência',
      source: 'goal',
      area: 'finance',
      done: false,
      amountCents: 750_000,
    })
  })

  it('ignora meta sem prazo', () => {
    expect(goalEvents([{ ...goal, target_date: null }], '2026-01-01', '2026-12-31')).toEqual([])
  })

  it('meta alcançada aparece riscada e sem valor pendente', () => {
    const [event] = goalEvents(
      [{ ...goal, current_cents: goal.target_cents }],
      '2026-09-01',
      '2026-09-30',
    )
    expect(event!.done).toBe(true)
    expect(event!.amountCents).toBeUndefined()
  })
})

describe('cursos e faculdade na agenda', () => {
  const program = {
    id: 'p9',
    name: 'Análise e Desenvolvimento de Sistemas',
    track: 'academic' as const,
    status: 'active',
    start_date: '2026-02-10',
    expected_end: '2026-12-18',
  }

  it('marca início e término previsto', () => {
    const events = programEvents([program], '2026-01-01', '2026-12-31')
    expect(events.map((event) => [event.date, event.detail])).toEqual([
      ['2026-02-10', 'Início'],
      ['2026-12-18', 'Término previsto'],
    ])
    expect(events[0]!.href).toBe('/faculdade/p9')
  })

  it('curso livre aponta para a outra rota', () => {
    const [event] = programEvents(
      [{ ...program, track: 'course' }],
      '2026-02-01',
      '2026-02-28',
    )
    expect(event!.href).toBe('/cursos/p9')
  })

  it('curso abandonado não vira compromisso', () => {
    expect(programEvents([{ ...program, status: 'dropped' }], '2026-01-01', '2026-12-31')).toEqual([])
  })

  it('respeita o intervalo pedido', () => {
    const events = programEvents([program], '2026-02-01', '2026-02-28')
    expect(events).toHaveLength(1)
    expect(events[0]!.detail).toBe('Início')
  })
})

describe('plano de saúde na agenda', () => {
  const plan = {
    id: 'd1',
    target_weight_kg: 78.5,
    target_date: '2026-11-01',
    estimated_date: '2026-12-20',
    status: 'active' as const,
  }

  it('mostra a data escolhida e a que o ritmo promete', () => {
    const events = dietPlanEvents([plan], '2026-01-01', '2026-12-31')
    expect(events.map((event) => [event.date, event.title])).toEqual([
      ['2026-11-01', 'Meta de peso: 78,5 kg'],
      ['2026-12-20', 'Previsão: 78,5 kg'],
    ])
    expect(events.every((event) => event.area === 'health')).toBe(true)
  })

  it('não repete a data quando o plano está em dia', () => {
    const events = dietPlanEvents(
      [{ ...plan, estimated_date: plan.target_date! }],
      '2026-01-01',
      '2026-12-31',
    )
    expect(events).toHaveLength(1)
    expect(events[0]!.detail).toBe('No ritmo')
  })

  it('plano arquivado fica fora', () => {
    expect(dietPlanEvents([{ ...plan, status: 'archived' }], '2026-01-01', '2026-12-31')).toEqual([])
  })
})
