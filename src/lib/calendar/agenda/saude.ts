/**
 * Saúde na agenda: o treino que aconteceu e as datas do plano alimentar.
 */

import type { AgendaEvent } from './tipos'

// ---------------------------------------------------------------------------
// Treinos realizados
// ---------------------------------------------------------------------------

export interface SessionLike {
  id: string
  activity_type_id: string
  date: string
  duration_min: number
  calories_estimated: number
}

export function workoutEvents(
  sessions: SessionLike[],
  activityName: (id: string) => string,
): AgendaEvent[] {
  return sessions.map((session) => ({
    id: `session:${session.id}`,
    date: session.date,
    time: null,
    endTime: null,
    title: activityName(session.activity_type_id),
    detail: `${session.duration_min} min · ${Math.round(session.calories_estimated)} kcal`,
    source: 'workout' as const,
    area: 'health' as const,
    href: '/saude/atividades',
    // Treino registrado é treino feito.
    done: true,
  }))
}

// ---------------------------------------------------------------------------
// Saúde: as datas do plano de emagrecimento
// ---------------------------------------------------------------------------

export interface DietPlanLike {
  id: string
  target_weight_kg: number
  target_date: string | null
  /** Data em que o ritmo atual chega ao peso-alvo. */
  estimated_date: string
  status: 'active' | 'archived'
}

/**
 * A data que a pessoa escolheu e a que o ritmo atual promete.
 *
 * As duas juntas são o ponto: a distância entre elas é o atraso do plano, e
 * vê-la no calendário é mais honesto do que só mostrar a meta. Quando coincidem
 * vira um evento só — repetir a mesma data com dois rótulos seria ruído.
 */
export function dietPlanEvents(plans: DietPlanLike[], from: string, to: string): AgendaEvent[] {
  const events: AgendaEvent[] = []
  const inRange = (date: string) => date >= from && date <= to

  for (const plan of plans) {
    if (plan.status !== 'active') continue
    const weight = `${plan.target_weight_kg.toLocaleString('pt-BR')} kg`

    if (plan.target_date && inRange(plan.target_date)) {
      events.push({
        id: `plan-target:${plan.id}`,
        date: plan.target_date,
        time: null,
        endTime: null,
        title: `Meta de peso: ${weight}`,
        detail: plan.estimated_date === plan.target_date ? 'No ritmo' : 'Data escolhida',
        source: 'plan',
        area: 'health',
        href: '/saude/plano',
        done: false,
      })
    }

    if (inRange(plan.estimated_date) && plan.estimated_date !== plan.target_date) {
      events.push({
        id: `plan-estimate:${plan.id}`,
        date: plan.estimated_date,
        time: null,
        endTime: null,
        title: `Previsão: ${weight}`,
        detail: 'No ritmo atual',
        source: 'plan',
        area: 'health',
        href: '/saude/plano',
        done: false,
      })
    }
  }

  return events
}
