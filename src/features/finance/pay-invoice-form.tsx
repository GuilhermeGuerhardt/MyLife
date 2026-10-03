import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import type { Account } from '@/data/types'
import { competenceLabel, type Competence } from '@/lib/finance/billing'
import { centsToInput, formatCents, parseAmount } from '@/lib/finance/money'
import { InputDeDinheiro } from './input-de-dinheiro'

/**
 * Quitação da fatura do cartão.
 *
 * Pede a conta de onde o dinheiro sai porque pagar a fatura é uma transferência
 * de verdade: sem ela, as compras virariam pagas e o saldo da conta continuaria
 * como se nada tivesse saído.
 *
 * O valor vem preenchido com a fatura inteira, mas pode ser menor: quem paga o
 * mínimo e rola o resto precisa que o app represente isso. No pagamento parcial
 * nenhuma compra vira paga — ninguém paga "metade do mercado" —, o que fica
 * registrado é o pagamento, e o que sobra continua na fatura.
 */
export function PayInvoiceForm({
  card,
  competence,
  amountCents,
  count,
  accounts,
  defaultDate,
  onClose,
  onConfirm,
}: {
  card: Account
  competence: Competence
  /** Total em aberto na fatura. */
  amountCents: number
  /** Quantas compras ainda estão previstas. */
  count: number
  /** Contas de onde o pagamento pode sair — cartão não paga cartão. */
  accounts: Account[]
  defaultDate: string
  onClose: () => void
  onConfirm: (fromAccountId: string, date: string, valorCents: number) => Promise<void>
}) {
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id ?? '')
  const [date, setDate] = useState(defaultDate)
  const [valor, setValor] = useState(() => centsToInput(amountCents))
  const [erro, setErro] = useState<string | null>(null)
  const [pagando, setPagando] = useState(false)

  const valorCents = Math.min(parseAmount(valor), amountCents)
  const sobra = amountCents - valorCents

  async function confirmar() {
    if (!fromAccountId) {
      setErro('Escolha de qual conta o pagamento sai.')
      return
    }
    if (valorCents <= 0) {
      setErro('Informe quanto está sendo pago.')
      return
    }
    setErro(null)
    setPagando(true)
    try {
      await onConfirm(fromAccountId, date, valorCents)
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível quitar a fatura.')
      setPagando(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Quitar fatura ${card.name}`}
      description={competenceLabel(competence)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pagando}>
            Cancelar
          </Button>
          <Button onClick={() => void confirmar()} disabled={pagando || accounts.length === 0}>
            {pagando ? 'Pagando…' : `Pagar ${formatCents(valorCents)}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-surface-2 rounded-lg px-3 py-2.5">
          <p className="text-fg text-sm">
            {count} compra{count === 1 ? '' : 's'} em aberto, somando{' '}
            <span className="font-semibold">{formatCents(amountCents)}</span>.
          </p>
          <p className="text-fg-muted mt-0.5 text-xs">
            {sobra > 0
              ? `Pagando ${formatCents(valorCents)}, ficam ${formatCents(sobra)} em aberto nesta fatura.`
              : 'Elas passam a pagas e uma transferência sai da conta escolhida. Parcelas de faturas futuras não são tocadas.'}
          </p>
        </div>

        {accounts.length === 0 ? (
          <p className="text-negative text-xs">
            Não há conta de onde pagar. Cadastre uma conta corrente ou carteira primeiro.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pagar com">
              <Select
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
              >
                {accounts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Data do pagamento">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>

            <Field
              label="Valor"
              suffix="R$"
              className="sm:col-span-2"
              hint="Menos que o total deixa o resto na fatura."
            >
              <InputDeDinheiro value={valor} onChange={setValor} />
            </Field>
          </div>
        )}

        {erro && <p className="text-negative text-xs">{erro}</p>}
      </div>
    </Modal>
  )
}
