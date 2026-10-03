/**
 * O que é um evento da agenda.
 *
 * O formato que toda origem — aula, prova, fatura, treino — precisa produzir
 * para caber na mesma lista. Sem regra nenhuma aqui: só a forma e os rótulos.
 */

export type AgendaSource =
  | 'class'
  | 'exam'
  | 'assignment'
  | 'workout'
  | 'bill'
  | 'invoice'
  | 'recurring'
  | 'goal'
  | 'term'
  | 'plan'
  | 'task'

export type AgendaArea = 'health' | 'education' | 'finance' | 'routine'

export interface AgendaEvent {
  id: string
  date: string
  /** HH:MM, ou nulo quando o compromisso é do dia inteiro. */
  time: string | null
  endTime: string | null
  title: string
  detail: string | null
  source: AgendaSource
  area: AgendaArea
  /** Rota que abre o registro de origem. */
  href: string | null
  done: boolean
  /** Valor em centavos, nas origens financeiras. */
  amountCents?: number
}

export const SOURCE_LABELS: Record<AgendaSource, string> = {
  class: 'Aula',
  exam: 'Prova',
  assignment: 'Entrega',
  workout: 'Treino',
  bill: 'Conta',
  invoice: 'Fatura',
  recurring: 'Recorrente',
  goal: 'Meta',
  term: 'Curso',
  plan: 'Plano',
  task: 'A fazer',
}

/**
 * A classe que dá a cor de cada área.
 *
 * Ela redefine `--accent` no elemento, então tudo que estiver dentro — ponto,
 * etiqueta, texto — sai na cor do módulo sem ninguém escrever a cor à mão.
 * Mora aqui, e não na tela do calendário, porque o painel de início pinta os
 * mesmos compromissos: duas tabelas separadas sairiam do lugar na primeira vez
 * que uma cor mudasse.
 */
export const AREA_ACCENT: Record<AgendaArea, string> = {
  health: 'accent-health',
  education: 'accent-education',
  finance: 'accent-finance',
  routine: 'accent-routine',
}
