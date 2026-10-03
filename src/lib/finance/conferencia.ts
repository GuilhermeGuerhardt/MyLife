/**
 * Conferência de extrato: comparar o saldo do app com o do banco.
 *
 * O app só sabe o que foi lançado. Quando o banco mostra outro número, a
 * diferença é sempre a mesma coisa — algo que aconteceu na conta e não entrou
 * aqui. Registrar a conferência marca até onde as contas bateram, para a
 * próxima procura começar daí em vez de recomeçar do primeiro mês.
 */

import { accountBalance, type AccountLike, type TransactionLike } from './reports'

/**
 * Saldo da conta até uma data, inclusive.
 *
 * O extrato do banco é uma fotografia de um dia; comparar com o saldo de hoje
 * acusaria diferença em toda conta que tem lançamento futuro agendado.
 */
export function balanceOn(
  account: AccountLike,
  transactions: TransactionLike[],
  date: string,
): number {
  return accountBalance(
    account,
    transactions.filter((tx) => tx.date <= date),
  )
}

/**
 * `ok` quando bate. `sobrando`: o app tem mais dinheiro que o banco, então
 * falta lançar uma saída. `faltando`: o banco tem mais, falta lançar uma
 * entrada.
 */
export type CheckStatus = 'ok' | 'sobrando' | 'faltando'

export interface CheckResult {
  appCents: number
  bankCents: number
  /** App menos banco. */
  differenceCents: number
  status: CheckStatus
}

export function compareBalances(appCents: number, bankCents: number): CheckResult {
  const differenceCents = appCents - bankCents
  return {
    appCents,
    bankCents,
    differenceCents,
    status: differenceCents === 0 ? 'ok' : differenceCents > 0 ? 'sobrando' : 'faltando',
  }
}

export interface CheckLike {
  account_id: string
  date: string
  balance_cents: number
  difference_cents: number
  created_at: string
}

/**
 * A conferência mais recente da conta.
 *
 * Desempata pelo registro mais novo: conferir duas vezes o mesmo dia é comum —
 * a pessoa lança o que faltava e confere de novo — e vale a última.
 */
export function lastCheck<T extends CheckLike>(checks: T[], accountId: string): T | null {
  return checks
    .filter((check) => check.account_id === accountId)
    .reduce<T | null>((mais, check) => {
      if (!mais) return check
      if (check.date > mais.date) return check
      if (check.date === mais.date && check.created_at > mais.created_at) return check
      return mais
    }, null)
}

/**
 * Movimentos da conta ainda não cobertos pela última conferência.
 *
 * Só o que já foi efetivado: o previsto não está no extrato do banco, e contá-lo
 * faria uma conta recém-conferida anunciar movimento que ninguém pode procurar.
 * A data da conferência também fica de fora, porque ela já entrou no saldo
 * comparado — é o mesmo corte de `balanceOn`. Sem conferência nenhuma, tudo
 * que está efetivado conta.
 */
export function unchecked<T extends TransactionLike>(
  transactions: T[],
  accountId: string,
  check: CheckLike | null,
): T[] {
  return transactions.filter((tx) => {
    if (!tx.paid) return false
    if (tx.account_id !== accountId && tx.transfer_account_id !== accountId) return false
    return check === null || tx.date > check.date
  })
}

/** Quantos dias desde a última conferência. `null` quando nunca houve uma. */
export function daysSinceCheck(check: CheckLike | null, today: string): number | null {
  if (!check) return null
  const dia = 86_400_000
  const diferenca =
    new Date(`${today}T12:00:00`).getTime() - new Date(`${check.date}T12:00:00`).getTime()
  return Math.max(Math.floor(diferenca / dia), 0)
}

/** Depois de um mês sem conferir, a procura por uma diferença já fica longa. */
const DIAS_ATE_LEMBRAR = 30

/**
 * Vale lembrar de conferir esta conta?
 *
 * Só quando há movimento para conferir — cobrar conferência de uma conta parada
 * é ruído, e ruído ensina a ignorar o aviso. Conta nunca conferida entra na
 * conta assim que tem o primeiro lançamento efetivado.
 */
export function needsCheck(
  check: CheckLike | null,
  today: string,
  movimentosDepois: number,
): boolean {
  if (movimentosDepois === 0) return false
  const dias = daysSinceCheck(check, today)
  return dias === null || dias >= DIAS_ATE_LEMBRAR
}
