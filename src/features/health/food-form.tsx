import { Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import type { BaseRow, Food } from '@/data/types'
import { integer } from '@/lib/format'
import { decimalInput, kcalFromMacros } from '@/lib/health/nutrition'

export type FoodDraft = Omit<Food, keyof BaseRow>

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
export function FoodForm({
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
