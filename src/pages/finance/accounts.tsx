/**
 * Contas e cartões.
 *
 * Esta tela compõe: os blocos moram em `features/finance/accounts`, e o que ela
 * faz aqui é escolher o mês, separar conta de cartão e abrir os formulários —
 * cadastro, quitação de fatura e conferência de extrato.
 */

import { CalendarSync, Plus, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/misc'
import { Toast, ToastArea } from '@/components/ui/toast'
import { PageHeader } from '@/components/ui/page-header'
import { useAccountChecks, useAccounts } from '@/data/queries'
import type { Account } from '@/data/types'
import { AccountForm } from '@/features/finance/account-form'
import { Cartoes } from '@/features/finance/accounts/cartoes'
import { ListaDeContas } from '@/features/finance/accounts/lista-de-contas'
import { NumerosDasContas } from '@/features/finance/accounts/numeros-das-contas'
import {
  usePayInvoice,
  useRecalcularFaturas,
  useSetTransactionPaid,
} from '@/features/finance/actions'
import { FormularioDeConferencia } from '@/features/finance/conferencia'
import { PayInvoiceForm } from '@/features/finance/pay-invoice-form'
import { MonthNav } from '@/features/finance/month-nav'
import { useFinance } from '@/features/finance/use-finance'
import { useTransactionEditor } from '@/features/finance/use-transaction-editor'
import { toCompetence } from '@/lib/finance/billing'
import { today } from '@/lib/utils'

export function AccountsPage() {
  const [competence, setCompetence] = useState(toCompetence(today()))
  const finance = useFinance(competence)
  const { create, update } = useAccounts()
  const { data: conferencias, create: conferir } = useAccountChecks()
  const setPaid = useSetTransactionPaid()
  const payInvoice = usePayInvoice()
  const recalcularFaturas = useRecalcularFaturas()
  const { open: openEditor, editor: transactionEditor } = useTransactionEditor()
  const [editing, setEditing] = useState<Account | null>(null)
  const [payingCard, setPayingCard] = useState<Account | null>(null)
  const [conferindo, setConferindo] = useState<Account | null>(null)
  const [adding, setAdding] = useState(false)
  const [remanejadas, setRemanejadas] = useState<number | null>(null)

  /** O que ainda falta pagar da fatura — é o que o botão de quitar vai cobrir. */
  const emAbertoDoCartao = (accountId: string) =>
    finance.monthTransactions.filter((t) => t.account_id === accountId && !t.paid)

  const cartoes = finance.summaries.filter((s) => s.account.kind === 'credit')
  const contas = finance.summaries.filter((s) => s.account.kind !== 'credit')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas e cartões"
        description="Saldo das contas e a fatura de cada cartão, por competência."
        action={
          <div className="flex items-center gap-2">
            <MonthNav competence={competence} onChange={setCompetence} />
            <Button onClick={() => setAdding(true)}>
              <Plus />
              Conta
            </Button>
          </div>
        }
      />

      {finance.summaries.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wallet className="size-6" />}
            title="Nenhuma conta cadastrada"
            action={
              <Button size="sm" onClick={() => setAdding(true)}>
                Cadastrar
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <NumerosDasContas
            saldo={finance.totalBalance}
            faturas={finance.openInvoices}
            competence={competence}
          />

          <ListaDeContas
            contas={contas}
            conferencias={conferencias}
            movimento={finance.transactions}
            onEditar={setEditing}
            onConferir={setConferindo}
          />

          <Cartoes
            cartoes={cartoes}
            competence={competence}
            lancamentosDoMes={finance.monthTransactions}
            contas={finance.accounts}
            categoriaPorId={finance.categoryById}
            onEditar={setEditing}
            onQuitar={setPayingCard}
            onEditarLancamento={openEditor}
            onMarcarPago={(transaction, pago) => void setPaid(transaction, pago)}
          />
        </>
      )}

      {(adding || editing) && (
        <AccountForm
          initial={editing ?? undefined}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
          onSave={async (values) => {
            if (editing) {
              // Mudar o ciclo do cartão não move sozinho o que já foi lançado:
              // a competência de cada compra foi gravada com o fechamento
              // antigo. Sem este passo, corrigir o dia certo deixaria o extrato
              // igualmente errado, e a pessoa ainda acharia que corrigiu.
              const mudouOCiclo =
                editing.kind === 'credit' &&
                values.kind === 'credit' &&
                (editing.closing_day !== values.closing_day ||
                  editing.due_day !== values.due_day)

              await update.mutateAsync({ id: editing.id, patch: values })
              if (mudouOCiclo) setRemanejadas(await recalcularFaturas({ ...editing, ...values }))
            } else {
              await create.mutateAsync(values)
            }
            setAdding(false)
            setEditing(null)
          }}
        />
      )}

      {payingCard && (
        <PayInvoiceForm
          card={payingCard}
          competence={competence}
          amountCents={emAbertoDoCartao(payingCard.id).reduce(
            (total, t) => total + (t.kind === 'income' ? -t.amount_cents : t.amount_cents),
            0,
          )}
          count={emAbertoDoCartao(payingCard.id).length}
          accounts={finance.accounts.filter((a) => a.kind !== 'credit')}
          defaultDate={today()}
          onClose={() => setPayingCard(null)}
          onConfirm={async (fromAccountId, date) => {
            await payInvoice(payingCard, competence, fromAccountId, date)
            setPayingCard(null)
          }}
        />
      )}

      {conferindo && (
        <FormularioDeConferencia
          conta={conferindo}
          transacoes={finance.transactions}
          onClose={() => setConferindo(null)}
          onSave={async (values) => {
            await conferir.mutateAsync({ account_id: conferindo.id, ...values })
            setConferindo(null)
          }}
        />
      )}

      {remanejadas !== null && (
        <ToastArea>
          <Toast
            tone="accent"
            icon={<CalendarSync className="size-4" />}
            title={
              remanejadas === 0
                ? 'Nenhuma compra mudou de fatura'
                : `${remanejadas} ${remanejadas === 1 ? 'compra foi' : 'compras foram'} para a fatura certa`
            }
            description={
              remanejadas === 0
                ? 'As compras deste cartão já estavam na fatura que o novo fechamento indica.'
                : 'O novo fechamento vale para o que já estava lançado, não só para as próximas compras.'
            }
            onClose={() => setRemanejadas(null)}
          />
        </ToastArea>
      )}

      {transactionEditor}
    </div>
  )
}
