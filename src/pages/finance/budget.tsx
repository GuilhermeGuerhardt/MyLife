/**
 * Orçamento e metas.
 *
 * Método envelope: um limite por categoria no mês, e quando o envelope esvazia
 * o gasto daquela categoria acabou. As metas são o outro lado — guardar em vez
 * de gastar — e dividem a tela porque as duas respondem à mesma pergunta no fim
 * do mês: sobrou?
 *
 * Esta tela compõe; os blocos moram em `features/finance/budget`.
 */

import { useState } from 'react'
import { PainelDeNumeros, Stat } from '@/components/ui/misc'
import { PageHeader } from '@/components/ui/page-header'
import { useBudgets, useGoals } from '@/data/queries'
import type { FinancialGoal } from '@/data/types'
import { Envelopes } from '@/features/finance/budget/envelopes'
import {
  FormularioDeAporte,
  FormularioDeEnvelope,
  FormularioDeMeta,
} from '@/features/finance/budget/formularios'
import { Metas } from '@/features/finance/budget/metas'
import { MonthNav } from '@/features/finance/month-nav'
import { sortCategories, useFinance } from '@/features/finance/use-finance'
import { addMonths, competenceLabel, toCompetence } from '@/lib/finance/billing'
import { formatCents } from '@/lib/finance/money'
import { percent } from '@/lib/format'
import { today } from '@/lib/utils'

export function BudgetPage() {
  const [competence, setCompetence] = useState(toCompetence(today()))
  const finance = useFinance(competence)
  const {
    data: allBudgets,
    create: createBudget,
    update: updateBudget,
    remove: removeBudget,
  } = useBudgets()
  const { create: createGoal, update: updateGoal, remove: removeGoal } = useGoals()

  const [addingBudget, setAddingBudget] = useState(false)
  const [addingGoal, setAddingGoal] = useState(false)
  const [contributing, setContributing] = useState<FinancialGoal | null>(null)

  const totalLimit = finance.budgets.reduce((sum, b) => sum + b.progress.limit, 0)
  const totalSpent = finance.budgets.reduce((sum, b) => sum + b.progress.spent, 0)

  const usedCategories = new Set(finance.budgets.map((b) => b.budget.category_id))
  const available = sortCategories(finance.categories, 'expense').filter(
    (c) => !usedCategories.has(c.id),
  )

  /** Copia os limites do mês anterior — orçamento raramente muda de um mês para o outro. */
  async function copiarMesAnterior() {
    const anterior = addMonths(competence, -1)
    for (const budget of allBudgets.filter((b) => b.competence === anterior)) {
      if (usedCategories.has(budget.category_id)) continue
      await createBudget.mutateAsync({
        category_id: budget.category_id,
        competence,
        limit_cents: budget.limit_cents,
      })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orçamento e metas"
        description="Um limite por categoria no mês, no método envelope: quando o envelope esvazia, o gasto daquela categoria acabou."
        action={<MonthNav competence={competence} onChange={setCompetence} />}
      />

      <PainelDeNumeros>
        <Stat label="Orçado" value={formatCents(totalLimit)} hint={competenceLabel(competence)} />
        <Stat
          label="Gasto"
          value={formatCents(totalSpent)}
          tone={totalSpent > totalLimit ? 'negative' : undefined}
          hint={
            totalLimit > 0 ? percent((totalSpent / totalLimit) * 100, 0) + ' do orçado' : undefined
          }
        />
        <Stat
          label="Disponível"
          value={formatCents(totalLimit - totalSpent)}
          tone={totalLimit - totalSpent < 0 ? 'negative' : undefined}
        />
      </PainelDeNumeros>

      <Envelopes
        envelopes={finance.budgets}
        podeCriar={available.length > 0}
        onCriar={() => setAddingBudget(true)}
        onCopiarMesAnterior={() => void copiarMesAnterior()}
        onTrocarLimite={(id, centavos) =>
          updateBudget.mutate({ id, patch: { limit_cents: centavos } })
        }
        onRemover={(id) => removeBudget.mutate(id)}
      />

      <Metas
        metas={finance.goals}
        contaPorId={new Map(finance.allAccounts.map((conta) => [conta.id, conta.name]))}
        onCriar={() => setAddingGoal(true)}
        onAportar={setContributing}
        onRemover={(id) => removeGoal.mutate(id)}
      />

      {addingBudget && (
        <FormularioDeEnvelope
          categories={available}
          onClose={() => setAddingBudget(false)}
          onSave={async (categoryId, limitCents) => {
            await createBudget.mutateAsync({
              category_id: categoryId,
              competence,
              limit_cents: limitCents,
            })
            setAddingBudget(false)
          }}
        />
      )}

      {addingGoal && (
        <FormularioDeMeta
          contas={finance.accounts.filter((conta) => conta.kind !== 'credit')}
          onClose={() => setAddingGoal(false)}
          onSave={async (values) => {
            await createGoal.mutateAsync(values)
            setAddingGoal(false)
          }}
        />
      )}

      {contributing && (
        <FormularioDeAporte
          goal={contributing}
          onClose={() => setContributing(null)}
          onSave={async (cents) => {
            await updateGoal.mutateAsync({
              id: contributing.id,
              patch: {
                current_cents: contributing.current_cents + cents,
                done: contributing.current_cents + cents >= contributing.target_cents,
              },
            })
            setContributing(null)
          }}
        />
      )}
    </div>
  )
}
