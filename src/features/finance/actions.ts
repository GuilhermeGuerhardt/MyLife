import { useAccounts, useTransactions } from '@/data/queries'
import type { Account, BaseRow, Transaction, TransactionKind } from '@/data/types'
import { buildInstallments, competenceFor, type CardConfig } from '@/lib/finance/billing'
import { uid } from '@/lib/utils'

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
 */
export function useCreateTransaction() {
  const { data: accounts } = useAccounts()
  const { create } = useTransactions()

  return async function createTransaction(draft: TransactionDraft): Promise<void> {
    const account = accounts.find((a) => a.id === draft.account_id)
    const card = cardConfig(account)
    const base: Omit<Transaction, keyof BaseRow> = {
      account_id: draft.account_id,
      transfer_account_id: draft.transfer_account_id,
      category_id: draft.category_id,
      kind: draft.kind,
      amount_cents: draft.amount_cents,
      date: draft.date,
      competence: competenceFor(draft.date, card),
      description: draft.description,
      tags: draft.tags,
      paid: draft.paid,
      installment_group_id: null,
      installment_n: null,
      installment_total: null,
      recurring_id: null,
      notes: draft.notes,
    }

    if (draft.installments <= 1 || !card) {
      await create.mutateAsync(base)
      return
    }

    const groupId = uid()
    const plan = buildInstallments(draft.amount_cents, draft.installments, draft.date, card)

    for (const installment of plan) {
      await create.mutateAsync({
        ...base,
        amount_cents: installment.amountCents,
        competence: installment.competence,
        installment_group_id: groupId,
        installment_n: installment.number,
        installment_total: installment.total,
        // Só a parcela da fatura corrente pode já estar paga; as futuras não.
        paid: false,
      })
    }
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
 * conta por um cartão — muda a fatura em que o gasto cai, e deixar a
 * competência velha faria o mês parar de bater com o extrato.
 *
 * O parcelamento fica de fora. Alterar o número de parcelas significa refazer o
 * grupo inteiro, o que é outra operação, não uma edição.
 */
export function useUpdateTransaction() {
  const { data: accounts } = useAccounts()
  const { update } = useTransactions()

  return async function updateTransaction(
    transaction: Transaction,
    draft: TransactionDraft,
  ): Promise<void> {
    const account = accounts.find((a) => a.id === draft.account_id)
    const card = cardConfig(account)

    await update.mutateAsync({
      id: transaction.id,
      patch: {
        account_id: draft.account_id,
        transfer_account_id: draft.transfer_account_id,
        category_id: draft.category_id,
        kind: draft.kind,
        amount_cents: draft.amount_cents,
        date: draft.date,
        competence: competenceFor(draft.date, card),
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
    notes: transaction.notes,
  }
}
