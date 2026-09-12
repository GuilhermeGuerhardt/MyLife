/**
 * Catálogo de widgets do dashboard.
 *
 * Cada widget é uma peça independente: sabe buscar o próprio dado e desenhar o
 * próprio cartão. O dashboard só decide quais aparecem e em que ordem — é o
 * que permite ligar, desligar e reordenar sem uma linha de condicional na tela.
 *
 * As consultas repetidas entre widgets não custam nada: o TanStack Query
 * deduplica por chave, então dez widgets pedindo `transactions` fazem uma
 * leitura só.
 *
 * Os componentes ficam em um arquivo por área — este aqui é só a lista, para
 * acrescentar um widget ser uma linha e não uma garimpagem.
 */

import type { ComponentType } from 'react'
import { NextLessonWidget, StudiesWidget } from './education'
import { FinanceWidget } from './finance'
import { CaloriesWidget, DietPlanWidget, WeightWidget, WorkoutsWidget } from './health'
import { AgendaWidget, HabitsWidget, InsightWidget, StreakWidget } from './routine'

export interface WidgetDef {
  id: string
  title: string
  /** Explicação curta, mostrada na tela de personalização. */
  description: string
  /** Colunas ocupadas na grade de 4. */
  span: 1 | 2
  accent: string
  defaultVisible: boolean
  Component: ComponentType
}

export const WIDGETS: WidgetDef[] = [
  {
    id: 'weight',
    title: 'Peso',
    description: 'Média móvel de 7 dias e a tendência do mês.',
    span: 1,
    accent: 'accent-health',
    defaultVisible: true,
    Component: WeightWidget,
  },
  {
    id: 'calories',
    title: 'Calorias restantes',
    description: 'Quanto ainda cabe hoje, pelo alvo do plano.',
    span: 1,
    accent: 'accent-health',
    defaultVisible: true,
    Component: CaloriesWidget,
  },
  {
    id: 'workouts',
    title: 'Treinos da semana',
    description: 'Sessões registradas contra a meta semanal.',
    span: 1,
    accent: 'accent-health',
    defaultVisible: true,
    Component: WorkoutsWidget,
  },
  {
    id: 'streak',
    title: 'Sequência de treino',
    description: 'Dias seguidos com pelo menos uma sessão.',
    span: 1,
    accent: 'accent-routine',
    defaultVisible: true,
    Component: StreakWidget,
  },
  {
    id: 'habits',
    title: 'Hábitos de hoje',
    description: 'Checklist do dia, marcável direto daqui.',
    span: 2,
    accent: 'accent-routine',
    defaultVisible: true,
    Component: HabitsWidget,
  },
  {
    id: 'agenda',
    title: 'Próximos compromissos',
    description: 'Provas, entregas e vencimentos das próximas duas semanas.',
    span: 2,
    accent: 'accent-routine',
    defaultVisible: true,
    Component: AgendaWidget,
  },
  {
    id: 'diet-plan',
    title: 'Plano de emagrecimento',
    description: 'Alvo diário, ritmo e progresso até a meta.',
    span: 2,
    accent: 'accent-health',
    defaultVisible: true,
    Component: DietPlanWidget,
  },
  {
    id: 'studies',
    title: 'Estudos',
    description: 'Faculdade e cursos em andamento, com progresso.',
    span: 2,
    accent: 'accent-education',
    defaultVisible: true,
    Component: StudiesWidget,
  },
  {
    id: 'finance',
    title: 'Mês no financeiro',
    description: 'Entrou, saiu, taxa de poupança e orçamentos estourando.',
    span: 2,
    accent: 'accent-finance',
    defaultVisible: true,
    Component: FinanceWidget,
  },
  {
    id: 'next-lesson',
    title: 'Próxima aula',
    description: 'De onde continuar no curso em andamento.',
    span: 1,
    accent: 'accent-courses',
    defaultVisible: false,
    Component: NextLessonWidget,
  },
  {
    id: 'insight',
    title: 'Padrão da vez',
    description: 'O cruzamento mais forte entre os módulos.',
    span: 2,
    accent: 'accent-routine',
    defaultVisible: false,
    Component: InsightWidget,
  },
]
