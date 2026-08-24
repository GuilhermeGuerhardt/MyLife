import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { Segmented, Toggle } from '@/components/ui/misc'
import type { Account, BaseRow, Category, RecurringTransaction } from '@/data/types'
import { parseAmount } from '@/lib/finance/money'
import { today } from '@/lib/utils'
import { sortCategories } from './use-finance'

export type RecurringDraft = Omit<RecurringTransaction, keyof BaseRow>

/**
 * Cadastro de uma conta que se repete todo mês.
 *
 * A regra guarda o **dia**, não a data: é isso que faz o aluguel do dia 5
 * continuar caindo no dia 5 em fevereiro, e um dia 31 encolher para o último
 * dia do mês em vez de sumir.
 */
export function RecurringForm({
  initial,
  accounts,
  categories,
  onClose,
  onSave,
  onRemove,
}: {
  /** Nulo = criando. */
  initial: RecurringTransaction | null
  accounts: Account[]
  categories: Category[]
  onClose: () => void
  onSave: (draft: RecurringDraft) => Promise<void>
  onRemove: (() => void) | null
}) {
  const [description, setDescription] = useState(initial?.description ?? '')
  const [kind, setKind] = useState<RecurringDraft['kind']>(initial?.kind ?? 'expense')
  const [amount, setAmount] = useState(
    initial ? (initial.amount_cents / 100).toFixed(2).replace('.', ',') : '',
  )
  const [accountId, setAccountId] = useState(initial?.account_id ?? accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '')
  const [day, setDay] = useState(initial?.day_of_month ?? 5)
  const [startDate, setStartDate] = useState(initial?.start_date ?? today())
  const [endDate, setEndDate] = useState(initial?.end_date ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const amountCents = parseAmount(amount)
  const available = sortCategories(categories, kind)

  async function salvar() {
    if (!description.trim()) {
      setErro('Dê um nome à recorrente.')
      return
    }
    if (amountCents <= 0) {
      setErro('Informe um valor maior que zero.')
      return
    }
    if (!accountId) {
      setErro('Escolha a conta.')
      return
    }
    // Um fim anterior ao início nunca geraria nada, e a tela ficaria mostrando
    // uma regra que não produz lançamento nenhum.
    if (endDate && endDate < startDate) {
      setErro('O fim não pode ser antes do início.')
      return
    }

    setErro(null)
    setSalvando(true)
    try {
      await onSave({
        description: description.trim(),
        account_id: accountId,
        category_id: categoryId || null,
        kind,
        amount_cents: amountCents,
        day_of_month: day,
        start_date: startDate,
        end_date: endDate || null,
        active,
      })
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível salvar.')
      setSalvando(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? 'Editar recorrente' : 'Nova recorrente'}
      description="A regra não lança nada sozinha — ela fica pendente até você confirmar no mês."
      footer={
        <>
          {onRemove && (
            <Button variant="ghost" className="text-negative mr-auto" onClick={onRemove}>
              Excluir
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
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
            setCategoryId('')
          }}
          options={[
            { value: 'expense' as const, label: 'Despesa' },
            { value: 'income' as const, label: 'Receita' },
          ]}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Descrição" className="sm:col-span-2">
            <Input
              autoFocus
              value={description}
              placeholder={kind === 'income' ? 'Salário' : 'Aluguel'}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <Field label="Valor" suffix="R$">
            <Input
              inputMode="decimal"
              value={amount}
              placeholder="0,00"
              onChange={(e) => setAmount(e.target.value)}
              className="text-lg font-semibold"
            />
          </Field>

          <Field label="Dia do mês">
            <Select value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Conta">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Categoria">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Sem categoria</option>
              {available.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Começa em">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>

          <Field label="Termina em" hint="Deixe vazio para não ter fim.">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>

        <div className="bg-surface-2 flex items-center justify-between gap-4 rounded-lg px-3 py-2.5">
          <div>
            <p className="text-fg text-xs font-medium">Ativa</p>
            <p className="text-fg-muted text-[11px]">
              Desativada, ela para de aparecer como pendente sem perder o histórico.
            </p>
          </div>
          <Toggle checked={active} onChange={setActive} label="Recorrente ativa" />
        </div>

        {erro && <p className="text-negative text-xs">{erro}</p>}
      </div>
    </Modal>
  )
}
