/**
 * Somas do tempo de estudo: na semana, no curso, por disciplina.
 *
 * As matérias e as aulas diziam o que foi cursado, mas não quanto tempo se
 * dedicou a cada coisa. É o número que responde "estou estudando o suficiente
 * para a prova de sexta?", e que ninguém lembra de cabeça.
 */

import { addDays, weekStart } from '@/lib/dates'

export interface SessaoLike {
  program_id: string | null
  subject_id: string | null
  date: string
  minutes: number
}

export function minutosEntre(sessoes: SessaoLike[], de: string, ate: string): number {
  return sessoes
    .filter((sessao) => sessao.date >= de && sessao.date <= ate)
    .reduce((soma, sessao) => soma + sessao.minutes, 0)
}

export interface ResumoDoEstudo {
  /** Da semana corrente, de domingo até hoje. */
  semana: number
  /** Da semana anterior inteira: dá a referência para a semana que ainda não acabou. */
  semanaPassada: number
  /** Dos últimos 28 dias, hoje incluído. */
  quatroSemanas: number
  total: number
}

export function resumoDoEstudo(sessoes: SessaoLike[], hoje: string): ResumoDoEstudo {
  const inicio = weekStart(hoje)
  return {
    semana: minutosEntre(sessoes, inicio, hoje),
    semanaPassada: minutosEntre(sessoes, addDays(inicio, -7), addDays(inicio, -1)),
    quatroSemanas: minutosEntre(sessoes, addDays(hoje, -27), hoje),
    total: sessoes.reduce((soma, sessao) => soma + sessao.minutes, 0),
  }
}

export interface MinutosPorDisciplina {
  /** `null` = estudo do curso sem disciplina marcada. */
  subjectId: string | null
  minutos: number
}

/** Da disciplina mais estudada para a menos. */
export function porDisciplina(sessoes: SessaoLike[]): MinutosPorDisciplina[] {
  const soma = new Map<string | null, number>()
  for (const sessao of sessoes) {
    soma.set(sessao.subject_id, (soma.get(sessao.subject_id) ?? 0) + sessao.minutes)
  }
  return [...soma]
    .map(([subjectId, minutos]) => ({ subjectId, minutos }))
    .sort((a, b) => b.minutos - a.minutos)
}
