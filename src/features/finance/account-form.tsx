import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { ACCOUNT_KIND_LABELS, type Account, type AccountKind, type BaseRow } from '@/data/types'
import { centsToInput, parseAmount } from '@/lib/finance/money'
import { cn } from '@/lib/utils'

export type AccountDraft = Omit<Account, keyof BaseRow>

const COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#14b8a6', '#eab308', '#64748b']

export function AccountForm({
  initial,
  onClose,
  onSave,
}: {
  initial?: Account
  onClose: () => void
  onSave: (values: AccountDraft) => Promise<void>
}) {
  const [form, setForm] = useState<AccountDraft>(() => ({
    name: initial?.name ?? '',
    kind: initial?.kind ?? 'checking',
    bank: initial?.bank ?? null,
    initial_balance_cents: initial?.initial_balance_cents ?? 0,
    credit_limit_cents: initial?.credit_limit_cents ?? null,
    closing_day: initial?.closing_day ?? null,
    due_day: initial?.due_day ?? null,
    color: initial?.color ?? COLORS[0]!,
    archived: initial?.archived ?? false,
  }))
  const [balance, setBalance] = useState(
    initial ? centsToInput(initial.initial_balance_cents) : '',
  )
  const [limit, setLimit] = useState(
    initial?.credit_limit_cents ? centsToInput(initial.credit_limit_cents) : '',
  )

  const set = <K extends keyof AccountDraft>(key: K, value: AccountDraft[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const isCard = form.kind === 'credit'

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? 'Editar conta' : 'Nova conta'}
      description={
        isCard
          ? 'Fechamento e vencimento definem em qual fatura cada compra cai.'
          : 'O saldo inicial é o ponto de partida — os lançamentos seguem a partir dele.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!form.name.trim()}
            onClick={() =>
              void onSave({
                ...form,
                initial_balance_cents: isCard ? 0 : parseAmount(balance),
                credit_limit_cents: isCard && limit ? parseAmount(limit) : null,
                closing_day: isCard ? (form.closing_day ?? 1) : null,
                due_day: isCard ? (form.due_day ?? 10) : null,
              })
            }
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" className="sm:col-span-2">
          <Input
            autoFocus
            value={form.name}
            placeholder={isCard ? 'Cartão de crédito' : 'Conta corrente'}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>

        <Field label="Tipo">
          <Select value={form.kind} onChange={(e) => set('kind', e.target.value as AccountKind)}>
            {(Object.keys(ACCOUNT_KIND_LABELS) as AccountKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {ACCOUNT_KIND_LABELS[kind]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Banco / instituição">
          <Input
            value={form.bank ?? ''}
            onChange={(e) => set('bank', e.target.value || null)}
          />
        </Field>

        {isCard ? (
          <>
            <Field label="Limite" suffix="R$">
              <Input
                inputMode="decimal"
                value={limit}
                placeholder="0,00"
                onChange={(e) => setLimit(e.target.value)}
              />
            </Field>

            <div />

            <Field label="Dia do fechamento" hint="Compras após esse dia entram na fatura seguinte.">
              <Select
                value={form.closing_day ?? 1}
                onChange={(e) => set('closing_day', Number(e.target.value))}
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    Dia {day}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Dia do vencimento">
              <Select
                value={form.due_day ?? 10}
                onChange={(e) => set('due_day', Number(e.target.value))}
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    Dia {day}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : (
          <Field label="Saldo inicial" suffix="R$">
            <Input
              inputMode="decimal"
              value={balance}
              placeholder="0,00"
              onChange={(e) => setBalance(e.target.value)}
            />
          </Field>
        )}

        <div className="sm:col-span-2">
          <p className="text-fg-muted mb-2 text-xs font-medium">Cor</p>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Cor ${color}`}
                onClick={() => set('color', color)}
                style={{ background: color }}
                className={cn(
                  'size-7 rounded-full transition-transform',
                  form.color === color && 'ring-fg ring-2 ring-offset-2 ring-offset-[var(--surface)]',
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
