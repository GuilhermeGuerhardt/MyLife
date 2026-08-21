import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import type { BaseRow, Category } from '@/data/types'
import { CATEGORY_ICONS, resolveIconName, type CategoryIconName } from './category-icons'
import { PICKER_COLORS } from '@/lib/finance/palette'
import { normalizeText } from '@/lib/finance/import'
import { cn } from '@/lib/utils'

export type CategoryDraft = Omit<Category, keyof BaseRow>

const ICON_NAMES = Object.keys(CATEGORY_ICONS) as CategoryIconName[]

/**
 * Cadastro de categoria.
 *
 * A cor não é enfeite: é ela que separa uma fatia da outra em "Onde foi o
 * dinheiro". Por isso vem pré-escolhida num tom ainda livre em vez de deixar a
 * pessoa criar cinco categorias e descobrir depois que o gráfico virou uma
 * mancha só.
 */
export function CategoryForm({
  initial,
  existing,
  onClose,
  onSave,
  onRemove,
}: {
  /** Nulo = criando. */
  initial: Category | null
  /** As que já existem — para não repetir cor nem nome. */
  existing: Category[]
  onClose: () => void
  onSave: (draft: CategoryDraft) => Promise<void>
  onRemove: (() => void) | null
}) {
  const [form, setForm] = useState<CategoryDraft>(() => ({
    name: initial?.name ?? '',
    kind: initial?.kind ?? 'expense',
    color: initial?.color ?? primeiraCorLivre(existing),
    icon: resolveIconName(initial?.icon),
    keywords: initial?.keywords ?? [],
  }))
  const [keywords, setKeywords] = useState(initial?.keywords.join(', ') ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const set = <K extends keyof CategoryDraft>(key: K, value: CategoryDraft[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  async function salvar() {
    const name = form.name.trim()
    if (!name) {
      setErro('Dê um nome à categoria.')
      return
    }

    // Duas "Mercado" na lista tornam impossível saber em qual você lançou.
    const repetida = existing.some(
      (c) =>
        c.id !== initial?.id &&
        c.kind === form.kind &&
        normalizeText(c.name) === normalizeText(name),
    )
    if (repetida) {
      setErro(`Já existe uma categoria de ${form.kind === 'income' ? 'receita' : 'despesa'} com esse nome.`)
      return
    }

    setErro(null)
    setSalvando(true)
    try {
      await onSave({
        ...form,
        name,
        keywords: keywords
          .split(',')
          .map((palavra) => normalizeText(palavra))
          .filter(Boolean),
      })
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível salvar a categoria.')
      setSalvando(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? 'Editar categoria' : 'Nova categoria'}
      description="A cor aparece no gráfico do mês; as palavras-chave fazem o app adivinhar sozinho."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" className="sm:col-span-2">
          <Input
            autoFocus
            value={form.name}
            placeholder="Barbearia"
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>

        <Field label="Tipo">
          <Select
            value={form.kind}
            onChange={(e) => set('kind', e.target.value as CategoryDraft['kind'])}
          >
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </Select>
        </Field>

        <div className="sm:col-span-2">
          <p className="text-fg-muted mb-2 text-xs font-medium">Ícone</p>
          <div className="flex flex-wrap gap-1">
            {ICON_NAMES.map((name) => {
              const Icon = CATEGORY_ICONS[name]
              const escolhido = form.icon === name
              return (
                <button
                  key={name}
                  type="button"
                  aria-label={name}
                  aria-pressed={escolhido}
                  title={name}
                  onClick={() => set('icon', name)}
                  className={cn(
                    'hover:bg-surface-2 flex size-8 items-center justify-center rounded-md transition-colors',
                    escolhido ? 'bg-accent-soft' : 'text-fg-muted',
                  )}
                >
                  {/* Na cor escolhida: é assim que ele vai aparecer nas listas. */}
                  <Icon className="size-4" style={escolhido ? { color: form.color } : undefined} />
                </button>
              )
            })}
          </div>
        </div>

        <Field
          label="Palavras-chave"
          hint='Separadas por vírgula. "gastei 40 na barbearia" cai aqui sozinho.'
          className="sm:col-span-2"
        >
          <Input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="barbearia, cabelo, barba"
          />
        </Field>

        <div className="sm:col-span-2">
          <p className="text-fg-muted mb-2 text-xs font-medium">
            Cor <span className="text-fg-subtle font-normal">— como aparece no gráfico</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {PICKER_COLORS.map((color) => {
              const tomada = existing.some((c) => c.id !== initial?.id && c.color === color)
              return (
                <button
                  key={color}
                  type="button"
                  aria-label={`Cor ${color}${tomada ? ' (já usada por outra categoria)' : ''}`}
                  title={tomada ? 'Já usada por outra categoria' : undefined}
                  onClick={() => set('color', color)}
                  style={{ background: color }}
                  className={cn(
                    'size-7 rounded-full transition-transform',
                    // Meio apagada quando outra categoria já a usa: dá para
                    // escolher assim mesmo, mas você vê que vai repetir.
                    tomada && form.color !== color && 'opacity-40',
                    form.color === color &&
                      'ring-fg ring-2 ring-offset-2 ring-offset-[var(--surface)]',
                  )}
                />
              )
            })}
          </div>
        </div>

        {erro && (
          <p className="text-negative bg-negative/10 rounded-lg px-3 py-2 text-xs font-medium sm:col-span-2">
            {erro}
          </p>
        )}

        {onRemove && (
          <div className="sm:col-span-2">
            <Button variant="ghost" size="sm" onClick={onRemove} disabled={salvando}>
              Remover categoria
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

/** O primeiro tom da paleta que nenhuma categoria reivindicou ainda. */
function primeiraCorLivre(existing: Category[]): string {
  const usadas = new Set(existing.map((c) => c.color))
  return PICKER_COLORS.find((color) => !usadas.has(color)) ?? PICKER_COLORS[0]
}
