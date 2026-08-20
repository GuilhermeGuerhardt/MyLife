import { describe, expect, it } from 'vitest'
import {
  categorySpendingByDeadline,
  generateInsights,
  weeklyReview,
} from './insights'
import { buildWeeks, pearson, type WeekStats } from './weeks'

function week(index: number, overrides: Partial<WeekStats> = {}): WeekStats {
  const start = `2026-01-${String(4 + index * 7).padStart(2, '0')}`
  return {
    start,
    end: start,
    workouts: 0,
    workoutMinutes: 0,
    sleepHours: null,
    mood: null,
    energy: null,
    steps: null,
    weightAvg: null,
    weightDelta: null,
    kcalIn: null,
    expenseCents: 0,
    expenseByCategory: new Map(),
    deadlines: 0,
    lessons: 0,
    habitLogs: 0,
    ...overrides,
  }
}

/** Metade das semanas com a condição, metade sem. */
function split(count: number, withIt: Partial<WeekStats>, without: Partial<WeekStats>): WeekStats[] {
  return Array.from({ length: count }, (_, index) =>
    week(index, index % 2 === 0 ? withIt : without),
  )
}

describe('agregação semanal', () => {
  it('separa as semanas no domingo e soma o que caiu em cada uma', () => {
    const weeks = buildWeeks(
      {
        sessions: [
          { date: '2026-03-02', duration_min: 60, calories_estimated: 400 },
          { date: '2026-03-04', duration_min: 45, calories_estimated: 300 },
          { date: '2026-03-09', duration_min: 30, calories_estimated: 200 },
        ],
        metrics: [],
        measurements: [],
        mealLogs: [],
        transactions: [],
        deadlines: [],
        lessons: [],
        habitLogs: [],
      },
      '2026-03-01',
      '2026-03-14',
    )

    expect(weeks.map((w) => w.start)).toEqual(['2026-03-01', '2026-03-08'])
    expect(weeks[0]).toMatchObject({ workouts: 2, workoutMinutes: 105 })
    expect(weeks[1]).toMatchObject({ workouts: 1, workoutMinutes: 30 })
  })

  it('semana sem registro de sono devolve null, não zero', () => {
    const weeks = buildWeeks(
      {
        sessions: [],
        metrics: [{ date: '2026-03-02', sleep_hours: null, mood: 7, energy: null, steps: null }],
        measurements: [],
        mealLogs: [],
        transactions: [],
        deadlines: [],
        lessons: [],
        habitLogs: [],
      },
      '2026-03-01',
      '2026-03-07',
    )

    expect(weeks[0]?.sleepHours).toBeNull()
    expect(weeks[0]?.mood).toBe(7)
  })

  it('as calorias diárias saem dos dias registrados, não dos sete', () => {
    const weeks = buildWeeks(
      {
        sessions: [],
        metrics: [],
        measurements: [],
        mealLogs: [
          { date: '2026-03-02', kcal: 1000 },
          { date: '2026-03-02', kcal: 800 },
          { date: '2026-03-03', kcal: 2000 },
        ],
        transactions: [],
        deadlines: [],
        lessons: [],
        habitLogs: [],
      },
      '2026-03-01',
      '2026-03-07',
    )

    // 3800 kcal em 2 dias com registro = 1900/dia, não 543.
    expect(weeks[0]?.kcalIn).toBe(1900)
  })

  it('a variação de peso compara com a última semana que teve pesagem', () => {
    const weeks = buildWeeks(
      {
        sessions: [],
        metrics: [],
        measurements: [
          { date: '2026-03-02', weight_kg: 85 },
          { date: '2026-03-04', weight_kg: 85 },
          // Semana seguinte sem pesagem nenhuma.
          { date: '2026-03-16', weight_kg: 84 },
        ],
        mealLogs: [],
        transactions: [],
        deadlines: [],
        lessons: [],
        habitLogs: [],
      },
      '2026-03-01',
      '2026-03-21',
    )

    expect(weeks[0]?.weightDelta).toBeNull() // não há semana anterior
    expect(weeks[1]?.weightAvg).toBeNull()
    expect(weeks[2]?.weightDelta).toBe(-1)
  })

  it('só despesas entram no gasto da semana', () => {
    const weeks = buildWeeks(
      {
        sessions: [],
        metrics: [],
        measurements: [],
        mealLogs: [],
        transactions: [
          { date: '2026-03-02', kind: 'expense', amount_cents: 5000, category_id: 'c1' },
          { date: '2026-03-03', kind: 'income', amount_cents: 300000, category_id: 'c2' },
          { date: '2026-03-04', kind: 'transfer', amount_cents: 10000, category_id: null },
        ],
        deadlines: [],
        lessons: [],
        habitLogs: [],
      },
      '2026-03-01',
      '2026-03-07',
    )

    expect(weeks[0]?.expenseCents).toBe(5000)
    expect(weeks[0]?.expenseByCategory.get('c1')).toBe(5000)
  })

  it('aula agendada não conta como semana de prova', () => {
    const weeks = buildWeeks(
      {
        sessions: [],
        metrics: [],
        measurements: [],
        mealLogs: [],
        transactions: [],
        deadlines: [
          { date: '2026-03-03', kind: 'prova' },
          { date: '2026-03-04', kind: 'aula' },
        ],
        lessons: [],
        habitLogs: [],
      },
      '2026-03-01',
      '2026-03-07',
    )

    expect(weeks[0]?.deadlines).toBe(1)
  })
})

describe('correlação', () => {
  it('devolve 1 em relação perfeitamente crescente', () => {
    expect(pearson([[1, 2], [2, 4], [3, 6]])).toBeCloseTo(1, 5)
  })

  it('não correlaciona série constante', () => {
    expect(pearson([[1, 5], [2, 5], [3, 5]])).toBeNull()
  })

  it('exige pelo menos três pontos', () => {
    expect(pearson([[1, 2], [2, 4]])).toBeNull()
  })
})

describe('travas dos insights', () => {
  it('não fala nada com poucas semanas de cada lado', () => {
    const weeks = [
      week(0, { workouts: 4, mood: 9 }),
      week(1, { workouts: 4, mood: 9 }),
      week(2, { workouts: 0, mood: 5 }),
      week(3, { workouts: 0, mood: 5 }),
    ]
    expect(generateInsights(weeks).find((i) => i.id === 'mood-by-training')).toBeUndefined()
  })

  it('ignora diferença pequena demais para ser padrão', () => {
    const weeks = split(8, { workouts: 4, mood: 7 }, { workouts: 1, mood: 6.8 })
    expect(generateInsights(weeks).find((i) => i.id === 'mood-by-training')).toBeUndefined()
  })

  it('semana sem a métrica não entra em nenhum dos grupos', () => {
    const weeks = [
      ...split(8, { workouts: 4, mood: 8 }, { workouts: 1, mood: 6 }),
      week(8, { workouts: 4, mood: null }),
    ]
    const insight = generateInsights(weeks).find((i) => i.id === 'mood-by-training')
    expect(insight?.sample).toBe(8)
  })
})

describe('regras', () => {
  it('relaciona treino e humor usando a mediana da própria pessoa', () => {
    const weeks = split(8, { workouts: 4, mood: 8 }, { workouts: 1, mood: 6 })
    const insight = generateInsights(weeks).find((i) => i.id === 'mood-by-training')
    expect(insight?.text).toContain('humor médio foi 33% maior')
    expect(insight?.strength).toBe('forte')
  })

  it('compara perda de peso em quilos, não em percentual', () => {
    const weeks = split(
      8,
      { sleepHours: 7.5, weightDelta: -0.5 },
      { sleepHours: 6, weightDelta: -0.1 },
    )
    const insight = generateInsights(weeks).find((i) => i.id === 'weight-by-sleep')
    expect(insight?.text).toContain('0,50 kg por semana')
    expect(insight?.text).toContain('0,10 kg')
  })

  it('cala a boca quando dormir mais veio junto de perder menos', () => {
    const weeks = split(
      8,
      { sleepHours: 7.5, weightDelta: -0.1 },
      { sleepHours: 6, weightDelta: -0.5 },
    )
    expect(generateInsights(weeks).find((i) => i.id === 'weight-by-sleep')).toBeUndefined()
  })

  it('vê o gasto subir nas semanas de prova', () => {
    const weeks = split(
      8,
      { deadlines: 1, expenseCents: 60000 },
      { deadlines: 0, expenseCents: 40000 },
    )
    const insight = generateInsights(weeks).find((i) => i.id === 'spending-by-deadline')
    expect(insight?.text).toBe('Seus gastos subiram 50% nas semanas com prova ou entrega marcada.')
  })

  it('aponta a categoria que mais reage à semana de prova', () => {
    const weeks = Array.from({ length: 8 }, (_, index) =>
      index % 2 === 0
        ? week(index, { deadlines: 1, expenseByCategory: new Map([['delivery', 20000]]) })
        : week(index, { deadlines: 0, expenseByCategory: new Map([['delivery', 8000]]) }),
    )
    const insight = categorySpendingByDeadline(weeks, (id) =>
      id === 'delivery' ? 'Delivery' : null,
    )
    expect(insight?.text).toContain('gasto com Delivery foi 150% maior')
  })

  it('exige efeito grande na varredura de categorias', () => {
    const weeks = Array.from({ length: 8 }, (_, index) =>
      index % 2 === 0
        ? week(index, { deadlines: 1, expenseByCategory: new Map([['mercado', 11000]]) })
        : week(index, { deadlines: 0, expenseByCategory: new Map([['mercado', 10000]]) }),
    )
    expect(categorySpendingByDeadline(weeks, () => 'Mercado')).toBeNull()
  })

  it('correlaciona hábitos e humor quando a relação é forte', () => {
    const weeks = [1, 2, 3, 4, 5, 6, 7].map((n) =>
      week(n, { habitLogs: n * 3, mood: 3 + n * 0.8 }),
    )
    const insight = generateInsights(weeks).find((i) => i.id === 'habits-and-mood')
    expect(insight?.text).toContain('melhor tende a ser seu humor')
    expect(insight?.sample).toBe(7)
  })

  it('ordena o mais forte primeiro', () => {
    const weeks = split(
      10,
      { workouts: 4, mood: 9, deadlines: 1, expenseCents: 45000 },
      { workouts: 1, mood: 6, deadlines: 0, expenseCents: 40000 },
    )
    const insights = generateInsights(weeks)
    expect(insights[0]?.strength).toBe('forte')
  })
})

describe('revisão semanal', () => {
  it('compara a última semana com a anterior', () => {
    const weeks = [
      week(0, { workouts: 2, workoutMinutes: 90, expenseCents: 50000, habitLogs: 10 }),
      week(1, { workouts: 4, workoutMinutes: 200, expenseCents: 40000, habitLogs: 18 }),
    ]
    const review = weeklyReview(weeks)
    expect(review.week?.workouts).toBe(4)
    expect(review.metrics.find((m) => m.label === 'Treinos')?.delta).toBe(2)
    expect(review.metrics.find((m) => m.label === 'Gasto')?.delta).toBe(-10000)
  })

  it('a primeira semana não inventa comparação', () => {
    const review = weeklyReview([week(0, { workouts: 3 })])
    expect(review.previous).toBeNull()
    expect(review.metrics.find((m) => m.label === 'Treinos')?.delta).toBeNull()
  })

  it('sem semana nenhuma não quebra', () => {
    expect(weeklyReview([])).toEqual({ week: null, previous: null, metrics: [] })
  })
})
