import { Pencil, Plus, Search, Star, Utensils } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Badge, EmptyState } from '@/components/ui/misc'
import { Modal } from '@/components/ui/modal'
import { MEAL_SLOTS, type Food, type MealSlot } from '@/data/types'
import { confirmar } from '@/lib/avisos'
import { decimal, integer } from '@/lib/format'
import { decimalInput } from '@/lib/health/nutrition'
import { normalize } from '@/lib/quick-add/parser'
import { FoodForm, type FoodDraft } from './food-form'

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

/** Acima disso a busca vira uma lista que ninguém percorre. */
const MAX_RESULTS = 40

/** Porções redondas, para não ter que digitar o mais comum. */
const QUICK_AMOUNTS = [50, 100, 150, 200]

export function AddFoodModal({
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

  const results = useMemo(() => searchFoods(foods, query), [foods, query])

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
        <QuantityView
          food={view.food}
          quantity={quantity}
          onQuantityChange={setQuantity}
          factor={factor}
        />
      ) : view.kind === 'form' ? (
        <FoodForm
          id={FORM_ID}
          initial={view.food}
          defaultName={query}
          onSubmit={salvarAlimento}
          onRemove={removerAlimento}
        />
      ) : (
        <SearchView
          query={query}
          onQueryChange={setQuery}
          results={results}
          onPick={escolher}
          onEdit={(food) => setView({ kind: 'form', food })}
          onCreate={() => setView({ kind: 'form', food: null })}
          onToggleFavorite={onToggleFavorite}
        />
      )}
    </Modal>
  )
}

/**
 * Busca por nome ou marca. Sem termo, primeiro os favoritos e depois os seus:
 * a lista da TACO é longa e o que você mesmo cadastrou é o que mais se repete.
 */
function searchFoods(foods: Food[], query: string): Food[] {
  const term = normalize(query)
  const list = term
    ? foods.filter(
        (food) =>
          normalize(food.name).includes(term) ||
          (food.brand !== null && normalize(food.brand).includes(term)),
      )
    : [...foods].sort(
        (a, b) =>
          Number(b.favorite) - Number(a.favorite) ||
          Number(b.source === 'custom') - Number(a.source === 'custom'),
      )
  return list.slice(0, MAX_RESULTS)
}

function SearchView({
  query,
  onQueryChange,
  results,
  onPick,
  onEdit,
  onCreate,
  onToggleFavorite,
}: {
  query: string
  onQueryChange: (query: string) => void
  results: Food[]
  onPick: (food: Food) => void
  onEdit: (food: Food) => void
  onCreate: () => void
  onToggleFavorite: (food: Food) => void
}) {
  return (
    <div className="space-y-3">
      <Field>
        <Input
          autoFocus
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar alimento (arroz, frango, whey...)"
          className="pl-9"
        />
        <Search className="text-fg-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      </Field>

      <Button variant="secondary" size="sm" className="w-full" onClick={onCreate}>
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
                onClick={() => onPick(food)}
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
                  onClick={() => onEdit(food)}
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
  )
}

function QuantityView({
  food,
  quantity,
  onQuantityChange,
  factor,
}: {
  food: Food
  quantity: string
  onQuantityChange: (quantity: string) => void
  factor: number
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-fg text-sm font-medium">{food.name}</p>
        <p className="text-fg-subtle text-xs">
          Por 100 g: {integer(food.kcal)} kcal · P {decimal(food.protein_g, 1)} · C{' '}
          {decimal(food.carb_g, 1)} · G {decimal(food.fat_g, 1)}
        </p>
      </div>

      <Field label="Quantidade" suffix="g">
        <Input
          autoFocus
          inputMode="decimal"
          value={quantity}
          onChange={(e) => onQuantityChange(e.target.value)}
        />
      </Field>

      <div className="flex flex-wrap gap-1.5">
        <AmountButton
          onClick={() => onQuantityChange(String(food.serving_g))}
          label={`${food.serving_label} (${food.serving_g} g)`}
        />
        {QUICK_AMOUNTS.map((amount) => (
          <AmountButton
            key={amount}
            onClick={() => onQuantityChange(String(amount))}
            label={`${amount} g`}
          />
        ))}
      </div>

      <div className="bg-surface-2 grid grid-cols-4 gap-2 rounded-lg px-3 py-2.5 text-center text-xs">
        <Macro label="kcal" value={integer(food.kcal * factor)} />
        <Macro label="Prot" value={`${decimal(food.protein_g * factor, 1)} g`} />
        <Macro label="Carb" value={`${decimal(food.carb_g * factor, 1)} g`} />
        <Macro label="Gord" value={`${decimal(food.fat_g * factor, 1)} g`} />
      </div>
    </div>
  )
}

function AmountButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border-base bg-surface-2 text-fg-muted hover:text-fg rounded-md border px-2 py-1 text-xs"
    >
      {label}
    </button>
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
