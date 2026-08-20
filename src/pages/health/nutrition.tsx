import { ChevronLeft, ChevronRight, Copy, Plus, Search, Star, Trash2, Utensils } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { Badge, EmptyState, Progress, Stat } from '@/components/ui/misc'
import { Modal } from '@/components/ui/modal'
import { useFoods, useMealLogs } from '@/data/queries'
import { MEAL_SLOTS, type Food, type MealSlot } from '@/data/types'
import { useHealthSummary } from '@/features/health/use-health-summary'
import { decimal, integer, longDate, relativeDay } from '@/lib/format'
import { normalize } from '@/lib/quick-add/parser'
import { addDays, today } from '@/lib/utils'

export function NutritionPage() {
  const [params, setParams] = useSearchParams()
  const [date, setDate] = useState(today())
  const [adding, setAdding] = useState<MealSlot | null>(null)

  const { data: foods, update: updateFood } = useFoods()
  const { data: logs, create, remove } = useMealLogs()
  const summary = useHealthSummary()

  // Registro rápido ("comi 150g de arroz") cai aqui já com a busca preenchida.
  const initialQuery = params.get('buscar') ?? ''
  useEffect(() => {
    if (initialQuery) setAdding('lunch')
  }, [initialQuery])

  const dayLogs = logs.filter((log) => log.date === date)
  const totals = dayLogs.reduce(
    (acc, log) => ({
      kcal: acc.kcal + log.kcal,
      protein: acc.protein + log.protein_g,
      carb: acc.carb + log.carb_g,
      fat: acc.fat + log.fat_g,
    }),
    { kcal: 0, protein: 0, carb: 0, fat: 0 },
  )

  const plan = summary.activePlan
  const targetKcal = plan?.daily_calories ?? summary.tdee ?? 2000
  const remaining = targetKcal - totals.kcal

  async function copyPreviousDay() {
    const previous = logs.filter((log) => log.date === addDays(date, -1))
    for (const log of previous) {
      const { id: _id, created_at: _c, updated_at: _u, user_id: _u2, ...rest } = log
      await create.mutateAsync({ ...rest, date })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-fg text-xl font-semibold">Alimentação</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Diário por refeição, com base na tabela TACO.
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setDate(addDays(date, -1))} aria-label="Dia anterior">
            <ChevronLeft />
          </Button>
          <div className="min-w-40 text-center">
            <p className="text-fg text-sm font-medium">{longDate(date)}</p>
            <p className="text-fg-subtle text-[11px] first-letter:uppercase">
              {relativeDay(date)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDate(addDays(date, 1))}
            disabled={date >= today()}
            aria-label="Próximo dia"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {MEAL_SLOTS.map((slot) => {
            const items = dayLogs.filter((log) => log.slot === slot.id)
            const slotKcal = items.reduce((sum, item) => sum + item.kcal, 0)
            return (
              <Card key={slot.id}>
                <CardHeader
                  title={slot.label}
                  description={items.length ? `${integer(slotKcal)} kcal` : 'Nada registrado'}
                  action={
                    <Button variant="ghost" size="sm" onClick={() => setAdding(slot.id)}>
                      <Plus />
                      Adicionar
                    </Button>
                  }
                />
                {items.length > 0 && (
                  <CardContent className="pt-3">
                    <div className="divide-border-base divide-y">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-fg truncate text-sm">{item.food_name}</p>
                            <p className="text-fg-subtle text-[11px]">
                              {integer(item.quantity_g)} g · P {decimal(item.protein_g, 0)} · C{' '}
                              {decimal(item.carb_g, 0)} · G {decimal(item.fat_g, 0)}
                            </p>
                          </div>
                          <span className="text-fg-muted text-xs font-medium">
                            {integer(item.kcal)} kcal
                          </span>
                          <button
                            type="button"
                            onClick={() => remove.mutate(item.id)}
                            className="text-fg-subtle hover:text-negative transition-colors"
                            aria-label="Remover item"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}

          <Button variant="secondary" size="sm" onClick={() => void copyPreviousDay()}>
            <Copy />
            Copiar o dia anterior
          </Button>
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader
              title="Resumo do dia"
              description={plan ? 'Meta vinda do plano ativo' : 'Meta = seu gasto estimado'}
            />
            <CardContent className="space-y-4">
              <Stat
                label={remaining >= 0 ? 'Ainda pode comer' : 'Passou da meta'}
                value={integer(Math.abs(remaining))}
                unit="kcal"
                tone={remaining >= 0 ? undefined : 'negative'}
                hint={`${integer(totals.kcal)} de ${integer(targetKcal)} kcal`}
              />
              <Progress
                value={totals.kcal}
                max={targetKcal}
                tone={totals.kcal > targetKcal ? 'negative' : 'accent'}
              />

              <div className="space-y-3 pt-1">
                <MacroRow
                  label="Proteína"
                  value={totals.protein}
                  target={plan?.protein_g ?? null}
                  tone="accent"
                />
                <MacroRow
                  label="Carboidrato"
                  value={totals.carb}
                  target={plan?.carb_g ?? null}
                  tone="warning"
                />
                <MacroRow
                  label="Gordura"
                  value={totals.fat}
                  target={plan?.fat_g ?? null}
                  tone="positive"
                />
              </div>

              {summary.weekCalories > 0 && (
                <p className="text-fg-subtle border-t pt-3 text-[11px] leading-relaxed">
                  A meta já considera os treinos da semana — não desconte as calorias do treino de
                  novo, isso conta duas vezes.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {adding && (
        <AddFoodModal
          slot={adding}
          foods={foods}
          initialQuery={initialQuery}
          onToggleFavorite={(food) =>
            updateFood.mutate({ id: food.id, patch: { favorite: !food.favorite } })
          }
          onClose={() => {
            setAdding(null)
            if (initialQuery) {
              params.delete('buscar')
              setParams(params, { replace: true })
            }
          }}
          onAdd={async (food, quantityG) => {
            const factor = quantityG / 100
            await create.mutateAsync({
              date,
              slot: adding,
              food_id: food.id,
              food_name: food.name,
              quantity_g: quantityG,
              kcal: Math.round(food.kcal * factor),
              protein_g: Number((food.protein_g * factor).toFixed(1)),
              carb_g: Number((food.carb_g * factor).toFixed(1)),
              fat_g: Number((food.fat_g * factor).toFixed(1)),
            })
          }}
        />
      )}
    </div>
  )
}

function MacroRow({
  label,
  value,
  target,
  tone,
}: {
  label: string
  value: number
  target: number | null
  tone: 'accent' | 'positive' | 'warning'
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-fg-muted">{label}</span>
        <span className="text-fg font-medium">
          {integer(value)}
          {target ? ` / ${integer(target)} g` : ' g'}
        </span>
      </div>
      {target ? <Progress value={value} max={target} tone={tone} /> : null}
    </div>
  )
}

function AddFoodModal({
  slot,
  foods,
  initialQuery,
  onClose,
  onAdd,
  onToggleFavorite,
}: {
  slot: MealSlot
  foods: Food[]
  initialQuery: string
  onClose: () => void
  onAdd: (food: Food, quantityG: number) => Promise<void>
  onToggleFavorite: (food: Food) => void
}) {
  const [query, setQuery] = useState(initialQuery)
  const [selected, setSelected] = useState<Food | null>(null)
  const [quantity, setQuantity] = useState('100')

  const results = useMemo(() => {
    const term = normalize(query)
    const list = term
      ? foods.filter((food) => normalize(food.name).includes(term))
      : [...foods].sort((a, b) => Number(b.favorite) - Number(a.favorite))
    return list.slice(0, 40)
  }, [foods, query])

  const label = MEAL_SLOTS.find((s) => s.id === slot)?.label ?? ''
  const factor = (Number(quantity.replace(',', '.')) || 0) / 100

  return (
    <Modal
      open
      onClose={onClose}
      title={`Adicionar em ${label}`}
      description="Valores por 100 g conforme a TACO. Na Fase 2 entra o scanner de código de barras."
      footer={
        selected ? (
          <>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Voltar
            </Button>
            <Button
              onClick={async () => {
                await onAdd(selected, Number(quantity.replace(',', '.')))
                setSelected(null)
                setQuery('')
              }}
            >
              Adicionar · {integer(selected.kcal * factor)} kcal
            </Button>
          </>
        ) : undefined
      }
    >
      {selected ? (
        <div className="space-y-4">
          <div>
            <p className="text-fg text-sm font-medium">{selected.name}</p>
            <p className="text-fg-subtle text-xs">
              Por 100 g: {integer(selected.kcal)} kcal · P {decimal(selected.protein_g, 1)} · C{' '}
              {decimal(selected.carb_g, 1)} · G {decimal(selected.fat_g, 1)}
            </p>
          </div>

          <Field label="Quantidade" suffix="g">
            <Input
              autoFocus
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Field>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setQuantity(String(selected.serving_g))}
              className="border-border-base bg-surface-2 text-fg-muted hover:text-fg rounded-md border px-2 py-1 text-xs"
            >
              {selected.serving_label} ({selected.serving_g} g)
            </button>
            {[50, 100, 150, 200].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setQuantity(String(amount))}
                className="border-border-base bg-surface-2 text-fg-muted hover:text-fg rounded-md border px-2 py-1 text-xs"
              >
                {amount} g
              </button>
            ))}
          </div>

          <div className="bg-surface-2 grid grid-cols-4 gap-2 rounded-lg px-3 py-2.5 text-center text-xs">
            <Macro label="kcal" value={integer(selected.kcal * factor)} />
            <Macro label="Prot" value={`${decimal(selected.protein_g * factor, 1)} g`} />
            <Macro label="Carb" value={`${decimal(selected.carb_g * factor, 1)} g`} />
            <Macro label="Gord" value={`${decimal(selected.fat_g * factor, 1)} g`} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Field>
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar alimento (arroz, frango, whey...)"
              className="pl-9"
            />
            <Search className="text-fg-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          </Field>

          {results.length === 0 ? (
            <EmptyState
              icon={<Utensils className="size-5" />}
              title="Nada encontrado"
              description="A base local traz os alimentos mais comuns da TACO. A tabela completa e os industrializados via código de barras entram na Fase 2."
            />
          ) : (
            <div className="divide-border-base -mx-1 divide-y">
              {results.map((food) => (
                <div key={food.id} className="flex items-center gap-2 px-1 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(food)
                      setQuantity(String(food.serving_g))
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-fg truncate text-sm">{food.name}</p>
                    <p className="text-fg-subtle text-[11px]">
                      {integer(food.kcal)} kcal/100 g · P {decimal(food.protein_g, 1)} g
                    </p>
                  </button>
                  {food.favorite && <Badge tone="accent">favorito</Badge>}
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(food)}
                    className={
                      food.favorite
                        ? 'text-warning'
                        : 'text-fg-subtle hover:text-warning transition-colors'
                    }
                    aria-label="Favoritar"
                  >
                    <Star className="size-3.5" fill={food.favorite ? 'currentColor' : 'none'} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function Macro({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-fg-subtle text-[10px] tracking-wide uppercase">{label}</p>
      <p className="text-fg text-sm font-medium">{value}</p>
    </div>
  )
}
