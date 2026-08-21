import { Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { Segmented } from '@/components/ui/misc'
import type { Account, Category, TransactionKind } from '@/data/types'
import { guessCategory } from '@/data/seed-finance'
import { competenceLabel, competenceFor, buildInstallments } from '@/lib/finance/billing'
import { formatCents, parseAmount } from '@/lib/finance/money'
import { today } from '@/lib/utils'
import { cardConfig, type TransactionDraft } from './actions'
import { sortCategories } from './use-finance'

/**
 * Formulário de lançamento.
 *
 * O que ele mostra muda conforme a conta escolhida: em cartão de crédito
 * aparecem as parcelas e a fatura em que a compra vai cair — informação que
 * evita a surpresa de comprar depois do fechamento e só pagar dois meses
 * depois.
 *
 * Em `mode="edit"` o parcelamento some: mudar o número de parcelas de uma
 * compra já gravada é refazer o grupo, não editar uma linha.
 */
export function TransactionForm({
  accounts,
  categories,
  defaultKind = 'expense',
  mode = 'create',
  initial,
  onClose,
  onDelete,
  onSave,
}: {
  accounts: Account[]
  categories: Category[]
  defaultKind?: TransactionKind
  mode?: 'create' | 'edit'
  initial?: Partial<TransactionDraft>
  onClose: () => void
  onDelete?: () => void
  onSave: (draft: TransactionDraft) => Promise<void>
}) {
  const editing = mode === 'edit'
  const [kind, setKind] = useState<TransactionKind>(initial?.kind ?? defaultKind)
  const [amount, setAmount] = useState(
    initial?.amount_cents ? (initial.amount_cents / 100).toFixed(2).replace('.', ',') : '',
  )
  const [description, setDescription] = useState(initial?.description ?? '')
  const [date, setDate] = useState(initial?.date ?? today())
  const [accountId, setAccountId] = useState(initial?.account_id ?? accounts[0]?.id ?? '')
  const [targetId, setTargetId] = useState(initial?.transfer_account_id ?? '')
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '')
  const [installments, setInstallments] = useState(initial?.installments ?? 1)
  const [paid, setPaid] = useState(initial?.paid ?? true)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [touchedCategory, setTouchedCategory] = useState(editing)

  const account = accounts.find((a) => a.id === accountId)
  const card = cardConfig(account)
  const amountCents = parseAmount(amount)

  const available = useMemo(
    () => sortCategories(categories, kind === 'income' ? 'income' : 'expense'),
    [categories, kind],
  )

  // Palpite de categoria pela descrição, até a pessoa escolher uma na mão.
  useEffect(() => {
    if (touchedCategory || kind === 'transfer' || !description.trim()) return
    const guess = guessCategory(description, categories, kind === 'income' ? 'income' : 'expense')
    if (guess) setCategoryId(guess.id)
  }, [description, categories, kind, touchedCategory])

  // Compra no cartão não é dinheiro que saiu ainda — quem paga é a fatura.
  // Só na criação: ao editar, a situação gravada é a que vale.
  useEffect(() => {
    if (editing) return
    if (card && kind === 'expense') setPaid(false)
  }, [card, kind, editing])

  // Mesma regra que `useCreateTransaction` aplica ao salvar — a prévia não
  // pode divergir do que é gravado.
  const competence = competenceFor(date, card)
  const plan =
    !editing && card && kind === 'expense' && installments > 1
      ? buildInstallments(amountCents, installments, date, card)
      : null

  const valid =
    amountCents > 0 &&
    accountId &&
    (kind !== 'transfer' || (targetId && targetId !== accountId))

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Editar lançamento' : 'Novo lançamento'}
      description="Valores em reais. Use vírgula para os centavos."
      footer={
        <>
          {onDelete && (
            <Button variant="ghost" className="text-negative mr-auto" onClick={onDelete}>
              <Trash2 />
              Excluir
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!valid}
            onClick={() =>
              void onSave({
                account_id: accountId,
                transfer_account_id: kind === 'transfer' ? targetId : null,
                category_id: kind === 'transfer' ? null : categoryId || null,
                kind,
                amount_cents: amountCents,
                date,
                description: description.trim(),
                tags: [],
                paid,
                installments: !editing && kind === 'expense' && card ? installments : 1,
                notes: notes.trim() || null,
              })
            }
          >
            {editing ? 'Salvar alterações' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented
          className="w-full"
          value={kind}
          onChange={(value) => {
            setKind(value)
            setTouchedCategory(false)
            setCategoryId('')
          }}
          options={[
            { value: 'expense' as const, label: 'Despesa' },
            { value: 'income' as const, label: 'Receita' },
            { value: 'transfer' as const, label: 'Transferência' },
          ]}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor" suffix="R$">
            <Input
              autoFocus
              inputMode="decimal"
              value={amount}
              placeholder="0,00"
              onChange={(e) => setAmount(e.target.value)}
              className="text-lg font-semibold"
            />
          </Field>

          <Field label="Data">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>

          <Field label="Descrição" className="sm:col-span-2">
            <Input
              value={description}
              placeholder={kind === 'income' ? 'Salário de março' : 'Mercado da esquina'}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <Field label={kind === 'transfer' ? 'De' : 'Conta'}>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>

          {kind === 'transfer' ? (
            <Field label="Para">
              <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value="">Selecione...</option>
                {accounts
                  .filter((item) => item.id !== accountId)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </Select>
            </Field>
          ) : (
            <Field label="Categoria">
              <Select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value)
                  setTouchedCategory(true)
                }}
              >
                <option value="">Sem categoria</option>
                {available.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {!editing && card && kind === 'expense' && (
            <Field label="Parcelas">
              <Select
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? 'À vista' : `${n}x`}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {(!card || editing) && (
            <Field label="Situação">
              <Select value={paid ? '1' : '0'} onChange={(e) => setPaid(e.target.value === '1')}>
                <option value="1">Efetivado</option>
                <option value="0">Previsto</option>
              </Select>
            </Field>
          )}

          <Field label="Observações" className="sm:col-span-2">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        {card && kind === 'expense' && amountCents > 0 && (
          <div className="bg-surface-2 space-y-1.5 rounded-lg px-3 py-2.5 text-xs">
            {plan ? (
              <>
                <p className="text-fg font-medium">
                  {plan.length}x de {formatCents(plan[1]?.amountCents ?? plan[0]!.amountCents)}
                  {plan[0]!.amountCents !== plan[1]?.amountCents &&
                    ` (primeira de ${formatCents(plan[0]!.amountCents)})`}
                </p>
                <p className="text-fg-muted">
                  Da fatura de {competenceLabel(plan[0]!.competence)} até{' '}
                  {competenceLabel(plan[plan.length - 1]!.competence)}.
                </p>
              </>
            ) : (
              <p className="text-fg-muted">
                Entra na fatura de <span className="text-fg font-medium">{competenceLabel(competence)}</span>
                {date.slice(8, 10) > String(card.closingDay).padStart(2, '0') &&
                  ' — a compra caiu depois do fechamento'}
                .
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
