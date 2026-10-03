import { addMonths, dateInCompetence, toCompetence } from '@/lib/finance/billing'
import { collection } from './adapters'
import { TABLES } from './queries'
import type { Account, Transaction } from './types'

/**
 * Põe as compras de cartão no mês em que aconteceram.
 *
 * Até a 0.5.0 a compra no cartão era guardada no mês da **fatura**: a de 24 de
 * setembro, num cartão que fecha dia 20, nascia com competência de outubro.
 * Era defensável no papel e confuso na tela — setembro não mostrava a compra, e
 * outubro mostrava a compra onde se esperava a fatura. Hoje a competência é
 * sempre o mês do fato, e a fatura é calculada pela janela de datas que ela
 * cobre, sem depender de nada gravado.
 *
 * Esta migração arruma o que já estava lançado. Duas coisas acontecem:
 *
 * 1. A competência de toda compra de cartão passa a ser a do mês da data.
 * 2. As parcelas ganham a data do mês delas. Antes as doze parcelas nasciam
 *    todas com a data da compra e eram espalhadas pela competência; agora a
 *    parcela 3 acontece três meses depois, e é a data que diz isso.
 *
 * É idempotente: a parcela 1 não se move, e as outras são sempre recalculadas a
 * partir dela.
 */
export async function migrarCartaoParaOMesDaCompra(): Promise<number> {
  const contas = collection<Account>(TABLES.accounts)
  const lancamentos = collection<Transaction>(TABLES.transactions)

  const cartoes = new Set(
    (await contas.list()).filter((conta) => conta.kind === 'credit').map((conta) => conta.id),
  )
  if (cartoes.size === 0) return 0

  const todos = await lancamentos.list()
  const doCartao = todos.filter((item) => cartoes.has(item.account_id))
  if (doCartao.length === 0) return 0

  // A data da compra é a da primeira parcela: é dela que as outras saem.
  const primeiraDoGrupo = new Map<string, string>()
  for (const item of doCartao) {
    if (!item.installment_group_id) continue
    const atual = primeiraDoGrupo.get(item.installment_group_id)
    if (!atual || item.date < atual) primeiraDoGrupo.set(item.installment_group_id, item.date)
  }

  let mudaram = 0

  for (const item of doCartao) {
    const date = dataDaParcela(item, primeiraDoGrupo)
    const competence = toCompetence(date)
    if (date === item.date && competence === item.competence) continue

    await lancamentos.update(item.id, { date, competence })
    mudaram++
  }

  return mudaram
}

/** A data que a parcela deveria ter: a da compra, mais um mês por parcela. */
function dataDaParcela(item: Transaction, primeiraDoGrupo: Map<string, string>): string {
  const compra = item.installment_group_id
    ? primeiraDoGrupo.get(item.installment_group_id)
    : undefined
  if (!compra || !item.installment_n || item.installment_n <= 1) return item.date

  const dia = Number(compra.slice(8, 10))
  return dateInCompetence(addMonths(toCompetence(compra), item.installment_n - 1), dia)
}
