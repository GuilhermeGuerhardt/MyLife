import { useAccounts, useRecurring, useTransactions } from '@/data/queries'
import type { Account, BaseRow, Transaction, TransactionKind } from '@/data/types'
import {
  buildInstallments,
  competenceFor,
  type CardConfig,
  type Competence,
} from '@/lib/finance/billing'
import { invoiceItems, openInvoiceTotal } from '@/lib/finance/reports'
import type { PendingOccurrence } from '@/lib/finance/recurring'
import { separarParaPagamento } from '@/lib/finance/selecao'
import { uid } from '@/lib/utils'

/** Quando o lançamento é, na verdade, uma regra que se repete todo mês. */
export interface RepeatDraft {
  day_of_month: number
  /** `null` = sem fim. */
  end_date: string | null
}

export interface TransactionDraft {
  account_id: string
  transfer_account_id: string | null
  category_id: string | null
  kind: TransactionKind
  amount_cents: number
  date: string
  description: string
  tags: string[]
  paid: boolean
  installments: number
  /** Presente = não grava lançamento, grava a regra. */
  repeat?: RepeatDraft | null
  notes: string | null
}

export function cardConfig(account: Account | undefined | null): CardConfig | null {
  if (!account || account.kind !== 'credit') return null
  return {
    closingDay: account.closing_day ?? 1,
    dueDay: account.due_day ?? 10,
  }
}

/**
 * Cria o lançamento — e as parcelas, quando houver.
 *
 * A competência não vem da data: numa compra no cartão ela sai do ciclo de
 * fatura, e é isso que faz o gasto do mês bater com o extrato.
 *
 * Devolve a competência em que o lançamento caiu — a da primeira parcela, quando
 * é parcelado — para a tela poder dizer onde ele foi parar. Uma compra feita
 * depois do fechamento entra na fatura do mês seguinte e simplesmente não
 * aparece no mês que está aberto; sem essa resposta, a tela não tinha como
 * contar isso e o lançamento parecia ter sumido. `null` é a regra de
 * recorrência, que não cria lançamento nenhum agora.
 */
export function useCreateTransaction() {
  const { data: accounts } = useAccounts()
  const { create } = useTransactions()
  const { create: createRule } = useRecurring()

  return async function createTransaction(draft: TransactionDraft): Promise<Competence | null> {
    // "Se repete" não cria linha nenhuma no extrato: cria a regra, e ela vira
    // pendente no mês. Lançar sozinho é justamente o que o app evita.
    if (draft.repeat && draft.kind !== 'transfer') {
      await createRule.mutateAsync({
        description: draft.description || 'Recorrente',
        account_id: draft.account_id,
        category_id: draft.category_id,
        kind: draft.kind,
        amount_cents: draft.amount_cents,
        day_of_month: draft.repeat.day_of_month,
        start_date: draft.date,
        end_date: draft.repeat.end_date,
        active: true,
      })
      return null
    }

    const account = accounts.find((a) => a.id === draft.account_id)
    const card = cardConfig(account)
    const base: Omit<Transaction, keyof BaseRow> = {
      account_id: draft.account_id,
      transfer_account_id: draft.transfer_account_id,
      category_id: draft.category_id,
      kind: draft.kind,
      amount_cents: draft.amount_cents,
      date: draft.date,
      competence: competenceFor(draft.date),
      description: draft.description,
      tags: draft.tags,
      paid: draft.paid,
      installment_group_id: null,
      installment_n: null,
      installment_total: null,
      recurring_id: null,
      invoice_competence: null,
      notes: draft.notes,
    }

    if (draft.installments <= 1 || !card) {
      await create.mutateAsync(base)
      return base.competence
    }

    const groupId = uid()
    const plan = buildInstallments(draft.amount_cents, draft.installments, draft.date, card)

    for (const installment of plan) {
      await create.mutateAsync({
        ...base,
        amount_cents: installment.amountCents,
        date: installment.date,
        competence: installment.competence,
        installment_group_id: groupId,
        installment_n: installment.number,
        installment_total: installment.total,
        // Só a parcela da fatura corrente pode já estar paga; as futuras não.
        paid: false,
      })
    }

    return plan[0]!.competence
  }
}

/** Remove um lançamento e, se ele for parcelado, todas as parcelas do grupo. */
export function useRemoveTransaction() {
  const { data: transactions, remove } = useTransactions()

  return async function removeTransaction(
    transaction: Transaction,
    mode: 'single' | 'group' = 'single',
  ): Promise<void> {
    if (mode === 'group' && transaction.installment_group_id) {
      const group = transactions.filter(
        (t) => t.installment_group_id === transaction.installment_group_id,
      )
      for (const item of group) await remove.mutateAsync(item.id)
      return
    }
    await remove.mutateAsync(transaction.id)
  }
}

/**
 * Edita um lançamento existente.
 *
 * A competência é recalculada em vez de preservada: mudar a data — ou trocar a
 * conta por um cartão — muda o mês do lançamento, e deixar a competência
 * velha faria o mês parar de bater com o extrato.
 *
 * O parcelamento fica de fora. Alterar o número de parcelas significa refazer o
 * grupo inteiro, o que é outra operação, não uma edição.
 */
export function useUpdateTransaction() {
  const { update } = useTransactions()

  return async function updateTransaction(
    transaction: Transaction,
    draft: TransactionDraft,
  ): Promise<void> {
    await update.mutateAsync({
      id: transaction.id,
      patch: {
        account_id: draft.account_id,
        transfer_account_id: draft.transfer_account_id,
        category_id: draft.category_id,
        kind: draft.kind,
        amount_cents: draft.amount_cents,
        date: draft.date,
        competence: competenceFor(draft.date),
        description: draft.description,
        tags: draft.tags,
        paid: draft.paid,
        notes: draft.notes,
      },
    })
  }
}

/**
 * Marca ou desmarca o pagamento.
 *
 * Numa compra parcelada vale só para a parcela tocada: as outras continuam
 * previstas, que é como a fatura funciona de fato.
 */
export function useSetTransactionPaid() {
  const { update } = useTransactions()

  return async function setPaid(transaction: Transaction, paid: boolean): Promise<void> {
    if (transaction.paid === paid) return
    await update.mutateAsync({ id: transaction.id, patch: { paid } })
  }
}

/**
 * Marca ou desmarca o pagamento de vários lançamentos de uma vez.
 *
 * Passa pela mesma regra da linha: a compra no cartão em aberto fica de fora e
 * volta em `ignorados`, para a tela contar o que não foi feito em vez de
 * deixar a pessoa achar que a fatura foi quitada.
 *
 * As contas vêm todas, arquivadas inclusive: uma compra antiga num cartão já
 * arquivado continua sendo compra no cartão.
 */
export function useSetTransactionsPaid() {
  const { data: accounts } = useAccounts()
  const { updateMany } = useTransactions()

  return async function setPaidMany(
    transactions: Transaction[],
    paid: boolean,
  ): Promise<{ aplicados: number; ignorados: Transaction[] }> {
    const accountById = new Map(accounts.map((a) => [a.id, a]))
    const { aplicar, ignorados } = separarParaPagamento(transactions, accountById, paid)
    await updateMany(aplicar.map((t) => ({ id: t.id, patch: { paid } })))
    return { aplicados: aplicar.length, ignorados }
  }
}

/**
 * Apaga exatamente os lançamentos recebidos.
 *
 * Diferente da exclusão pelo editor, aqui uma parcela leva só ela mesma: quem
 * marca linha a linha está escolhendo linhas, e apagar em silêncio as outras
 * parcelas da compra — que nem estavam na tela — seria apagar o que não foi
 * marcado.
 */
export function useRemoveTransactions() {
  const { removeMany } = useTransactions()

  return async function removeTransactions(transactions: Transaction[]): Promise<void> {
    await removeMany(transactions.map((t) => t.id))
  }
}

/** Converte um lançamento gravado no rascunho que o formulário edita. */
export function toDraft(transaction: Transaction): TransactionDraft {
  return {
    account_id: transaction.account_id,
    transfer_account_id: transaction.transfer_account_id,
    category_id: transaction.category_id,
    kind: transaction.kind,
    amount_cents: transaction.amount_cents,
    date: transaction.date,
    description: transaction.description,
    tags: transaction.tags,
    paid: transaction.paid,
    installments: 1,
    repeat: null,
    notes: transaction.notes,
  }
}

/**
 * Transforma em lançamento as recorrentes que ainda não caíram no mês.
 *
 * Nascem como **previstas**: a regra sabe que a conta existe, não que ela foi
 * paga. Quem paga é a pessoa, com o gesto na linha.
 *
 * A competência sai de `competenceFor`, igual à criação normal — uma assinatura
 * no cartão precisa cair na fatura certa, não no mês do calendário.
 */
export function useMaterializeRecurring() {
  const { create } = useTransactions()

  return async function materialize(pending: PendingOccurrence[]): Promise<number> {
    for (const { rule, date } of pending) {
      await create.mutateAsync({
        account_id: rule.account_id,
        transfer_account_id: null,
        category_id: rule.category_id,
        kind: rule.kind,
        amount_cents: rule.amount_cents,
        date,
        competence: competenceFor(date),
        description: rule.description,
        tags: [],
        paid: false,
        installment_group_id: null,
        installment_n: null,
        installment_total: null,
        recurring_id: rule.id,
        invoice_competence: null,
        notes: null,
      })
    }
    return pending.length
  }
}

/**
 * Quita a fatura do cartão: marca as compras da competência como pagas e
 * registra a transferência que saiu da conta.
 *
 * São duas coisas distintas e as duas importam. Marcar só as compras deixaria o
 * saldo da conta intacto, como se a fatura tivesse sido perdoada; lançar só a
 * transferência deixaria as compras eternamente previstas.
 */
export function usePayInvoice() {
  const { data: transactions, create, update } = useTransactions()

  return async function payInvoice(
    card: Account,
    competence: Competence,
    fromAccountId: string,
    date: string,
    /** Quanto está sendo pago. Vazio = a fatura inteira. */
    valorCents?: number,
  ): Promise<{ paid: number; amountCents: number }> {
    const items = invoiceItems(card, competence, transactions).filter((t) => !t.paid)

    const aberto = openInvoiceTotal(card, competence, transactions)
    // Pagar mais do que se deve não existe: o excedente viraria crédito que o
    // app não sabe representar.
    const amountCents = Math.min(valorCents ?? aberto, aberto)

    // Compra só vira paga quando a fatura fecha em zero. Num pagamento parcial
    // ninguém paga "metade do mercado" — o que foi pago foi a fatura, e o resto
    // dela continua em aberto.
    const quitou = amountCents >= aberto
    if (quitou) {
      for (const item of items) {
        await update.mutateAsync({ id: item.id, patch: { paid: true } })
      }
    }

    if (amountCents > 0) {
      await create.mutateAsync({
        account_id: fromAccountId,
        transfer_account_id: card.id,
        category_id: null,
        kind: 'transfer',
        amount_cents: amountCents,
        date,
        competence: competenceFor(date),
        description: `Pagamento da fatura ${card.name}`,
        tags: [],
        paid: true,
        installment_group_id: null,
        installment_n: null,
        installment_total: null,
        recurring_id: null,
        invoice_competence: competence,
        notes: null,
      })
    }

    return { paid: quitou ? items.length : 0, amountCents }
  }
}
