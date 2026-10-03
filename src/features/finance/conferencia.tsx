import { CheckCircle2, ScanLine } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Badge } from '@/components/ui/misc'
import { Modal } from '@/components/ui/modal'
import type { Account, AccountCheck } from '@/data/types'
import { balanceOn, compareBalances, type CheckResult } from '@/lib/finance/conferencia'
import { formatCents, parseAmount } from '@/lib/finance/money'
import type { TransactionLike } from '@/lib/finance/reports'
import { shortDate } from '@/lib/format'
import { today } from '@/lib/utils'
import { InputDeDinheiro } from './input-de-dinheiro'

/**
 * Conferir o extrato: comparar o saldo do app com o do banco numa data.
 *
 * A diferença aparece enquanto se digita, antes de gravar — quem confere quer
 * saber se bate, e só depois decide se registra. Gravar não corrige nada: o
 * conserto é lançar o que faltou, e para isso a tela diz de que lado está
 * sobrando.
 */
export function FormularioDeConferencia({
  conta,
  transacoes,
  onClose,
  onSave,
}: {
  conta: Account
  transacoes: TransactionLike[]
  onClose: () => void
  onSave: (values: { date: string; balance_cents: number; difference_cents: number }) => Promise<void>
}) {
  const [date, setDate] = useState(today())
  const [saldo, setSaldo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const noApp = balanceOn(conta, transacoes, date)
  const resultado: CheckResult | null = saldo ? compareBalances(noApp, parseAmount(saldo)) : null

  async function gravar() {
    if (!resultado) return

    setErro(null)
    setSalvando(true)
    try {
      await onSave({
        date,
        balance_cents: resultado.bankCents,
        difference_cents: resultado.differenceCents,
      })
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível gravar a conferência.')
      setSalvando(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Conferir ${conta.name}`}
      description="Informe o saldo que o banco mostra na data e veja se bate com o que está lançado aqui."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button disabled={!saldo || salvando} onClick={() => void gravar()}>
            {salvando ? 'Gravando…' : 'Registrar conferência'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data do extrato">
            <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Saldo no extrato" suffix="R$">
            <InputDeDinheiro autoFocus value={saldo} onChange={setSaldo} />
          </Field>
        </div>

        <div className="bg-surface-2 space-y-2 rounded-lg px-4 py-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-fg-muted">No Life, até {shortDate(date)}</span>
            <span className="text-fg font-medium">{formatCents(noApp)}</span>
          </div>

          {resultado && (
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-fg-muted">Diferença</span>
              {resultado.status === 'ok' ? (
                <Badge tone="positive">bate certinho</Badge>
              ) : (
                <span className="text-negative font-medium">
                  {formatCents(Math.abs(resultado.differenceCents))}
                </span>
              )}
            </div>
          )}
        </div>

        {resultado && resultado.status !== 'ok' && (
          <p className="text-fg-muted text-xs leading-relaxed">
            {resultado.status === 'sobrando'
              ? 'O Life tem mais dinheiro que o banco: falta lançar alguma saída até essa data — tarifa, débito automático, compra esquecida.'
              : 'O banco tem mais dinheiro que o Life: falta lançar alguma entrada até essa data — rendimento, estorno, depósito.'}{' '}
            Registrar mesmo assim guarda a diferença como ela está hoje, para você comparar na
            próxima conferência.
          </p>
        )}

        <p className="text-fg-subtle text-xs">
          Só entram lançamentos efetivados até a data. O que está previsto fica de fora — o banco
          também não o mostra.
        </p>

        {erro && <p className="text-negative text-xs">{erro}</p>}
      </div>
    </Modal>
  )
}

/**
 * A linha de conferência no cartão da conta.
 *
 * Mostra até quando as contas bateram e quanto andou desde então; é o que
 * transforma "conferir o extrato" numa tarefa com começo visível em vez de uma
 * varredura do zero toda vez.
 */
export function ResumoDaConferencia({
  ultima,
  pendentes,
  onConferir,
}: {
  ultima: AccountCheck | null
  pendentes: number
  onConferir: () => void
}) {
  return (
    <div className="border-border-base flex items-center justify-between gap-2 border-t pt-2.5">
      <div className="min-w-0">
        {ultima ? (
          <>
            <p className="text-fg-muted flex items-center gap-1.5 text-xs">
              {ultima.difference_cents === 0 ? (
                <CheckCircle2 className="text-positive size-3" />
              ) : (
                <ScanLine className="size-3" />
              )}
              Conferido até {shortDate(ultima.date)}
              {ultima.difference_cents !== 0 &&
                ` · diferença de ${formatCents(Math.abs(ultima.difference_cents))}`}
            </p>
            <p className="text-fg-subtle text-xs">
              {pendentes === 0
                ? 'Nada novo desde então'
                : `${pendentes} lançamento${pendentes === 1 ? '' : 's'} desde então`}
            </p>
          </>
        ) : (
          <p className="text-fg-subtle text-xs">Extrato nunca conferido</p>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={onConferir}>
        Conferir
      </Button>
    </div>
  )
}
