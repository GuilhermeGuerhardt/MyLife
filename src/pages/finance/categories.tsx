import { Pencil, Plus, Tags } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, EmptyState, SectionTitle } from '@/components/ui/misc'
import { useCategories, useTransactions } from '@/data/queries'
import type { Category } from '@/data/types'
import { CategoryForm, type CategoryDraft } from '@/features/finance/category-form'
import { CategoryIcon } from '@/features/finance/category-icons'
import { formatCents } from '@/lib/finance/money'
import { integer } from '@/lib/format'

/**
 * Categorias do financeiro.
 *
 * O catálogo que vem pronto continua intacto — ele é o que faz o registro
 * rápido acertar "gastei 35 no mercado" desde o primeiro dia. Esta tela existe
 * para o que ele não cobre: a barbearia, a mensalidade do clube, o dinheiro que
 * você manda para casa.
 */
export function CategoriesPage() {
  const { data: categories, create, update, remove } = useCategories()
  const { data: transactions } = useTransactions()
  const [editing, setEditing] = useState<Category | null>(null)
  const [adding, setAdding] = useState(false)

  /** Quantos lançamentos cada categoria tem — o que se perde ao removê-la. */
  const uso = useMemo(() => {
    const contagem = new Map<string, { count: number; total: number }>()
    for (const tx of transactions) {
      if (!tx.category_id) continue
      const atual = contagem.get(tx.category_id) ?? { count: 0, total: 0 }
      atual.count++
      atual.total += tx.amount_cents
      contagem.set(tx.category_id, atual)
    }
    return contagem
  }, [transactions])

  const ordenar = (list: Category[]) =>
    [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const despesas = ordenar(categories.filter((c) => c.kind === 'expense'))
  const receitas = ordenar(categories.filter((c) => c.kind === 'income'))

  async function salvar(draft: CategoryDraft) {
    if (editing) await update.mutateAsync({ id: editing.id, patch: draft })
    else await create.mutateAsync(draft)
    setEditing(null)
    setAdding(false)
  }

  async function remover(category: Category) {
    const usos = uso.get(category.id)?.count ?? 0
    const aviso = usos
      ? `Remover "${category.name}"?\n\n${usos} lançamento${usos > 1 ? 's ficam' : ' fica'} sem categoria — o valor continua no total do mês, mas deixa de aparecer separado no gráfico.`
      : `Remover "${category.name}"?`
    if (!confirm(aviso)) return
    await remove.mutateAsync(category.id)
    setEditing(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-fg text-xl font-semibold">Categorias</h1>
          <p className="text-fg-muted mt-1 max-w-2xl text-sm">
            A cor de cada uma é a cor da fatia em “Onde foi o dinheiro”. As palavras-chave são o
            que faz o registro rápido e a importação de planilha adivinharem sozinhos.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus />
          Categoria
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <SectionTitle>Despesas</SectionTitle>
          <Lista
            categories={despesas}
            uso={uso}
            onEdit={setEditing}
            vazio="Nenhuma categoria de despesa."
          />
        </div>

        <div>
          <SectionTitle>Receitas</SectionTitle>
          <Lista
            categories={receitas}
            uso={uso}
            onEdit={setEditing}
            vazio="Nenhuma categoria de receita."
          />
        </div>
      </div>

      {(adding || editing) && (
        <CategoryForm
          key={editing?.id ?? 'nova'}
          initial={editing}
          existing={categories}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
          onSave={salvar}
          onRemove={editing ? () => void remover(editing) : null}
        />
      )}
    </div>
  )
}

function Lista({
  categories,
  uso,
  onEdit,
  vazio,
}: {
  categories: Category[]
  uso: Map<string, { count: number; total: number }>
  onEdit: (category: Category) => void
  vazio: string
}) {
  if (categories.length === 0) {
    return (
      <Card>
        <EmptyState icon={<Tags className="size-5" />} title={vazio} />
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-border-base divide-y">
          {categories.map((category) => {
            const dados = uso.get(category.id)
            return (
              <div key={category.id} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `${category.color}1f` }}
                >
                  <CategoryIcon icon={category.icon} color={category.color} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-fg truncate text-sm">{category.name}</p>
                  {category.keywords.length > 0 && (
                    <p className="text-fg-subtle truncate text-[11px]">
                      {category.keywords.slice(0, 4).join(', ')}
                    </p>
                  )}
                </div>
                {dados ? (
                  <span className="text-fg-subtle shrink-0 text-right text-[11px]">
                    {integer(dados.count)}×<br />
                    <span className="text-fg-muted tabular-nums">{formatCents(dados.total)}</span>
                  </span>
                ) : (
                  <Badge>sem uso</Badge>
                )}
                <button
                  type="button"
                  onClick={() => onEdit(category)}
                  className="text-fg-subtle hover:text-fg shrink-0 transition-colors"
                  aria-label={`Editar ${category.name}`}
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
