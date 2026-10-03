import { Plus, Target, Trash2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, Progress, SectionTitle } from '@/components/ui/misc'
import type { FinancialGoal } from '@/data/types'
import type { useFinance } from '@/features/finance/use-finance'
import { confirmar } from '@/lib/avisos'
import { formatCents } from '@/lib/finance/money'
import { longDate } from '@/lib/format'

type Meta = ReturnType<typeof useFinance>['goals'][number]

/**
 * As metas de guardar dinheiro, com o quanto falta por mês.
 *
 * Remover pede confirmação porque uma meta carrega histórico — o valor já
 * guardado mora nela, e apagá-la por engano apaga esse número junto.
 */
export function Metas({
  metas,
  contaPorId,
  onCriar,
  onAportar,
  onRemover,
}: {
  metas: Meta[]
  /** Nome da conta onde o dinheiro da meta está guardado, quando informada. */
  contaPorId: Map<string, string>
  onCriar: () => void
  onAportar: (goal: FinancialGoal) => void
  onRemover: (id: string) => void
}) {
  return (
    <div>
      <SectionTitle
        action={
          <Button size="sm" onClick={onCriar}>
            <Plus />
            Meta
          </Button>
        }
      >
        Metas
      </SectionTitle>

      {metas.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Target className="size-6" />}
            title="Nenhuma meta"
            description="Reserva de emergência, viagem, notebook. Com prazo, o app calcula quanto guardar por mês."
            action={
              <Button size="sm" onClick={onCriar}>
                Criar meta
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {metas.map(({ goal, projection }) => (
            <Card key={goal.id}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-fg text-sm font-medium">{goal.name}</p>
                    <p className="text-fg-subtle text-xs">
                      {formatCents(goal.current_cents)} de {formatCents(goal.target_cents)}
                      {goal.target_date ? ` · até ${longDate(goal.target_date)}` : ''}
                    </p>
                    {goal.account_id && contaPorId.has(goal.account_id) && (
                      <p className="text-fg-subtle mt-0.5 flex items-center gap-1 text-xs">
                        <Wallet className="size-3" />
                        {contaPorId.get(goal.account_id)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void confirmar(`Remover a meta "${goal.name}"?`, {
                        confirmar: 'Remover',
                      }).then((ok) => {
                        if (ok) onRemover(goal.id)
                      })
                    }}
                    className="text-fg-subtle hover:text-negative transition-colors"
                    aria-label="Remover meta"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                <Progress value={projection.percent} tone={projection.reached ? 'positive' : 'accent'} />

                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs">
                    {projection.reached ? (
                      <span className="text-positive font-medium">Meta atingida</span>
                    ) : projection.monthlyNeeded ? (
                      <span className="text-fg-muted">
                        <span className="text-fg font-medium">
                          {formatCents(projection.monthlyNeeded)}
                        </span>{' '}
                        por mês nos próximos {projection.monthsLeft}
                      </span>
                    ) : (
                      <span className="text-fg-muted">Faltam {formatCents(projection.remaining)}</span>
                    )}
                  </div>
                  {!projection.reached && (
                    <Button variant="secondary" size="sm" onClick={() => onAportar(goal)}>
                      Aportar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
