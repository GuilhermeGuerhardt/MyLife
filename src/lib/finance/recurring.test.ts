import { describe, expect, it } from 'vitest'
import {
  occurrenceDate,
  repeatEndDate,
  repeatTotal,
  pendingBalance,
  pendingOccurrences,
  type MaterializedLike,
  type RecurringLike,
} from './recurring'

function rule(over: Partial<RecurringLike> = {}): RecurringLike {
  return {
    id: 'r1',
    description: 'Aluguel',
    account_id: 'acc',
    category_id: 'cat',
    kind: 'expense',
    amount_cents: 180000,
    day_of_month: 5,
    start_date: '2026-01-01',
    end_date: null,
    active: true,
    ...over,
  }
}

describe('occurrenceDate', () => {
  it('cai no dia do mês da regra', () => {
    expect(occurrenceDate(rule(), '2026-08')).toBe('2026-08-05')
  })

  it('encolhe para o último dia quando o mês é mais curto', () => {
    expect(occurrenceDate(rule({ day_of_month: 31 }), '2026-02')).toBe('2026-02-28')
    expect(occurrenceDate(rule({ day_of_month: 31 }), '2026-04')).toBe('2026-04-30')
  })

  it('ignora competência anterior ao início', () => {
    expect(occurrenceDate(rule({ start_date: '2026-03-10' }), '2026-02')).toBeNull()
  })

  it('vale no próprio mês de início quando o dia já passou do começo', () => {
    expect(occurrenceDate(rule({ start_date: '2026-03-01' }), '2026-03')).toBe('2026-03-05')
  })

  it('não vale no mês de início se a regra cai antes da data de início', () => {
    expect(occurrenceDate(rule({ start_date: '2026-03-10' }), '2026-03')).toBeNull()
  })

  it('para depois do fim', () => {
    expect(occurrenceDate(rule({ end_date: '2026-07-31' }), '2026-08')).toBeNull()
    expect(occurrenceDate(rule({ end_date: '2026-08-31' }), '2026-08')).toBe('2026-08-05')
  })

  it('regra inativa não gera nada', () => {
    expect(occurrenceDate(rule({ active: false }), '2026-08')).toBeNull()
  })
})

describe('pendingOccurrences', () => {
  const aluguel = rule({ id: 'r1', description: 'Aluguel', day_of_month: 5 })
  const internet = rule({ id: 'r2', description: 'Internet', day_of_month: 20 })

  it('lista as que ainda não viraram lançamento, em ordem de data', () => {
    const pendentes = pendingOccurrences([internet, aluguel], '2026-08', [])
    expect(pendentes.map((p) => p.rule.id)).toEqual(['r1', 'r2'])
    expect(pendentes.map((p) => p.date)).toEqual(['2026-08-05', '2026-08-20'])
  })

  it('omite a que já foi materializada no mês', () => {
    const existing: MaterializedLike[] = [{ recurring_id: 'r1', date: '2026-08-05' }]
    const pendentes = pendingOccurrences([aluguel, internet], '2026-08', existing)
    expect(pendentes.map((p) => p.rule.id)).toEqual(['r2'])
  })

  it('materializada num mês não bloqueia o mês seguinte', () => {
    const existing: MaterializedLike[] = [{ recurring_id: 'r1', date: '2026-07-05' }]
    const pendentes = pendingOccurrences([aluguel], '2026-08', existing)
    expect(pendentes.map((p) => p.rule.id)).toEqual(['r1'])
  })

  it('lançamento avulso não conta como materialização', () => {
    const existing: MaterializedLike[] = [{ recurring_id: null, date: '2026-08-05' }]
    expect(pendingOccurrences([aluguel], '2026-08', existing)).toHaveLength(1)
  })

  it('mover o dia dentro do mês não ressuscita a recorrente', () => {
    const existing: MaterializedLike[] = [{ recurring_id: 'r1', date: '2026-08-07' }]
    expect(pendingOccurrences([aluguel], '2026-08', existing)).toHaveLength(0)
  })

  it('assinatura no cartão que cai na fatura seguinte nao reaparece', () => {
    // Compra de 25/08 entra na fatura de setembro: a competência diverge da
    // data, e é a data que manda na deduplicação.
    const assinatura = rule({ id: 'r3', description: 'Streaming', day_of_month: 25 })
    const existing: MaterializedLike[] = [{ recurring_id: 'r3', date: '2026-08-25' }]
    expect(pendingOccurrences([assinatura], '2026-08', existing)).toHaveLength(0)
  })

  it('desempata pela descrição quando caem no mesmo dia', () => {
    const a = rule({ id: 'rb', description: 'Zelador', day_of_month: 5 })
    const b = rule({ id: 'ra', description: 'Academia', day_of_month: 5 })
    const pendentes = pendingOccurrences([a, b], '2026-08', [])
    expect(pendentes.map((p) => p.rule.description)).toEqual(['Academia', 'Zelador'])
  })
})

describe('pendingBalance', () => {
  it('soma receita e desconta despesa', () => {
    const pendentes = pendingOccurrences(
      [
        rule({ id: 'r1', kind: 'expense', amount_cents: 180000 }),
        rule({ id: 'r2', kind: 'income', amount_cents: 742000, day_of_month: 5 }),
      ],
      '2026-08',
      [],
    )
    expect(pendingBalance(pendentes)).toBe(742000 - 180000)
  })

  it('lista vazia soma zero', () => {
    expect(pendingBalance([])).toBe(0)
  })
})

describe('prazo da repetição', () => {
  it('sem fim não tem data final', () => {
    expect(repeatEndDate('2026-09-05', null)).toBeNull()
  })

  it('doze meses termina no décimo segundo, não no décimo terceiro', () => {
    // Setembro é a primeira ocorrência; a última é agosto do ano seguinte.
    expect(repeatEndDate('2026-09-05', 12)).toBe('2027-08-05')
  })

  it('três meses cobre o mês inicial e mais dois', () => {
    expect(repeatEndDate('2026-01-10', 3)).toBe('2026-03-10')
  })

  it('uma vez só termina no próprio dia', () => {
    expect(repeatEndDate('2026-09-05', 1)).toBe('2026-09-05')
  })

  it('encolhe o dia quando o mês final é mais curto', () => {
    // Começar em 31/12 por 3 meses termina em fevereiro, que não tem dia 31.
    expect(repeatEndDate('2025-12-31', 3)).toBe('2026-02-28')
  })

  it('atravessa a virada do ano', () => {
    expect(repeatEndDate('2026-11-15', 4)).toBe('2027-02-15')
  })
})

describe('total do prazo', () => {
  it('multiplica o valor pelos meses', () => {
    expect(repeatTotal(180000, 12)).toBe(2160000)
  })

  it('sem fim não tem total', () => {
    expect(repeatTotal(180000, null)).toBeNull()
  })

  it('prazo zero não tem total', () => {
    expect(repeatTotal(180000, 0)).toBeNull()
  })
})
