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
