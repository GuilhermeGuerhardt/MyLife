import { useCategories, useReceivables, useTransactions } from '@/data/queries'
import type { Receivable } from '@/data/types'
import { competenceFor } from '@/lib/finance/billing'
import { normalize } from '@/lib/quick-add/parser'

export type NovoAReceber = Pick<
  Receivable,
  'person' | 'description' | 'amount_cents' | 'date' | 'transaction_id'
>

/**
 * As ações de "a receber": anotar, receber e desfazer.
 *
 * Receber cria uma receita de verdade na conta escolhida. Só marcar o item como
 * recebido deixaria o saldo do app atrás do banco, e a conferência de extrato
 * acusaria uma diferença que ninguém saberia explicar.
 */
export function useAReceber() {
  const { data: itens, create, updateMany, remove } = useReceivables()
  const { create: criarLancamento, remove: removerLancamento } = useTransactions()
  const { data: categorias } = useCategories()

  async function registrar(novo: NovoAReceber) {
    await create.mutateAsync({
      ...novo,
      person: novo.person.trim(),
      received_at: null,
      received_transaction_id: null,
      deleted_at: null,
    })
  }

  /**
   * Recebe um ou vários itens num lançamento só.
   *
   * Vários num só porque é assim que o dinheiro chega: a Ana manda um Pix com
   * tudo o que devia, e o extrato do banco mostra uma entrada, não três.
   */
  async function receber(selecionados: Receivable[], contaId: string, data: string) {
    if (selecionados.length === 0) return
    const total = selecionados.reduce((soma, item) => soma + item.amount_cents, 0)
    const pessoa = selecionados[0]!.person
    const reembolso = categorias.find(
      (categoria) => categoria.kind === 'income' && normalize(categoria.name) === 'reembolso',
    )

    const lancamento = await criarLancamento.mutateAsync({
      account_id: contaId,
      transfer_account_id: null,
      category_id: reembolso?.id ?? null,
      kind: 'income',
      amount_cents: total,
      date: data,
      competence: competenceFor(data),
      description:
        selecionados.length === 1
          ? `Reembolso de ${pessoa}: ${selecionados[0]!.description}`
          : `Reembolso de ${pessoa}`,
      tags: [],
      paid: true,
      installment_group_id: null,
      installment_n: null,
      installment_total: null,
      recurring_id: null,
      invoice_competence: null,
      notes: null,
    })

    await updateMany(
      selecionados.map((item) => ({
        id: item.id,
        patch: { received_at: data, received_transaction_id: lancamento.id },
      })),
    )
  }

  /**
   * Volta o recebimento atrás: apaga a receita e reabre todos os itens que ela
   * pagou. Reabrir só um deixaria a receita somando um dinheiro que, pela tela,
   * ainda não chegou.
   */
  async function desfazer(item: Receivable) {
    const juntos = item.received_transaction_id
      ? itens.filter((outro) => outro.received_transaction_id === item.received_transaction_id)
      : [item]
    if (item.received_transaction_id) await removerLancamento.mutateAsync(item.received_transaction_id)
    await updateMany(
      juntos.map((outro) => ({
        id: outro.id,
        patch: { received_at: null, received_transaction_id: null },
      })),
    )
  }

  return {
    itens,
    registrar,
    receber,
    desfazer,
    apagar: (id: string) => remove.mutateAsync(id),
  }
}
