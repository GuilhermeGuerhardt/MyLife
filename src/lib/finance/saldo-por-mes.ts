/**
 * O saldo das contas no fim de cada mês: o que foi, para os meses fechados, e o
 * que deve ser, do mês atual em diante.
 *
 * As barras do fluxo de caixa dizem quanto entrou e saiu, mas não respondem à
 * pergunta que vem logo depois: e quanto sobrou na conta? O número existia no
 * painel só para o mês aberto. Aqui ele vira série, para dar para ver se o
 * saldo vem subindo ou descendo.
 */

import { addMonths, dateInCompetence, lastDayOfMonth, toCompetence, type Competence } from './billing'
import { summarizeOpenMonth } from './open-month'
import { pendingOccurrences, type MaterializedLike, type RecurringLike } from './recurring'
import {
  accountBalance,
  invoicesDueIn,
  isCreditCard,
  type AccountLike,
  type TransactionLike,
} from './reports'

export interface PontoDeSaldo {
  competence: Competence
  saldoCents: number
  /** Mês atual ou à frente: o valor é conta do que ainda vai acontecer. */
  previsto: boolean
}

/** O último dia do mês, em AAAA-MM-DD. */
export function fimDoMes(competence: Competence): string {
  return dateInCompetence(competence, lastDayOfMonth(competence))
}

/**
 * Soma das contas no fim do dia, sem cartões.
 *
 * Cartão fica de fora pelo mesmo motivo do saldo da tela: a fatura é dívida, e
 * o dinheiro só sai da conta no dia em que ela é paga, por uma transferência,
 * que já está contada aqui.
 */
export function saldoNoDia(
  contas: AccountLike[],
  lancamentos: TransactionLike[],
  data: string,
): number {
  const ate = lancamentos.filter((lancamento) => lancamento.date <= data)
  return contas
    .filter((conta) => !isCreditCard(conta))
    .reduce((soma, conta) => soma + accountBalance(conta, ate), 0)
}

/**
 * Um ponto por mês pedido.
 *
 * Mês fechado: o saldo no último dia dele, só com o que foi pago. Mês atual: o
 * saldo de hoje mais o que ainda falta acontecer nele. Mês futuro: o previsto
 * do mês anterior mais o que está marcado para ele.
 *
 * `abertoNoMes` vem de quem chama porque já é calculado lá, com recorrentes e
 * faturas (`summarizeOpenMonth`). Refazer a conta aqui criaria uma segunda
 * versão do "falta acontecer", e o gráfico logo discordaria do painel.
 */
export function saldoPorMes(
  contas: AccountLike[],
  lancamentos: TransactionLike[],
  meses: Competence[],
  hoje: string,
  abertoNoMes: (competence: Competence) => number,
): PontoDeSaldo[] {
  const mesAtual = toCompetence(hoje)
  const saldoAtual = contas
    .filter((conta) => !isCreditCard(conta))
    .reduce((soma, conta) => soma + accountBalance(conta, lancamentos), 0)

  // O previsto acumula mês a mês a partir de hoje: o saldo de dezembro depende
  // do que sobrar de novembro, mesmo que novembro não esteja na janela.
  const previstoAte = new Map<Competence, number>()
  const ultimo = meses.reduce((maior, mes) => (mes > maior ? mes : maior), mesAtual)
  let acumulado = saldoAtual
  for (let mes = mesAtual; mes <= ultimo; mes = addMonths(mes, 1)) {
    acumulado += abertoNoMes(mes)
    previstoAte.set(mes, acumulado)
  }

  return meses.map((competence) =>
    competence < mesAtual
      ? {
          competence,
          saldoCents: saldoNoDia(contas, lancamentos, fimDoMes(competence)),
          previsto: false,
        }
      : { competence, saldoCents: previstoAte.get(competence) ?? saldoAtual, previsto: true },
  )
}

/**
 * Quanto o mês ainda vai mexer no saldo: o que falta receber menos o que falta
 * pagar, contando a recorrente não lançada e a fatura que vence nele.
 *
 * É a mesma conta do painel "ainda esse mês", só que para qualquer mês. Se as
 * duas fossem escritas separadas, o ponto de outubro no gráfico e o saldo
 * previsto do painel acabariam mostrando números diferentes.
 */
export function abertoDoMes(
  contas: AccountLike[],
  lancamentos: Array<TransactionLike & MaterializedLike>,
  regras: RecurringLike[],
  competence: Competence,
  hoje: string,
): number {
  const cartoes = new Set(contas.filter(isCreditCard).map((conta) => conta.id))
  return summarizeOpenMonth(
    lancamentos.filter((lancamento) => lancamento.competence === competence),
    pendingOccurrences(regras, competence, lancamentos),
    hoje,
    cartoes,
    invoicesDueIn(contas, lancamentos, competence),
  ).balanceCents
}
