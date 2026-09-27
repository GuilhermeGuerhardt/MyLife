import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import type { FinancialGoal } from '@/data/types'
import { InputDeDinheiro } from '@/features/finance/input-de-dinheiro'
import { formatCents, parseAmount } from '@/lib/finance/money'

/**
 * Os três formulários do orçamento: criar envelope, criar meta e aportar.
 *
 * Moram juntos porque são a mesma conversa curta — um ou dois campos e um
 * valor em reais — e separados virariam três arquivos de trinta linhas.
 */

export function FormularioDeEnvelope({
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
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Limite mensal" suffix="R$">
          <InputDeDinheiro autoFocus value={limit} onChange={setLimit} />
        </Field>
      </div>
    </Modal>
  )
}

export function FormularioDeMeta({
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
          <InputDeDinheiro value={target} onChange={setTarget} />
        </Field>
        <Field label="Já guardado" suffix="R$">
          <InputDeDinheiro value={current} onChange={setCurrent} />
        </Field>
        <Field label="Prazo" className="sm:col-span-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

export function FormularioDeAporte({
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
        <InputDeDinheiro autoFocus value={amount} onChange={setAmount} />
      </Field>
    </Modal>
  )
}
