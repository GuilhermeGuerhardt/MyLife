/** Widget do financeiro: o mês em entrou, saiu e orçamentos estourando. */

import { ArrowRight, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress, Stat } from '@/components/ui/misc'
import { useFinance } from '@/features/finance/use-finance'
import { currency, decimal, integer } from '@/lib/format'

export function FinanceWidget() {
  const finance = useFinance()
  const overBudget = finance.budgets.filter((item) => item.progress.status !== 'ok')

  return (
    <Card className="accent-finance h-full">
      <CardHeader
        title="Mês no financeiro"
        description={`Saldo de ${currency(finance.totalBalance / 100)}`}
        action={
          <Link to="/financeiro">
            <Button variant="ghost" size="sm">
              <ArrowRight />
            </Button>
          </Link>
        }
      />
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <Stat
            label="Entrou"
            value={currency(finance.flow.income / 100)}
            tone={finance.flow.income > 0 ? 'positive' : undefined}
          />
          <Stat
            label="Saiu"
            value={currency(finance.flow.expense / 100)}
            tone={finance.flow.expense > 0 ? 'negative' : undefined}
            icon={<Wallet className="size-3.5" />}
          />
          <Stat label="Sobrou" value={`${decimal(finance.flow.savingsRate, 1)}%`} />
        </div>

        {overBudget.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            {overBudget.slice(0, 3).map((item) => (
              <div key={item.budget.id}>
                <div className="text-fg-muted mb-1 flex justify-between text-[11px]">
                  <span>{item.category?.name ?? 'Sem categoria'}</span>
                  <span>{integer(item.progress.percent)}%</span>
                </div>
                <Progress
                  value={item.progress.percent}
                  tone={item.progress.status === 'exceeded' ? 'negative' : 'warning'}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
