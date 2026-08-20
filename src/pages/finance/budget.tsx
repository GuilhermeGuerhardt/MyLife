import { Copy, PiggyBank, Plus, Target, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { Badge, EmptyState, Progress, SectionTitle, Stat } from '@/components/ui/misc'
import { Modal } from '@/components/ui/modal'
import { useBudgets, useGoals } from '@/data/queries'
import type { FinancialGoal } from '@/data/types'
import { MonthNav } from '@/features/finance/shared'
import { sortCategories, useFinance } from '@/features/finance/use-finance'
import { addMonths, competenceLabel, toCompetence } from '@/lib/finance/billing'
import { formatCents, parseAmount } from '@/lib/finance/money'
import { longDate, percent } from '@/lib/format'
import { today } from '@/lib/utils'

export function BudgetPage() {
  const [competence, setCompetence] = useState(toCompetence(today()))
  const finance = useFinance(competence)
  const { data: allBudgets, create: createBudget, update: updateBudget, remove: removeBudget } =
    useBudgets()
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
  async function copyPreviousMonth() {
    const previous = addMonths(competence, -1)
    const source = allBudgets.filter((b) => b.competence === previous)
    for (const budget of source) {
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-fg text-xl font-semibold">Orçamento e metas</h1>
          <p className="text-fg-muted mt-1 max-w-2xl text-sm">
            Um limite por categoria no mês, no método envelope: quando o envelope esvazia, o
            gasto daquela categoria acabou.
          </p>
        </div>
        <MonthNav competence={competence} onChange={setCompetence} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <Stat label="Orçado" value={formatCents(totalLimit)} hint={competenceLabel(competence)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Stat
              label="Gasto"
              value={formatCents(totalSpent)}
              tone={totalSpent > totalLimit ? 'negative' : undefined}
              hint={totalLimit > 0 ? percent((totalSpent / totalLimit) * 100, 0) + ' do orçado' : undefined}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Stat
              label="Disponível"
              value={formatCents(totalLimit - totalSpent)}
              tone={totalLimit - totalSpent < 0 ? 'negative' : 'positive'}
            />
          </CardContent>
        </Card>
      </div>

      <div>
        <SectionTitle
          action={
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => void copyPreviousMonth()}>
                <Copy />
                Copiar mês anterior
              </Button>
              <Button size="sm" onClick={() => setAddingBudget(true)} disabled={!available.length}>
                <Plus />
                Envelope
              </Button>
            </div>
          }
        >
          Envelopes
        </SectionTitle>

        {finance.budgets.length === 0 ? (
          <Card>
            <EmptyState
              icon={<PiggyBank className="size-6" />}
              title="Nenhum envelope neste mês"
              description="Defina um limite para as categorias que costumam fugir do controle — delivery e lazer são os suspeitos de sempre."
              action={
                <Button size="sm" onClick={() => setAddingBudget(true)}>
                  Criar envelope
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {finance.budgets.map(({ budget, category, progress }) => (
              <Card key={budget.id}>
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{category?.icon}</span>
                      <div>
                        <p className="text-fg text-sm font-medium">
                          {category?.name ?? 'Categoria'}
                        </p>
                        <p className="text-fg-subtle text-[11px]">
                          {formatCents(progress.spent)} de {formatCents(progress.limit)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeBudget.mutate(budget.id)}
                      className="text-fg-subtle hover:text-negative transition-colors"
                      aria-label="Remover envelope"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
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

                  <div className="flex items-center justify-between">
                    <Badge
                      tone={
                        progress.status === 'exceeded'
                          ? 'negative'
                          : progress.status === 'warning'
                            ? 'warning'
                            : 'positive'
                      }
                    >
                      {progress.status === 'exceeded'
                        ? `${formatCents(Math.abs(progress.remaining))} acima`
                        : `${formatCents(progress.remaining)} disponíveis`}
                    </Badge>
                    <Input
                      className="h-8 w-28 text-right text-xs"
                      inputMode="decimal"
                      defaultValue={(progress.limit / 100).toFixed(2).replace('.', ',')}
                      aria-label={`Limite de ${category?.name}`}
                      onBlur={(e) =>
                        updateBudget.mutate({
                          id: budget.id,
                          patch: { limit_cents: parseAmount(e.target.value) },
                        })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionTitle
          action={
            <Button size="sm" onClick={() => setAddingGoal(true)}>
              <Plus />
              Meta
            </Button>
          }
        >
          Metas
        </SectionTitle>

        {finance.goals.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Target className="size-6" />}
              title="Nenhuma meta"
              description="Reserva de emergência, viagem, notebook. Com prazo, o app calcula quanto guardar por mês."
              action={
                <Button size="sm" onClick={() => setAddingGoal(true)}>
                  Criar meta
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {finance.goals.map(({ goal, projection }) => (
              <Card key={goal.id}>
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-fg text-sm font-medium">{goal.name}</p>
                      <p className="text-fg-subtle text-[11px]">
                        {formatCents(goal.current_cents)} de {formatCents(goal.target_cents)}
                        {goal.target_date ? ` · até ${longDate(goal.target_date)}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remover a meta "${goal.name}"?`)) removeGoal.mutate(goal.id)
                      }}
                      className="text-fg-subtle hover:text-negative transition-colors"
                      aria-label="Remover meta"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>

                  <Progress
                    value={projection.percent}
                    tone={projection.reached ? 'positive' : 'accent'}
                  />

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
                        <span className="text-fg-muted">
                          Faltam {formatCents(projection.remaining)}
                        </span>
                      )}
                    </div>
                    {!projection.reached && (
                      <Button variant="secondary" size="sm" onClick={() => setContributing(goal)}>
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

      {addingBudget && (
        <BudgetForm
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
        <GoalForm
          onClose={() => setAddingGoal(false)}
          onSave={async (values) => {
            await createGoal.mutateAsync(values)
            setAddingGoal(false)
          }}
        />
      )}

      {contributing && (
        <ContributionForm
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

function BudgetForm({
  categories,
  onClose,
  onSave,
}: {
  categories: Array<{ id: string; name: string; icon: string }>
  onClose: () => void
  onSave: (categoryId: string, limitCents: number) => Promise<void>
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [limit, setLimit] = useState('')

  return (
    <Modal
      open
      onClose={onClose}
      title="Novo envelope"
      description="Um limite de gasto para a categoria neste mês."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!categoryId || !limit}
            onClick={() => void onSave(categoryId, parseAmount(limit))}
          >
            Criar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Categoria">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Limite mensal" suffix="R$">
          <Input
            autoFocus
            inputMode="decimal"
            value={limit}
            placeholder="0,00"
            onChange={(e) => setLimit(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}

function GoalForm({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (values: {
    name: string
    target_cents: number
    current_cents: number
    target_date: string | null
    account_id: null
    color: string
    done: boolean
  }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [current, setCurrent] = useState('')
  const [date, setDate] = useState('')

  return (
    <Modal
      open
      onClose={onClose}
      title="Nova meta"
      description="Com prazo definido, o app calcula o aporte mensal necessário."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!name.trim() || !target}
            onClick={() =>
              void onSave({
                name: name.trim(),
                target_cents: parseAmount(target),
                current_cents: parseAmount(current),
                target_date: date || null,
                account_id: null,
                color: '#22c55e',
                done: false,
              })
            }
          >
            Criar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" className="sm:col-span-2">
          <Input
            autoFocus
            value={name}
            placeholder="Reserva de emergência"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Objetivo" suffix="R$">
          <Input
            inputMode="decimal"
            value={target}
            placeholder="0,00"
            onChange={(e) => setTarget(e.target.value)}
          />
        </Field>
        <Field label="Já guardado" suffix="R$">
          <Input
            inputMode="decimal"
            value={current}
            placeholder="0,00"
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field label="Prazo" className="sm:col-span-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function ContributionForm({
  goal,
  onClose,
  onSave,
}: {
  goal: FinancialGoal
  onClose: () => void
  onSave: (cents: number) => Promise<void>
}) {
  const [amount, setAmount] = useState('')

  return (
    <Modal
      open
      onClose={onClose}
      title={`Aportar em ${goal.name}`}
      description={`Faltam ${formatCents(Math.max(goal.target_cents - goal.current_cents, 0))}.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!amount} onClick={() => void onSave(parseAmount(amount))}>
            Aportar
          </Button>
        </>
      }
    >
      <Field label="Valor" suffix="R$">
        <Input
          autoFocus
          inputMode="decimal"
          value={amount}
          placeholder="0,00"
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
    </Modal>
  )
}
