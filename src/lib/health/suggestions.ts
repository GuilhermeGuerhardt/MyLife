/**
 * Sugestões contextuais do plano.
 *
 * Regras simples derivadas dos próprios dados do usuário — nada de conselho
 * genérico de revista. Cada sugestão só aparece quando o dado que a justifica
 * existe, e diz por que está aparecendo.
 */

import type { DietPlan } from './diet-plan'

export interface Suggestion {
  id: string
  title: string
  detail: string
  tone: 'accent' | 'positive' | 'warning'
}

export interface SuggestionContext {
  plan: DietPlan
  weightKg: number
  weeklySessions: number
  weeklyMinutes: number
  avgSleepHours: number | null
  proteinToday: number | null
  waterTodayMl: number | null
}

export function buildSuggestions(ctx: SuggestionContext): Suggestion[] {
  const out: Suggestion[] = []
  const { plan } = ctx

  out.push({
    id: 'protein',
    title: `Mire ${plan.macros.proteinG} g de proteína por dia`,
    detail:
      'Em déficit calórico a proteína é o que segura a massa magra — sem ela, boa parte do peso perdido vem de músculo e o metabolismo cai junto. São ~1,8 g por kg de peso.',
    tone: 'accent',
  })

  if (ctx.weeklySessions < 3) {
    out.push({
      id: 'training-frequency',
      title: 'Suba para 3–4 treinos por semana',
      detail: `Você registrou ${ctx.weeklySessions} ${ctx.weeklySessions === 1 ? 'sessão' : 'sessões'} nos últimos 7 dias. Musculação 3×/semana permite emagrecer com um déficit menor — ou seja, comendo mais.`,
      tone: 'warning',
    })
  } else {
    out.push({
      id: 'training-ok',
      title: `${ctx.weeklySessions} treinos na semana`,
      detail: `São ${Math.round(ctx.weeklyMinutes)} minutos acumulados. Mantendo essa frequência, o TDEE usado no plano vem dos seus treinos reais, não de um chute.`,
      tone: 'positive',
    })
  }

  out.push({
    id: 'steps',
    title: 'Meta de 8.000 a 10.000 passos por dia',
    detail:
      'O gasto fora do treino (NEAT) costuma cair sozinho quando se entra em déficit — é o corpo economizando energia. Manter os passos é a forma mais barata de evitar isso.',
    tone: 'accent',
  })

  if (ctx.avgSleepHours !== null && ctx.avgSleepHours < 7) {
    out.push({
      id: 'sleep',
      title: 'Dormir menos de 7h atrapalha o emagrecimento',
      detail: `Sua média está em ${ctx.avgSleepHours.toFixed(1).replace('.', ',')} h. Sono curto aumenta a fome no dia seguinte e desloca a perda de peso da gordura para o músculo.`,
      tone: 'warning',
    })
  }

  const waterTarget = Math.round(ctx.weightKg * 35)
  if (ctx.waterTodayMl === null || ctx.waterTodayMl < waterTarget * 0.6) {
    out.push({
      id: 'water',
      title: `Beba ~${(waterTarget / 1000).toFixed(1).replace('.', ',')} L de água por dia`,
      detail:
        'Cerca de 35 ml por kg. Além do óbvio, boa parte da oscilação diária da balança é água — hidratação constante deixa a leitura mais estável.',
      tone: 'accent',
    })
  }

  if (plan.deficitPercent > 20) {
    out.push({
      id: 'aggressive',
      title: 'Seu déficit está agressivo',
      detail: `Está em ${plan.deficitPercent.toFixed(1).replace('.', ',')}% do gasto. Funciona por algumas semanas, mas a adesão despenca. Considere alongar o prazo e ficar entre 15% e 20%.`,
      tone: 'warning',
    })
  }

  out.push({
    id: 'weigh-in',
    title: 'Pese sempre no mesmo horário',
    detail:
      'De manhã, em jejum, depois do banheiro. O número do dia não importa: o que o app acompanha é a média móvel de 7 dias.',
    tone: 'accent',
  })

  out.push({
    id: 'refeed',
    title: 'Planeje uma refeição livre por semana',
    detail:
      'Dentro do orçamento semanal de calorias, ela reduz a chance do "já estraguei tudo" — que é o que de fato derruba a dieta, não a refeição em si.',
    tone: 'accent',
  })

  return out
}
