import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import type { Account, Receivable, Transaction } from '@/data/types'
import { addDays } from '@/lib/dates'
import { parteDeCada } from '@/lib/finance/a-receber'
import { centsToInput, formatCents, parseAmount } from '@/lib/finance/money'
import { shortDate } from '@/lib/format'
import { today } from '@/lib/utils'
import { InputDeDinheiro } from '../input-de-dinheiro'
import type { NovoAReceber } from './use-a-receber'

/** Até onde a lista de despesas para dividir olha para trás. */
const DIAS_DE_DESPESAS = 60

/**
 * Anotar que alguém te deve.
 *
 * Partir de uma despesa já lançada é o caminho comum: escolhida a conta do bar,
 * a descrição, o dia e a parte de cada um vêm sozinhos. Escrever tudo à mão
 * continua possível para o que não passou pelo app.
 */
export function NovoAReceberForm({
  despesas,
  pessoas,
  onClose,
  onSave,
}: {
  despesas: Transaction[]
  /** Nomes já usados, para o campo sugerir. */
  pessoas: string[]
  onClose: () => void
  onSave: (novo: NovoAReceber) => Promise<void>
}) {
  const [pessoa, setPessoa] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(today())
  const [despesaId, setDespesaId] = useState('')
  const [dividirEntre, setDividirEntre] = useState(2)
  const [salvando, setSalvando] = useState(false)

  // Só o que já aconteceu: a parcela de novembro e o aluguel agendado ainda não
  // foram pagos por ninguém, e enchiam o topo da lista.
  const recentes = useMemo(() => {
    const hoje = today()
    const desde = addDays(hoje, -DIAS_DE_DESPESAS)
    return despesas
      .filter(
        (despesa) => despesa.kind === 'expense' && despesa.date >= desde && despesa.date <= hoje,
      )
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 40)
  }, [despesas])

  const despesa = recentes.find((item) => item.id === despesaId) ?? null

  function escolherDespesa(id: string) {
    setDespesaId(id)
    const escolhida = recentes.find((item) => item.id === id)
    if (!escolhida) return
    setDescricao(escolhida.description)
    setData(escolhida.date)
    setValor(centsToInput(parteDeCada(escolhida.amount_cents, dividirEntre)))
  }

  function trocarDivisao(pessoasNaConta: number) {
    setDividirEntre(pessoasNaConta)
    if (despesa) setValor(centsToInput(parteDeCada(despesa.amount_cents, pessoasNaConta)))
  }

  const centavos = parseAmount(valor)
  const valido = pessoa.trim() !== '' && descricao.trim() !== '' && centavos > 0 && data !== ''

  return (
    <Modal
      open
      onClose={onClose}
      title="Alguém te deve"
      description="A despesa continua inteira no extrato. Quando o dinheiro voltar, entra como reembolso."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!valido || salvando}
            onClick={async () => {
              setSalvando(true)
              try {
                await onSave({
                  person: pessoa,
                  description: descricao.trim(),
                  amount_cents: centavos,
                  date: data,
                  transaction_id: despesa?.id ?? null,
                })
              } finally {
                setSalvando(false)
              }
            }}
          >
            Anotar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {recentes.length > 0 && (
          <Field label="Veio de uma despesa?" className="sm:col-span-2">
            <Select value={despesaId} onChange={(e) => escolherDespesa(e.target.value)}>
              <option value="">Não, vou escrever</option>
              {recentes.map((item) => (
                <option key={item.id} value={item.id}>
                  {shortDate(item.date)} · {item.description || 'Despesa'} · {formatCents(item.amount_cents)}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Quem deve">
          <Input
            value={pessoa}
            onChange={(e) => setPessoa(e.target.value)}
            list="pessoas-a-receber"
            placeholder="Nome"
            autoFocus
          />
          <datalist id="pessoas-a-receber">
            {pessoas.map((nome) => (
              <option key={nome} value={nome} />
            ))}
          </datalist>
        </Field>

        {despesa ? (
          <Field label="Dividida entre" hint="Você incluído. A parte de cada um vira o valor.">
            <Select value={String(dividirEntre)} onChange={(e) => trocarDivisao(Number(e.target.value))}>
              {[2, 3, 4, 5, 6, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n} pessoas
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Dia">
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Field>
        )}

        <Field label="O quê" className="sm:col-span-2">
          <Input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Jantar, ingresso, metade da luz…"
          />
        </Field>

        <Field label="Quanto">
          <InputDeDinheiro value={valor} onChange={setValor} />
        </Field>
      </div>
    </Modal>
  )
}

/** Registrar que o dinheiro voltou: em qual conta e em que dia. */
export function ReceberForm({
  itens,
  contas,
  onClose,
  onConfirm,
}: {
  itens: Receivable[]
  /** Só contas que guardam dinheiro: reembolso não cai em cartão. */
  contas: Account[]
  onClose: () => void
  onConfirm: (contaId: string, data: string) => Promise<void>
}) {
  const [contaId, setContaId] = useState(contas[0]?.id ?? '')
  const [data, setData] = useState(today())
  const [salvando, setSalvando] = useState(false)
  const total = itens.reduce((soma, item) => soma + item.amount_cents, 0)
  const pessoa = itens[0]?.person ?? ''

  return (
    <Modal
      open
      onClose={onClose}
      title={`Recebi de ${pessoa}`}
      description={`${formatCents(total)} entram como receita de reembolso na conta escolhida.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!contaId || !data || salvando}
            onClick={async () => {
              setSalvando(true)
              try {
                await onConfirm(contaId, data)
              } finally {
                setSalvando(false)
              }
            }}
          >
            Registrar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Caiu em">
          <Select value={contaId} onChange={(e) => setContaId(e.target.value)}>
            {contas.map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Dia">
          <Input type="date" value={data} max={today()} onChange={(e) => setData(e.target.value)} />
        </Field>
        {itens.length > 1 && (
          <p className="text-fg-muted text-xs sm:col-span-2">
            {itens.map((item) => item.description).join(' · ')}
          </p>
        )}
      </div>
    </Modal>
  )
}
