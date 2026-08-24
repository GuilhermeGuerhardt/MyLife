import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Utensils,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { Badge, EmptyState, Progress, Stat } from '@/components/ui/misc'
import { Modal } from '@/components/ui/modal'
import { useFoods, useMealLogs } from '@/data/queries'
import { MEAL_SLOTS, type BaseRow, type Food, type MealSlot } from '@/data/types'
import { useHealthSummary } from '@/features/health/use-health-summary'
import { decimal, integer, longDate, relativeDay } from '@/lib/format'
import { normalize } from '@/lib/quick-add/parser'
import { addDays, today } from '@/lib/utils'
import { confirmar } from '@/lib/avisos'

export function NutritionPage() {
  const [params, setParams] = useSearchParams()
  const [date, setDate] = useState(today())
  const [adding, setAdding] = useState<MealSlot | null>(null)

  const {
    data: foods,
    create: createFood,
    update: updateFood,
    remove: removeFood,
  } = useFoods()
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
          onCreateFood={(draft) => createFood.mutateAsync(draft)}
          onUpdateFood={(id, draft) => updateFood.mutateAsync({ id, patch: draft })}
          onRemoveFood={(id) => removeFood.mutateAsync(id)}
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

export type FoodDraft = Omit<Food, keyof BaseRow>

/**
 * As três telas do modal.
 *
 * União em vez de dois estados soltos: "escolhendo a quantidade" e "editando o
 * alimento" nunca acontecem ao mesmo tempo, e o tipo impede a combinação.
 */
type View =
  | { kind: 'search' }
  | { kind: 'quantity'; food: Food }
  /** `food` nulo = cadastrando um alimento novo. */
  | { kind: 'form'; food: Food | null }

/** Liga o botão do rodapé ao `<form>`, que fica fora dele no DOM. */
const FORM_ID = 'formulario-alimento'

/** Lê número digitado à brasileira; valor inválido ou negativo vira zero. */
function decimalInput(value: string): number {
  const parsed = Number(value.replace(',', '.').trim())
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/** Calorias implícitas nos macros: 4 kcal por grama de proteína e carboidrato, 9 de gordura. */
function kcalFromMacros(proteinG: number, carbG: number, fatG: number): number {
  return Math.round(proteinG * 4 + carbG * 4 + fatG * 9)
}

function AddFoodModal({
  slot,
  foods,
  initialQuery,
  onClose,
  onAdd,
  onToggleFavorite,
  onCreateFood,
  onUpdateFood,
  onRemoveFood,
}: {
  slot: MealSlot
  foods: Food[]
  initialQuery: string
  onClose: () => void
  onAdd: (food: Food, quantityG: number) => Promise<void>
  onToggleFavorite: (food: Food) => void
  onCreateFood: (draft: FoodDraft) => Promise<Food>
  onUpdateFood: (id: string, draft: FoodDraft) => Promise<Food>
  onRemoveFood: (id: string) => Promise<void>
}) {
  const [query, setQuery] = useState(initialQuery)
  const [view, setView] = useState<View>({ kind: 'search' })
  const [quantity, setQuantity] = useState('100')

  const results = useMemo(() => {
    const term = normalize(query)
    const list = term
      ? foods.filter(
          (food) =>
            normalize(food.name).includes(term) ||
            (food.brand !== null && normalize(food.brand).includes(term)),
        )
      : // Sem busca, primeiro os favoritos e depois os seus: a lista da TACO é
        // longa e o que você mesmo cadastrou é o que você mais repete.
        [...foods].sort(
          (a, b) =>
            Number(b.favorite) - Number(a.favorite) ||
            Number(b.source === 'custom') - Number(a.source === 'custom'),
        )
    return list.slice(0, 40)
  }, [foods, query])

  const label = MEAL_SLOTS.find((s) => s.id === slot)?.label ?? ''
  const factor = decimalInput(quantity) / 100

  /** Vai para a quantidade já com a porção usual preenchida. */
  const escolher = (food: Food) => {
    setQuantity(String(food.serving_g))
    setView({ kind: 'quantity', food })
  }

  const salvarAlimento = async (draft: FoodDraft) => {
    const editando = view.kind === 'form' ? view.food : null
    const food = editando ? await onUpdateFood(editando.id, draft) : await onCreateFood(draft)
    // Quem cadastrou está no meio de registrar uma refeição: cair direto na
    // quantidade poupa ter que procurar na lista o que acabou de criar.
    escolher(food)
  }

  const removerAlimento = async (food: Food) => {
    const aviso =
      `Remover "${food.name}" da sua lista de alimentos?\n\n` +
      'O que você já registrou no diário continua lá — cada registro guarda a própria cópia dos valores.'
    if (!(await confirmar(aviso, { confirmar: 'Remover' }))) return
    await onRemoveFood(food.id)
    setView({ kind: 'search' })
  }

  const descricao =
    view.kind === 'form'
      ? 'Os valores são por 100 g ou 100 ml, como vêm no rótulo.'
      : 'Valores por 100 g da TACO. O que não estiver na lista, você cadastra.'

  return (
    <Modal
      open
      onClose={onClose}
      title={view.kind === 'form' && view.food ? 'Editar alimento' : `Adicionar em ${label}`}
      description={descricao}
      footer={
        view.kind === 'quantity' ? (
          <>
            <Button variant="ghost" onClick={() => setView({ kind: 'search' })}>
              Voltar
            </Button>
            <Button
              onClick={async () => {
                await onAdd(view.food, decimalInput(quantity))
                setView({ kind: 'search' })
                setQuery('')
              }}
            >
              Adicionar · {integer(view.food.kcal * factor)} kcal
            </Button>
          </>
        ) : view.kind === 'form' ? (
          <>
            <Button variant="ghost" onClick={() => setView({ kind: 'search' })}>
              Cancelar
            </Button>
            <Button type="submit" form={FORM_ID}>
              {view.food ? 'Salvar alterações' : 'Cadastrar e usar'}
            </Button>
          </>
        ) : undefined
      }
    >
      {view.kind === 'quantity' ? (
        <div className="space-y-4">
          <div>
            <p className="text-fg text-sm font-medium">{view.food.name}</p>
            <p className="text-fg-subtle text-xs">
              Por 100 g: {integer(view.food.kcal)} kcal · P {decimal(view.food.protein_g, 1)} · C{' '}
              {decimal(view.food.carb_g, 1)} · G {decimal(view.food.fat_g, 1)}
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
              onClick={() => setQuantity(String(view.food.serving_g))}
              className="border-border-base bg-surface-2 text-fg-muted hover:text-fg rounded-md border px-2 py-1 text-xs"
            >
              {view.food.serving_label} ({view.food.serving_g} g)
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
            <Macro label="kcal" value={integer(view.food.kcal * factor)} />
            <Macro label="Prot" value={`${decimal(view.food.protein_g * factor, 1)} g`} />
            <Macro label="Carb" value={`${decimal(view.food.carb_g * factor, 1)} g`} />
            <Macro label="Gord" value={`${decimal(view.food.fat_g * factor, 1)} g`} />
          </div>
        </div>
      ) : view.kind === 'form' ? (
        <FoodForm
          id={FORM_ID}
          initial={view.food}
          defaultName={query}
          onSubmit={salvarAlimento}
          onRemove={removerAlimento}
        />
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

          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => setView({ kind: 'form', food: null })}
          >
            <Plus />
            {query.trim() ? `Cadastrar "${query.trim()}"` : 'Cadastrar um alimento'}
          </Button>

          {results.length === 0 ? (
            <EmptyState
              icon={<Utensils className="size-5" />}
              title="Nada encontrado"
              description="A base local traz os alimentos mais comuns da TACO. O que faltar, cadastre pelo botão acima — fica salvo para as próximas vezes."
            />
          ) : (
            <div className="divide-border-base -mx-1 divide-y">
              {results.map((food) => (
                <div key={food.id} className="flex items-center gap-2 px-1 py-2">
                  <button
                    type="button"
                    onClick={() => escolher(food)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-fg truncate text-sm">
                      {food.name}
                      {food.brand && <span className="text-fg-subtle"> · {food.brand}</span>}
                    </p>
                    <p className="text-fg-subtle text-[11px]">
                      {integer(food.kcal)} kcal/100 g · P {decimal(food.protein_g, 1)} g
                    </p>
                  </button>
                  {food.favorite && <Badge tone="accent">favorito</Badge>}
                  {food.source === 'custom' && (
                    <button
                      type="button"
                      onClick={() => setView({ kind: 'form', food })}
                      className="text-fg-subtle hover:text-fg transition-colors"
                      aria-label={`Editar ${food.name}`}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  )}
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

interface FoodFormState {
  name: string
  brand: string
  kcal: string
  protein: string
  carb: string
  fat: string
  fiber: string
  serving_g: string
  serving_label: string
}

/**
 * Cadastro de um alimento que não está na TACO — a marca de whey que você usa,
 * a marmita da esquina, a receita da sua mãe.
 *
 * Um `<form>` de verdade, e não um punhado de campos: o rodapé do modal fica
 * fora dele no DOM e se liga pelo atributo `form`, e o Enter em qualquer campo
 * salva, que é o que se espera de um formulário.
 */
function FoodForm({
  id,
  initial,
  defaultName,
  onSubmit,
  onRemove,
}: {
  id: string
  initial: Food | null
  /** O que foi digitado na busca — quase sempre é o nome que a pessoa quer. */
  defaultName: string
  onSubmit: (draft: FoodDraft) => Promise<void>
  onRemove: (food: Food) => Promise<void>
}) {
  const [form, setForm] = useState<FoodFormState>(() => ({
    name: initial?.name ?? defaultName.trim(),
    brand: initial?.brand ?? '',
    kcal: initial ? String(initial.kcal) : '',
    protein: initial ? String(initial.protein_g) : '',
    carb: initial ? String(initial.carb_g) : '',
    fat: initial ? String(initial.fat_g) : '',
    fiber: initial ? String(initial.fiber_g) : '',
    serving_g: initial ? String(initial.serving_g) : '100',
    serving_label: initial?.serving_label ?? '1 porção',
  }))
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const set = (values: Partial<FoodFormState>) => setForm((prev) => ({ ...prev, ...values }))

  const protein = decimalInput(form.protein)
  const carb = decimalInput(form.carb)
  const fat = decimalInput(form.fat)
  const kcalPelosMacros = kcalFromMacros(protein, carb, fat)

  async function submeter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = form.name.trim()
    if (!name) {
      setErro('Dê um nome ao alimento.')
      return
    }

    const serving = decimalInput(form.serving_g)
    if (serving <= 0) {
      setErro('A porção usual precisa ser maior que zero.')
      return
    }

    setErro(null)
    setSalvando(true)
    try {
      await onSubmit({
        name,
        brand: form.brand.trim() || null,
        // Editar um alimento da TACO não é possível pela lista, mas se um dia
        // for, a origem dele não deve virar "seu" sem querer.
        source: initial?.source ?? 'custom',
        barcode: initial?.barcode ?? null,
        // Muito rótulo traz os macros e esconde a caloria. Deixando em branco,
        // ela sai da conta dos macros em vez de virar zero.
        kcal: form.kcal.trim() ? decimalInput(form.kcal) : kcalPelosMacros,
        protein_g: protein,
        carb_g: carb,
        fat_g: fat,
        fiber_g: decimalInput(form.fiber),
        serving_g: serving,
        serving_label: form.serving_label.trim() || '1 porção',
        favorite: initial?.favorite ?? false,
      })
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível salvar o alimento.')
      setSalvando(false)
    }
  }

  return (
    <form id={id} onSubmit={submeter} className="space-y-4">
      <Field label="Nome">
        <Input
          autoFocus
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Pão de queijo congelado"
        />
      </Field>

      <Field label="Marca" hint="Opcional — ajuda a diferenciar dois parecidos">
        <Input
          value={form.brand}
          onChange={(e) => set({ brand: e.target.value })}
          placeholder="Forno de Minas"
        />
      </Field>

      <div className="border-border-base space-y-3 rounded-lg border p-3">
        <p className="text-fg-muted text-xs font-medium">Por 100 g (ou 100 ml)</p>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Calorias"
            suffix="kcal"
            hint={
              form.kcal.trim() || kcalPelosMacros === 0
                ? undefined
                : `Em branco vira ${integer(kcalPelosMacros)} kcal, pelos macros`
            }
          >
            <Input
              inputMode="decimal"
              value={form.kcal}
              onChange={(e) => set({ kcal: e.target.value })}
              placeholder={kcalPelosMacros > 0 ? String(kcalPelosMacros) : '0'}
            />
          </Field>

          <Field label="Proteína" suffix="g">
            <Input
              inputMode="decimal"
              value={form.protein}
              onChange={(e) => set({ protein: e.target.value })}
              placeholder="0"
            />
          </Field>

          <Field label="Carboidrato" suffix="g">
            <Input
              inputMode="decimal"
              value={form.carb}
              onChange={(e) => set({ carb: e.target.value })}
              placeholder="0"
            />
          </Field>

          <Field label="Gordura" suffix="g">
            <Input
              inputMode="decimal"
              value={form.fat}
              onChange={(e) => set({ fat: e.target.value })}
              placeholder="0"
            />
          </Field>

          <Field label="Fibra" suffix="g">
            <Input
              inputMode="decimal"
              value={form.fiber}
              onChange={(e) => set({ fiber: e.target.value })}
              placeholder="0"
            />
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Porção usual" suffix="g" hint="Vem preenchida ao escolher o alimento">
          <Input
            inputMode="decimal"
            value={form.serving_g}
            onChange={(e) => set({ serving_g: e.target.value })}
          />
        </Field>

        <Field label="Como você chama">
          <Input
            value={form.serving_label}
            onChange={(e) => set({ serving_label: e.target.value })}
            placeholder="1 unidade"
          />
        </Field>
      </div>

      {erro && (
        <p className="text-negative bg-negative/10 rounded-lg px-3 py-2 text-xs font-medium">
          {erro}
        </p>
      )}

      {salvando && <p className="text-fg-subtle text-xs">Salvando…</p>}

      {/* Só o que você cadastrou pode sair: a TACO é o piso da base. */}
      {initial?.source === 'custom' && (
        <Button variant="ghost" size="sm" type="button" onClick={() => void onRemove(initial)}>
          <Trash2 />
          Remover da minha lista
        </Button>
      )}
    </form>
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
