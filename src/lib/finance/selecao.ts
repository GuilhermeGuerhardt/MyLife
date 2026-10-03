/**
 * Lançamentos marcados na lista: quanto somam e no que uma ação em massa toca.
 *
 * A ação em massa tem de obedecer às mesmas regras da linha sozinha. Se o
 * caminho em lote fosse mais permissivo que o individual, a regra do cartão
 * virava enfeite — bastava marcar duas compras em vez de uma para contorná-la.
 */

import type { AccountKind } from './reports'

export interface LancamentoSelecionavel {
  id: string
  account_id: string
  kind: 'income' | 'expense' | 'transfer'
  amount_cents: number
  paid: boolean
  installment_group_id?: string | null
  installment_total?: number | null
}

/** O que a regra do pagamento precisa saber da conta. */
export interface ContaDoLancamento {
  kind: AccountKind
}

export interface SomaDaSelecao {
  quantidade: number
  /** Sempre positivo: o sinal vem do tipo. */
  cents: number
}

export interface ResumoDaSelecao {
  quantidade: number
  despesas: SomaDaSelecao
  receitas: SomaDaSelecao
  transferencias: SomaDaSelecao
  /**
   * Receitas menos despesas. Transferência fica de fora: ela só muda o dinheiro
   * de conta, e somá-la faria o saldo de uma seleção mista não dizer nada.
   */
  saldoCents: number
  /** Quantos são parcela de uma compra parcelada — apagar uma não apaga as outras. */
  parcelas: number
}

export function resumoDaSelecao(transactions: readonly LancamentoSelecionavel[]): ResumoDaSelecao {
  const resumo: ResumoDaSelecao = {
    quantidade: transactions.length,
    despesas: { quantidade: 0, cents: 0 },
    receitas: { quantidade: 0, cents: 0 },
    transferencias: { quantidade: 0, cents: 0 },
    saldoCents: 0,
    parcelas: 0,
  }

  for (const t of transactions) {
    const soma =
      t.kind === 'expense' ? resumo.despesas : t.kind === 'income' ? resumo.receitas : resumo.transferencias
    soma.quantidade++
    soma.cents += t.amount_cents
    if (t.installment_group_id && (t.installment_total ?? 0) > 1) resumo.parcelas++
  }

  resumo.saldoCents = resumo.receitas.cents - resumo.despesas.cents
  return resumo
}

/**
 * Compra no cartão ainda em aberto: ela espera a fatura, não um pagamento seu.
 */
export function aguardaFatura(
  transaction: Pick<LancamentoSelecionavel, 'paid'>,
  account: ContaDoLancamento | undefined,
): boolean {
  return account?.kind === 'credit' && !transaction.paid
}

/**
 * Se o pagamento deste lançamento pode ser marcado ou desmarcado à mão.
 *
 * Compra no cartão em aberto não se marca como paga: quem paga é a fatura, e
 * deixar marcar permitia quitar meia fatura sem nenhum dinheiro sair da conta.
 */
export function podeMarcarPagamento(
  transaction: Pick<LancamentoSelecionavel, 'paid'>,
  account: ContaDoLancamento | undefined,
): boolean {
  return !aguardaFatura(transaction, account)
}

/**
 * Divide a seleção entre o que a ação vai gravar e o que a regra barra.
 *
 * Quem já está no estado pedido não entra em lista nenhuma: não há o que
 * gravar, e contá-lo como "ignorado" faria a tela reclamar de algo que deu
 * certo.
 */
export function separarParaPagamento<T extends LancamentoSelecionavel>(
  transactions: readonly T[],
  accountById: ReadonlyMap<string, ContaDoLancamento>,
  paid: boolean,
): { aplicar: T[]; ignorados: T[] } {
  const aplicar: T[] = []
  const ignorados: T[] = []

  for (const t of transactions) {
    if (t.paid === paid) continue
    if (podeMarcarPagamento(t, accountById.get(t.account_id))) aplicar.push(t)
    else ignorados.push(t)
  }

  return { aplicar, ignorados }
}

/**
 * Compras no cartão já pagas: um "não pago" as devolve para a fatura.
 *
 * O caminho de volta não existe. Em aberto, a compra no cartão não se marca
 * como paga nem pela linha nem pelo lote, e quitar de novo uma fatura que já
 * foi paga não tem o que cobrar. Na linha isso custa uma compra; no lote, um
 * "selecionar todos" levava a fatura inteira — por isso o lote pergunta antes.
 */
export function voltamParaAFatura<T extends LancamentoSelecionavel>(
  transactions: readonly T[],
  accountById: ReadonlyMap<string, ContaDoLancamento>,
): T[] {
  return transactions.filter((t) => t.paid && accountById.get(t.account_id)?.kind === 'credit')
}

/**
 * Tira da seleção o que saiu da lista visível.
 *
 * É o que impede apagar o que não se vê: marcar três, filtrar até sobrar um e
 * mandar apagar não pode levar junto os dois que o filtro escondeu.
 *
 * Devolve o mesmo conjunto quando nada sai, para quem guarda isso em estado
 * não renderizar de novo à toa.
 */
export function podarSelecao(
  selecionados: ReadonlySet<string>,
  visiveis: readonly { id: string }[],
): ReadonlySet<string> {
  if (selecionados.size === 0) return selecionados
  const ids = new Set(visiveis.map((t) => t.id))
  const podado = new Set([...selecionados].filter((id) => ids.has(id)))
  return podado.size === selecionados.size ? selecionados : podado
}
