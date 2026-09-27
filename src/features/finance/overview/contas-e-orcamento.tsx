import { ArrowRight, CreditCard } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, Progress, SectionTitle } from '@/components/ui/misc'
import { CategoryIcon } from '@/features/finance/category-icons'
import type { useFinance } from '@/features/finance/use-finance'
import { competenceLabel, type Competence } from '@/lib/finance/billing'
import { formatCents } from '@/lib/finance/money'
import { percent } from '@/lib/format'

type Financeiro = ReturnType<typeof useFinance>

/**
 * A coluna da direita: onde está o dinheiro e quanto do orçamento já foi.
 *
 * Os dois são resumo com atalho — quem quiser mexer vai para a tela própria,
 * que é o que a seta do título faz.
 */
export function ContasEOrcamento({
  resumos,
  orcamentos,
  competence,
}: {
  resumos: Financeiro['summaries']
  orcamentos: Financeiro['budgets']
  competence: Competence
}) {
  return (
    <div>
      <SectionTitle
        action={
          <Link to="/financeiro/contas">
            <Button variant="ghost" size="sm">
              <ArrowRight />
            </Button>
          </Link>
        }
      >
        Contas
      </SectionTitle>
      <div className="space-y-2">
        {resumos.map((summary) => (
          <Card key={summary.account.id}>
            <CardContent className="flex items-center gap-3 py-3">
              <span
                className="size-8 shrink-0 rounded-lg"
                style={{ background: `${summary.account.color}2a` }}
              >
                <CreditCard
                  className="m-auto size-4 translate-y-2"
                  style={{ color: summary.account.color }}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-fg truncate text-sm font-medium">{summary.account.name}</p>
                <p className="text-fg-subtle text-[11px]">
                  {summary.account.kind === 'credit'
                    ? `Fatura de ${competenceLabel(competence).toLowerCase()}`
                    : (summary.account.bank ?? 'Conta')}
                </p>
              </div>
              <span
                className={
                  summary.account.kind === 'credit'
                    ? 'text-fg text-sm font-medium'
                    : summary.balance < 0
                      ? 'text-negative text-sm font-medium'
                      : 'text-fg text-sm font-medium'
                }
              >
                {formatCents(
                  summary.account.kind === 'credit' ? (summary.invoice ?? 0) : summary.balance,
                )}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {orcamentos.length > 0 && (
        <>
          <SectionTitle
            action={
              <Link to="/financeiro/orcamento">
                <Button variant="ghost" size="sm">
                  <ArrowRight />
                </Button>
              </Link>
            }
          >
            Orçamento
          </SectionTitle>
          <Card>
            <CardContent className="space-y-3">
              {orcamentos.slice(0, 4).map(({ budget, category, progress }) => (
                <div key={budget.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-fg-muted flex min-w-0 items-center gap-1.5 truncate">
                      <CategoryIcon
                        icon={category?.icon}
                        color={category?.color}
                        className="size-3.5 shrink-0"
                      />
                      {category?.name ?? 'Categoria'}
                    </span>
                    <Badge
                      tone={
                        progress.status === 'exceeded'
                          ? 'negative'
                          : progress.status === 'warning'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {percent(progress.percent, 0)}
                    </Badge>
                  </div>
                  <Progress
                    value={progress.percent}
                    tone={
                      progress.status === 'exceeded'
                        ? 'negative'
                        : progress.status === 'warning'
                          ? 'warning'
                          : 'accent'
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
