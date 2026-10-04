/**
 * Contas e cartões.
 *
 * Esta tela compõe: os blocos moram em `features/finance/accounts`, e o que ela
 * faz aqui é escolher o mês, separar conta de cartão e abrir os formulários —
 * cadastro, quitação de fatura e conferência de extrato.
 */

import { Plus, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/misc'
import { PageHeader } from '@/components/ui/page-header'
import { useAccountChecks, useAccounts } from '@/data/queries'
import type { Account } from '@/data/types'
import { AccountForm } from '@/features/finance/account-form'
import { Cartoes } from '@/features/finance/accounts/cartoes'
import { ListaDeContas } from '@/features/finance/accounts/lista-de-contas'
import { NumerosDasContas } from '@/features/finance/accounts/numeros-das-contas'
import { Patrimonio } from '@/features/finance/accounts/patrimonio'
import { usePayInvoice, useSetTransactionPaid } from '@/features/finance/actions'
import { FormularioDeConferencia } from '@/features/finance/conferencia'
import { PayInvoiceForm } from '@/features/finance/pay-invoice-form'
import { MonthNav } from '@/features/finance/month-nav'
import { useFinance } from '@/features/finance/use-finance'
import { useTransactionEditor } from '@/features/finance/use-transaction-editor'
import { toCompetence, type Competence } from '@/lib/finance/billing'
import { patrimonioPorMes } from '@/lib/finance/patrimonio'
import { invoiceItems } from '@/lib/finance/reports'
import { today } from '@/lib/utils'

export function AccountsPage() {
  const [competence, setCompetence] = useState(toCompetence(today()))
  const finance = useFinance(competence)
  const { create, update } = useAccounts()
  const { data: conferencias, create: conferir } = useAccountChecks()
  const setPaid = useSetTransactionPaid()
  const payInvoice = usePayInvoice()
  const { open: openEditor, editor: transactionEditor } = useTransactionEditor()
  const [editing, setEditing] = useState<Account | null>(null)
  // A quitação guarda qual fatura está sendo paga: é a que vence no mês, que
  // quase nunca é a do mês da tela.
  const [payingCard, setPayingCard] = useState<{ conta: Account; fatura: Competence } | null>(
    null,
  )
  const [conferindo, setConferindo] = useState<Account | null>(null)
  const [adding, setAdding] = useState(false)

  /** O que ainda falta pagar da fatura — é o que o botão de quitar vai cobrir. */
  const emAbertoDoCartao = (cartao: Account, fatura: Competence) =>
    invoiceItems(cartao, fatura, finance.transactions).filter((t) => !t.paid)

  const cartoes = finance.summaries.filter((s) => s.account.kind === 'credit')
  const contas = finance.summaries.filter((s) => s.account.kind !== 'credit')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas e cartões"
        description="Saldo das contas e a fatura de cada cartão, pelo período que ela cobre."
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
            movimento={finance.transactions}
            contas={finance.accounts}
            categoriaPorId={finance.categoryById}
            onEditar={setEditing}
            onQuitar={(conta, fatura) => setPayingCard({ conta, fatura })}
            onEditarLancamento={openEditor}
            onMarcarPago={(transaction, pago) => void setPaid(transaction, pago)}
          />

          {/* No fim, depois do que se usa todo dia: é consulta, não ação. Com as
              arquivadas, porque a conta encerrada teve dinheiro nos meses em que
              existia, e tirá-la criaria um degrau falso na linha. */}
          <Patrimonio
            pontos={patrimonioPorMes(finance.allAccounts, finance.transactions, today())}
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
            // Mudar o fechamento não exige remanejar nada: a fatura é calculada
            // na hora, pela janela de datas que ela cobre.
            if (editing) await update.mutateAsync({ id: editing.id, patch: values })
            else await create.mutateAsync(values)
            setAdding(false)
            setEditing(null)
          }}
        />
      )}

      {payingCard && (
        <PayInvoiceForm
          card={payingCard.conta}
          competence={payingCard.fatura}
          amountCents={emAbertoDoCartao(payingCard.conta, payingCard.fatura).reduce(
            (total, t) => total + (t.kind === 'income' ? -t.amount_cents : t.amount_cents),
            0,
          )}
          count={emAbertoDoCartao(payingCard.conta, payingCard.fatura).length}
          accounts={finance.accounts.filter((a) => a.kind !== 'credit')}
          defaultDate={today()}
          onClose={() => setPayingCard(null)}
          onConfirm={async (fromAccountId, date, valorCents) => {
            await payInvoice(payingCard.conta, payingCard.fatura, fromAccountId, date, valorCents)
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

      {transactionEditor}
    </div>
  )
}
