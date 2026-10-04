/**
 * Os avisos que o Life manda para o sistema: o que vale interromper a pessoa
 * fora do app.
 *
 * Tudo aqui é derivado na hora, a partir das mesmas regras que as telas usam:
 * a fatura vem de `openInvoices`, a conferência de `needsCheck`, a recorrente de
 * `pendingOccurrences`. Uma regra própria para o aviso acabaria discordando da
 * tela, e o balão diria "vence amanhã" de uma fatura que o app mostra paga.
 *
 * Cada aviso tem um id estável que diz *qual* situação ele anuncia, e não só a
 * coisa: `fatura:<cartão>:<fatura>:perto` e `...:vencida` são dois avisos. Assim
 * a mesma fatura avisa uma vez quando chega perto e outra quando vence, e
 * nunca de novo a cada vez que o app abre.
 */

import { toCompetence } from '@/lib/finance/billing'
import { lastCheck, needsCheck, unchecked, type CheckLike } from '@/lib/finance/conferencia'
import { formatCents } from '@/lib/finance/money'
import { pendingOccurrences, type MaterializedLike, type RecurringLike } from '@/lib/finance/recurring'
import {
  isCreditCard,
  openInvoices,
  type AccountLike,
  type TransactionLike,
} from '@/lib/finance/reports'
import { addDays, daysBetween } from '@/lib/dates'
import { shortDate } from '@/lib/format'
import { habitStatus, type HabitLike } from '@/lib/habits/habits'

export type TipoDeLembrete = 'contas' | 'prazos' | 'recorrentes' | 'conferencia' | 'habitos'

export const TIPOS_DE_LEMBRETE: Array<{ id: TipoDeLembrete; rotulo: string; descricao: string }> = [
  {
    id: 'contas',
    rotulo: 'Contas e faturas',
    descricao: 'Fatura do cartão a 3 dias do vencimento, conta que vence amanhã, e o que venceu.',
  },
  {
    id: 'prazos',
    rotulo: 'Provas, entregas e tarefas',
    descricao: 'Dois dias antes e no próprio dia. Aula não avisa: ela já está na grade.',
  },
  {
    id: 'recorrentes',
    rotulo: 'Recorrentes por confirmar',
    descricao: 'Quando chega o dia de uma recorrente que ainda não virou lançamento.',
  },
  {
    id: 'conferencia',
    rotulo: 'Conferência de extrato',
    descricao: 'Uma vez por mês, para a conta com movimento e mais de 30 dias sem conferir.',
  },
  {
    id: 'habitos',
    rotulo: 'Hábitos do dia',
    descricao: 'À noite, os hábitos que ainda não foram marcados hoje.',
  },
]

export interface Lembrete {
  /** Identifica a situação, não só a coisa: é a chave para não repetir. */
  id: string
  tipo: TipoDeLembrete
  titulo: string
  corpo: string
  /** A tela que resolve o assunto. */
  rota: string
  /** Menor vem primeiro: o que já venceu passa na frente do que vai vencer. */
  urgencia: number
}

export interface ContaLike extends AccountLike {
  name: string
  archived: boolean
}

export interface LancamentoLike extends TransactionLike, MaterializedLike {
  description: string
}

export interface PrazoLike {
  id: string
  title: string
  kind: 'prova' | 'trabalho' | 'entrega' | 'aula'
  date: string
  done: boolean
}

export interface TarefaLike {
  id: string
  title: string
  date: string | null
  done: boolean
}

export interface HabitoLike extends HabitLike {
  id: string
  name: string
  archived: boolean
}

export interface DadosDosLembretes {
  hoje: string
  /** Hora local, 0 a 23. Só os hábitos dependem dela. */
  hora: number
  contas: ContaLike[]
  lancamentos: LancamentoLike[]
  conferencias: CheckLike[]
  recorrentes: RecurringLike[]
  prazos: PrazoLike[]
  tarefas: TarefaLike[]
  habitos: HabitoLike[]
  registrosDeHabito: Array<{ habit_id: string; date: string }>
}

/** A partir de que hora o aviso de hábito faz sentido: antes, o dia ainda está pela metade. */
export const HORA_DOS_HABITOS = 20

/** Atraso mais velho que isto já não é novidade: a tela mostra, o balão não insiste. */
const DIAS_DE_ATRASO_AVISADOS = 7

const ROTULO_DO_PRAZO: Record<PrazoLike['kind'], string> = {
  prova: 'Prova',
  trabalho: 'Trabalho',
  entrega: 'Entrega',
  aula: 'Aula',
}

function quando(dias: number): string {
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  return `em ${dias} dias`
}

function contasEFaturas(dados: DadosDosLembretes): Lembrete[] {
  const { hoje } = dados
  const ativas = dados.contas.filter((conta) => !conta.archived)
  const cartoes = new Set(ativas.filter(isCreditCard).map((conta) => conta.id))
  const lembretes: Lembrete[] = []

  for (const fatura of openInvoices(ativas, dados.lancamentos)) {
    const nome = ativas.find((conta) => conta.id === fatura.accountId)?.name ?? 'cartão'
    const dias = daysBetween(hoje, fatura.dueDate)
    const base = `fatura:${fatura.accountId}:${fatura.competence}`

    if (dias < 0 && dias >= -DIAS_DE_ATRASO_AVISADOS) {
      lembretes.push({
        id: `${base}:vencida`,
        tipo: 'contas',
        titulo: `Fatura do ${nome} venceu`,
        corpo: `${formatCents(fatura.totalCents)} em aberto desde ${shortDate(fatura.dueDate)}.`,
        rota: '/financeiro/contas',
        urgencia: 0,
      })
    } else if (dias >= 0 && dias <= 3) {
      lembretes.push({
        id: `${base}:perto`,
        tipo: 'contas',
        titulo: `Fatura do ${nome} vence ${quando(dias)}`,
        corpo: `${formatCents(fatura.totalCents)} a pagar até ${shortDate(fatura.dueDate)}.`,
        rota: '/financeiro/contas',
        urgencia: 1,
      })
    }
  }

  for (const lancamento of dados.lancamentos) {
    // Compra no cartão não vence sozinha: quem avisa é a fatura, logo acima.
    if (lancamento.paid || lancamento.kind !== 'expense') continue
    if (cartoes.has(lancamento.account_id)) continue

    const dias = daysBetween(hoje, lancamento.date)
    const nome = lancamento.description || 'Conta'

    if (dias < 0 && dias >= -DIAS_DE_ATRASO_AVISADOS) {
      lembretes.push({
        id: `conta:${lancamento.id}:vencida`,
        tipo: 'contas',
        titulo: `${nome} venceu`,
        corpo: `${formatCents(lancamento.amount_cents)}, previsto para ${shortDate(lancamento.date)} e ainda não marcado como pago.`,
        rota: '/financeiro/transacoes',
        urgencia: 0,
      })
    } else if (dias >= 0 && dias <= 1) {
      lembretes.push({
        id: `conta:${lancamento.id}:perto`,
        tipo: 'contas',
        titulo: `${nome} vence ${quando(dias)}`,
        corpo: `${formatCents(lancamento.amount_cents)}.`,
        rota: '/financeiro/transacoes',
        urgencia: 1,
      })
    }
  }

  return lembretes
}

function prazosETarefas(dados: DadosDosLembretes): Lembrete[] {
  const { hoje } = dados
  const lembretes: Lembrete[] = []

  for (const prazo of dados.prazos) {
    if (prazo.done || prazo.kind === 'aula') continue
    const dias = daysBetween(hoje, prazo.date)
    if (dias < 0 || dias > 2) continue

    lembretes.push({
      // Dois momentos: a véspera para se preparar, o dia para não esquecer.
      id: `prazo:${prazo.id}:${dias === 0 ? 'hoje' : 'perto'}`,
      tipo: 'prazos',
      titulo: prazo.title,
      corpo: `${ROTULO_DO_PRAZO[prazo.kind]} ${quando(dias)}, ${shortDate(prazo.date)}.`,
      rota: '/rotina/agenda',
      urgencia: dias === 0 ? 1 : 2,
    })
  }

  for (const tarefa of dados.tarefas) {
    if (tarefa.done || !tarefa.date) continue
    const dias = daysBetween(hoje, tarefa.date)
    if (dias < 0 || dias > 1) continue

    lembretes.push({
      id: `tarefa:${tarefa.id}:${dias === 0 ? 'hoje' : 'perto'}`,
      tipo: 'prazos',
      titulo: tarefa.title,
      corpo: `Tarefa para ${quando(dias)}.`,
      rota: '/rotina/tarefas',
      urgencia: dias === 0 ? 1 : 2,
    })
  }

  return lembretes
}

function recorrentesPendentes(dados: DadosDosLembretes): Lembrete[] {
  const competence = toCompetence(dados.hoje)
  return pendingOccurrences(dados.recorrentes, competence, dados.lancamentos)
    .filter(({ date }) => date <= dados.hoje)
    .map(({ rule, date }) => ({
      id: `recorrente:${rule.id}:${competence}`,
      tipo: 'recorrentes' as const,
      titulo: `${rule.description}: falta lançar`,
      corpo: `${formatCents(rule.amount_cents)}, previsto para ${shortDate(date)}. Confirme em Recorrentes.`,
      rota: '/financeiro/recorrentes',
      urgencia: 2,
    }))
}

function conferenciaDeExtrato(dados: DadosDosLembretes): Lembrete[] {
  const competence = toCompetence(dados.hoje)
  const lembretes: Lembrete[] = []

  for (const conta of dados.contas) {
    if (conta.archived || isCreditCard(conta)) continue
    const ultima = lastCheck(dados.conferencias, conta.id)
    const movimentos = unchecked(dados.lancamentos, conta.id, ultima).length
    if (!needsCheck(ultima, dados.hoje, movimentos)) continue

    lembretes.push({
      // Um por mês: a conferência atrasada continua atrasada amanhã, e o aviso
      // diário viraria ruído que ensina a ignorar os outros.
      id: `conferencia:${conta.id}:${competence}`,
      tipo: 'conferencia',
      titulo: `Conferir o extrato: ${conta.name}`,
      corpo: ultima
        ? `${movimentos} movimento${movimentos === 1 ? '' : 's'} desde a conferência de ${shortDate(ultima.date)}.`
        : `${movimentos} movimento${movimentos === 1 ? '' : 's'} e nenhuma conferência ainda.`,
      rota: '/financeiro/contas',
      urgencia: 3,
    })
  }

  return lembretes
}

function habitosDoDia(dados: DadosDosLembretes): Lembrete[] {
  if (dados.hora < HORA_DOS_HABITOS) return []

  const faltam = dados.habitos
    .filter((habito) => !habito.archived)
    .filter((habito) => {
      const datas = dados.registrosDeHabito
        .filter((registro) => registro.habit_id === habito.id)
        .map((registro) => registro.date)
      const status = habitStatus(habito, datas, dados.hoje)
      if (status.doneToday) return false
      // O semanal só cobra quando a meta da semana depende de hoje.
      return habito.cadence === 'daily' || status.atRisk
    })
    .map((habito) => habito.name)

  if (faltam.length === 0) return []

  const nomes =
    faltam.length <= 3 ? faltam.join(', ') : `${faltam.slice(0, 3).join(', ')} e mais ${faltam.length - 3}`

  return [
    {
      id: `habitos:${dados.hoje}`,
      tipo: 'habitos',
      titulo: faltam.length === 1 ? 'Um hábito por marcar hoje' : `${faltam.length} hábitos por marcar hoje`,
      corpo: nomes,
      rota: '/rotina',
      urgencia: 3,
    },
  ]
}

const POR_TIPO: Record<TipoDeLembrete, (dados: DadosDosLembretes) => Lembrete[]> = {
  contas: contasEFaturas,
  prazos: prazosETarefas,
  recorrentes: recorrentesPendentes,
  conferencia: conferenciaDeExtrato,
  habitos: habitosDoDia,
}

/** Todos os avisos que valem agora, dos tipos ligados, do mais urgente ao menos. */
export function lembretesDeAgora(
  dados: DadosDosLembretes,
  tipos: ReadonlySet<TipoDeLembrete>,
): Lembrete[] {
  return (Object.keys(POR_TIPO) as TipoDeLembrete[])
    .filter((tipo) => tipos.has(tipo))
    .flatMap((tipo) => POR_TIPO[tipo](dados))
    .sort((a, b) => a.urgencia - b.urgencia || a.titulo.localeCompare(b.titulo))
}

/** Id do aviso → dia em que ele saiu. */
export type Enviados = Record<string, string>

/** Por quanto tempo um aviso enviado é lembrado. Depois disso o id já não volta a valer. */
const DIAS_DE_MEMORIA = 90

export function naoEnviados(lembretes: Lembrete[], enviados: Enviados): Lembrete[] {
  return lembretes.filter((lembrete) => !(lembrete.id in enviados))
}

/**
 * Anota o que saiu hoje e esquece o que já é velho.
 *
 * Sem esquecer, a lista cresceria para sempre no armazenamento do navegador,
 * uma linha por conta paga em toda a vida do app.
 */
export function anotarEnviados(enviados: Enviados, ids: string[], hoje: string): Enviados {
  const limite = addDays(hoje, -DIAS_DE_MEMORIA)
  const resultado: Enviados = {}
  for (const [id, dia] of Object.entries(enviados)) {
    if (dia >= limite) resultado[id] = dia
  }
  for (const id of ids) resultado[id] = hoje
  return resultado
}

export interface Envio {
  titulo: string
  corpo: string
  rota: string
}

/**
 * O que de fato vira balão.
 *
 * Mais de três de uma vez viram um resumo: na primeira vez que o aviso é ligado
 * podem existir dez pendências, e dez balões em fila fazem a pessoa desligar
 * tudo no mesmo minuto.
 */
export function agruparEnvios(novos: Lembrete[], maximo = 3): Envio[] {
  if (novos.length <= maximo) {
    return novos.map(({ titulo, corpo, rota }) => ({ titulo, corpo, rota }))
  }

  const individuais = novos.slice(0, maximo - 1)
  const resto = novos.slice(maximo - 1)
  return [
    ...individuais.map(({ titulo, corpo, rota }) => ({ titulo, corpo, rota })),
    {
      titulo: `Mais ${resto.length} avisos`,
      corpo: resto.map((lembrete) => lembrete.titulo).join(' · '),
      rota: resto[0]!.rota,
    },
  ]
}
