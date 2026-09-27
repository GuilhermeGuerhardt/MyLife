import { Plus, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/misc'
import { PageHeader } from '@/components/ui/page-header'
import { useAccounts } from '@/data/queries'
import { AccountForm } from '@/features/finance/account-form'

/**
 * A tela do Financeiro antes de existir qualquer conta.
 *
 * É a tela inteira, não um cartão dentro dela: sem conta não há saldo, fluxo
 * nem fatura, e mostrar quatro números zerados em volta de um aviso seria
 * decorar um lugar vazio.
 */
export function PrimeiraConta() {
  const { create } = useAccounts()
  const [abrindo, setAbrindo] = useState(false)

  return (
    <div className="space-y-6">
      <PageHeader title="Financeiro" description="Controle de gastos, orçamento e metas." />
      <Card>
        <EmptyState
          icon={<Wallet className="size-6" />}
          title="Cadastre sua primeira conta"
          description="Pode ser a conta corrente, a carteira ou um cartão de crédito. No cartão, informe fechamento e vencimento — é o que faz cada compra cair na fatura certa."
          action={
            <Button size="sm" onClick={() => setAbrindo(true)}>
              <Plus />
              Nova conta
            </Button>
          }
        />
      </Card>
      {abrindo && (
        <AccountForm
          onClose={() => setAbrindo(false)}
          onSave={async (values) => {
            await create.mutateAsync(values)
            setAbrindo(false)
          }}
        />
      )}
    </div>
  )
}
