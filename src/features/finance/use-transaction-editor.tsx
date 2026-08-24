import { useState } from 'react'
import { useAccounts, useCategories } from '@/data/queries'
import type { Transaction } from '@/data/types'
import { confirmar } from '@/lib/avisos'
import { toDraft, useRemoveTransaction, useUpdateTransaction } from './actions'
import { TransactionForm } from './transaction-form'

/**
 * Edição de lançamento, pronta para plugar em qualquer lista.
 *
 * As três telas do financeiro mostram lançamentos e todas precisam do mesmo
 * fluxo — abrir preenchido, salvar, excluir com a pergunta das parcelas. O hook
 * devolve o modal já montado para a tela só escolher onde renderizar.
 */
export function useTransactionEditor() {
  const [editing, setEditing] = useState<Transaction | null>(null)
  // Sem filtrar arquivadas: um lançamento antigo pode estar numa conta que já
  // foi arquivada, e o select precisa conter a conta dele para não trocá-la
  // sozinho ao salvar.
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const updateTransaction = useUpdateTransaction()
  const removeTransaction = useRemoveTransaction()

  async function handleRemove(transaction: Transaction) {
    if (transaction.installment_group_id && transaction.installment_total) {
      const all = await confirmar(
        `Este lançamento é parcelado (${transaction.installment_n}/${transaction.installment_total}).`,
        { confirmar: 'Remover todas as parcelas', cancelar: 'Remover só esta' },
      )
      await removeTransaction(transaction, all ? 'group' : 'single')
      return
    }
    await removeTransaction(transaction)
  }

  const editor = editing ? (
    <TransactionForm
      mode="edit"
      accounts={accounts}
      categories={categories}
      initial={toDraft(editing)}
      onClose={() => setEditing(null)}
      onDelete={() => {
        void handleRemove(editing).then(() => setEditing(null))
      }}
      onSave={async (draft) => {
        await updateTransaction(editing, draft)
        setEditing(null)
      }}
    />
  ) : null

  return { open: setEditing, editor }
}
