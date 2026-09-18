import { Bookmark, ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useFoods, useMealLogs, useMealPresets } from '@/data/queries'
import { MEAL_SLOTS, type MealLog, type MealPreset, type MealSlot } from '@/data/types'
import { AddFoodModal } from '@/features/health/add-food-modal'
import { DaySummary } from '@/features/health/day-summary'
import { SaveMealDialog } from '@/features/health/meal-presets'
import { useHealthSummary } from '@/features/health/use-health-summary'
import { decimal, integer, longDate, relativeDay } from '@/lib/format'
import { confirmar } from '@/lib/avisos'
import { itensDoDiario, registrosDaRefeicao, scaleMacros, sumMacros } from '@/lib/health/nutrition'
import { addDays, today } from '@/lib/utils'

export function NutritionPage() {
  const [params, setParams] = useSearchParams()
  const [date, setDate] = useState(today())
  const [adding, setAdding] = useState<MealSlot | null>(null)
  const [salvando, setSalvando] = useState<{ slot: MealSlot; label: string } | null>(null)

  const {
    data: foods,
    create: createFood,
    update: updateFood,
    remove: removeFood,
  } = useFoods()
  const { data: logs, create, remove } = useMealLogs()
  const { data: presets, create: criarPreset, remove: removerPreset } = useMealPresets()
  const summary = useHealthSummary()

  // Registro rápido ("comi 150g de arroz") cai aqui já com a busca preenchida.
  const initialQuery = params.get('buscar') ?? ''
  useEffect(() => {
    if (initialQuery) setAdding('lunch')
  }, [initialQuery])

  const dayLogs = logs.filter((log) => log.date === date)
  const totals = sumMacros(dayLogs)

  const plan = summary.activePlan
  const targetKcal = plan?.daily_calories ?? summary.tdee ?? 2000

  async function copyPreviousDay() {
    const previous = logs.filter((log) => log.date === addDays(date, -1))
    for (const log of previous) {
      const { id: _id, created_at: _c, updated_at: _u, user_id: _u2, ...rest } = log
      await create.mutateAsync({ ...rest, date })
    }
  }

  /** Guarda o que já está no prato — sem tela de composição nenhuma. */
  async function salvarRefeicao(slot: MealSlot, nome: string) {
    await criarPreset.mutateAsync({
      name: nome,
      slot,
      items: itensDoDiario(dayLogs.filter((log) => log.slot === slot)),
    })
  }

  /** A refeição salva vira os mesmos registros de quem adiciona um por um. */
  async function usarRefeicao(preset: MealPreset, slot: MealSlot) {
    for (const registro of registrosDaRefeicao(preset.items, foods)) {
      await create.mutateAsync({ date, slot, ...registro })
    }
  }

  async function removerRefeicao(preset: MealPreset) {
    const ok = await confirmar(`Remover a refeição "${preset.name}"?`, { confirmar: 'Remover' })
    if (ok) await removerPreset.mutateAsync(preset.id)
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

        <DayNav date={date} onChange={setDate} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          {MEAL_SLOTS.map((slot) => (
            <MealCard
              key={slot.id}
              label={slot.label}
              items={dayLogs.filter((log) => log.slot === slot.id)}
              onAdd={() => setAdding(slot.id)}
              onRemove={(id) => remove.mutate(id)}
              onSave={() => setSalvando({ slot: slot.id, label: slot.label })}
            />
          ))}

          <Button variant="secondary" size="sm" onClick={() => void copyPreviousDay()}>
            <Copy />
            Copiar o dia anterior
          </Button>
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <DaySummary
            totals={totals}
            targetKcal={targetKcal}
            plan={plan}
            showTrainingNote={summary.weekCalories > 0}
          />
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
          onCreateFood={(draft) => createFood.mutateAsync(draft)}
          onUpdateFood={(id, draft) => updateFood.mutateAsync({ id, patch: draft })}
          onRemoveFood={(id) => removeFood.mutateAsync(id)}
          presets={presets}
          onUsePreset={(preset) => usarRefeicao(preset, adding)}
          onRemovePreset={removerRefeicao}
          onClose={() => {
            setAdding(null)
            if (initialQuery) {
              params.delete('buscar')
              setParams(params, { replace: true })
            }
          }}
          onAdd={async (food, quantityG) => {
            await create.mutateAsync({
              date,
              slot: adding,
              food_id: food.id,
              food_name: food.name,
              quantity_g: quantityG,
              ...scaleMacros(food, quantityG),
            })
          }}
        />
      )}

      {salvando && (
        <SaveMealDialog
          sugestao={salvando.label}
          onSave={(nome) => salvarRefeicao(salvando.slot, nome)}
          onClose={() => setSalvando(null)}
        />
      )}
    </div>
  )
}

function DayNav({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(addDays(date, -1))}
        aria-label="Dia anterior"
      >
        <ChevronLeft />
      </Button>
      <div className="min-w-40 text-center">
        <p className="text-fg text-sm font-medium">{longDate(date)}</p>
        <p className="text-fg-subtle text-[11px] first-letter:uppercase">{relativeDay(date)}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(addDays(date, 1))}
        disabled={date >= today()}
        aria-label="Próximo dia"
      >
        <ChevronRight />
      </Button>
    </div>
  )
}

/** Abaixo disso não é uma refeição, é um item solto: salvar não faria sentido. */
const MINIMO_PARA_SALVAR = 2

function MealCard({
  label,
  items,
  onAdd,
  onRemove,
  onSave,
}: {
  label: string
  items: MealLog[]
  onAdd: () => void
  onRemove: (id: string) => void
  onSave: () => void
}) {
  const slotKcal = items.reduce((sum, item) => sum + item.kcal, 0)

  return (
    <Card>
      <CardHeader
        title={label}
        description={items.length ? `${integer(slotKcal)} kcal` : 'Nada registrado'}
        action={
          <div className="flex items-center gap-1">
            {/* Só num prato montado: num cartão com uma banana, seria ruído. */}
            {items.length >= MINIMO_PARA_SALVAR && (
              <Button variant="ghost" size="sm" onClick={onSave}>
                <Bookmark />
                Salvar refeição
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onAdd}>
              <Plus />
              Adicionar
            </Button>
          </div>
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
                  onClick={() => onRemove(item.id)}
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
}
