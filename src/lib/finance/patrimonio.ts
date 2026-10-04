/**
 * Patrimônio: tudo o que é seu menos o que você deve, mês a mês.
 *
 * O saldo da tela de contas deixa o cartão de fora de propósito, porque ali a
 * pergunta é quanto dá para gastar. Aqui a pergunta é outra: estou mais rico ou
 * mais pobre do que no ano passado? Para essa, a dívida do cartão conta, e o
 * dinheiro parado no investimento também.
 */

import { addMonths, toCompetence, type Competence } from './billing'
import { isCreditCard, type AccountLike, type TransactionLike } from './reports'
import { fimDoMes } from './saldo-por-mes'

export interface ComposicaoDoPatrimonio {
  /** Corrente, poupança e carteira. */
  contasCents: number
  investimentosCents: number
  /** O que os cartões devem, como número positivo. */
  dividaCents: number
  totalCents: number
}

export interface PontoDePatrimonio extends ComposicaoDoPatrimonio {
  competence: Competence
  /** O dia medido: o último do mês, ou hoje no mês corrente. */
  data: string
}

/**
 * O saldo da conta no fim do dia.
 *
 * Na conta comum só conta o que foi pago, como em toda a tela. No cartão o
 * "pago" quer dizer outra coisa: a compra fica em aberto até a fatura ser
 * quitada, mas a dívida nasce no dia da compra. Por isso ali entra tudo, e o
 * pagamento da fatura, que é uma transferência para o cartão, desconta.
 */
function saldoEm(conta: AccountLike, lancamentos: TransactionLike[], data: string): number {
  const cartao = isCreditCard(conta)
  let saldo = conta.initial_balance_cents

  for (const lancamento of lancamentos) {
    if (lancamento.date > data) continue
    if (!cartao && !lancamento.paid) continue

    if (lancamento.kind === 'transfer') {
      if (lancamento.account_id === conta.id) saldo -= lancamento.amount_cents
      if (lancamento.transfer_account_id === conta.id) saldo += lancamento.amount_cents
      continue
    }
    if (lancamento.account_id !== conta.id) continue
    saldo += lancamento.kind === 'income' ? lancamento.amount_cents : -lancamento.amount_cents
  }

  return saldo
}

export function patrimonioNoDia(
  contas: AccountLike[],
  lancamentos: TransactionLike[],
  data: string,
): ComposicaoDoPatrimonio {
  let contasCents = 0
  let investimentosCents = 0
  let dividaCents = 0

  for (const conta of contas) {
    const saldo = saldoEm(conta, lancamentos, data)
    if (isCreditCard(conta)) dividaCents += -saldo
    else if (conta.kind === 'investment') investimentosCents += saldo
    else contasCents += saldo
  }

  return {
    contasCents,
    investimentosCents,
    dividaCents,
    totalCents: contasCents + investimentosCents - dividaCents,
  }
}

/**
 * Um ponto por mês, até o atual, começando no primeiro mês com lançamento.
 *
 * Antes do primeiro lançamento a linha só repetiria o saldo inicial, mês após
 * mês, e o gráfico ganharia um platô que não diz nada.
 */
export function patrimonioPorMes(
  contas: AccountLike[],
  lancamentos: TransactionLike[],
  hoje: string,
  meses = 12,
): PontoDePatrimonio[] {
  const atual = toCompetence(hoje)
  const primeiro = lancamentos.reduce<string | null>(
    (menor, lancamento) => (menor === null || lancamento.date < menor ? lancamento.date : menor),
    null,
  )
  const inicioDaJanela = addMonths(atual, -(meses - 1))
  const inicio =
    primeiro && toCompetence(primeiro) > inicioDaJanela ? toCompetence(primeiro) : inicioDaJanela

  const pontos: PontoDePatrimonio[] = []
  for (let competence = inicio; competence <= atual; competence = addMonths(competence, 1)) {
    const data = competence === atual ? hoje : fimDoMes(competence)
    pontos.push({ competence, data, ...patrimonioNoDia(contas, lancamentos, data) })
  }
  return pontos
}
