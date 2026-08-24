import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Download, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import {
  resetFinance,
  totalFinanceRows,
  useAccounts,
  useBudgets,
  useGoals,
  useRecurring,
  useTransactions,
  type FinanceCounts,
} from '@/data/queries'
import {
  CODE_LENGTH,
  generateConfirmationCode,
  matchesConfirmationCode,
} from '@/lib/finance/reset'

/**
 * Apagar tudo do financeiro.
 *
 * Fica ao lado da exportação de propósito: a coisa que se deveria fazer antes
 * de apagar está a um card de distância.
 */
export function ResetFinanceCard() {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState<FinanceCounts | null>(null)

  const { data: accounts } = useAccounts()
  const { data: transactions } = useTransactions()
  const { data: budgets } = useBudgets()
  const { data: goals } = useGoals()
  const { data: recurring } = useRecurring()

  const counts: FinanceCounts = {
    accounts: accounts.length,
    transactions: transactions.length,
    budgets: budgets.length,
    goals: goals.length,
    recurring: recurring.length,
  }
  const total = totalFinanceRows(counts)

  return (
    <>
      <Card className="border-negative/40">
        <CardHeader
          title={<span className="text-negative">Zona de perigo</span>}
          description="Ações daqui não têm desfazer."
        />
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-lg">
            <p className="text-fg text-sm">Apagar dados financeiros</p>
            <p className="text-fg-muted mt-0.5 text-xs">
              Remove contas, lançamentos, orçamentos, metas e recorrentes, e devolve as
              categorias ao catálogo padrão. Saúde, alimentação, faculdade, cursos e rotina
              não são tocados.
            </p>
          </div>
          <Button
            variant="danger"
            onClick={() => {
              setDone(null)
              setOpen(true)
            }}
            disabled={total === 0}
          >
            <Trash2 />
            {total === 0 ? 'Nada para apagar' : 'Apagar dados financeiros'}
          </Button>
        </CardContent>
      </Card>

      {done && (
        <div className="bg-positive/10 text-positive mt-3 rounded-lg px-4 py-3 text-sm">
          {totalFinanceRows(done)} registro{totalFinanceRows(done) === 1 ? '' : 's'} removido
          {totalFinanceRows(done) === 1 ? '' : 's'}. O financeiro voltou ao estado de
          instalação, com as categorias padrão.
        </div>
      )}

      {open && (
        <ResetDialog
          counts={counts}
          onClose={() => setOpen(false)}
          onDone={(removed) => {
            setDone(removed)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

function ResetDialog({
  counts,
  onClose,
  onDone,
}: {
  counts: FinanceCounts
  onClose: () => void
  onDone: (removed: FinanceCounts) => void
}) {
  const client = useQueryClient()
  // Sorteado uma vez por abertura: repetir a operação não pode virar memória
  // muscular de um código já conhecido.
  const [code] = useState(generateConfirmationCode)
  const [typed, setTyped] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [apagando, setApagando] = useState(false)

  const liberado = matchesConfirmationCode(typed, code)

  const linhas: Array<[string, number]> = [
    ['Contas e cartões', counts.accounts],
    ['Lançamentos', counts.transactions],
    ['Orçamentos', counts.budgets],
    ['Metas', counts.goals],
    ['Recorrentes', counts.recurring],
  ]

  async function apagar() {
    // Conferido de novo aqui: `disabled` no botão é dica visual, não garantia.
    if (!matchesConfirmationCode(typed, code)) {
      setErro('O código não confere.')
      return
    }

    setErro(null)
    setApagando(true)
    try {
      const removed = await resetFinance()
      await client.invalidateQueries()
      onDone(removed)
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível apagar.')
      setApagando(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Apagar dados financeiros"
      description="Isto não tem desfazer."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={apagando}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => void apagar()} disabled={!liberado || apagando}>
            {apagando ? 'Apagando…' : 'Apagar tudo'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-warning/10 text-warning flex items-start gap-2 rounded-lg p-3 text-xs">
          <Download className="mt-px size-3.5 shrink-0" />
          <p>Exporte um backup antes. O card de exportação fica logo acima desta seção.</p>
        </div>

        <div>
          <p className="text-fg-muted mb-1.5 text-xs font-medium">Será removido</p>
          <dl className="text-sm">
            {linhas.map(([label, quantidade]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 py-0.5">
                <dt className="text-fg-muted">{label}</dt>
                <dd className="text-fg tabular-nums">{quantidade}</dd>
              </div>
            ))}
          </dl>
          <p className="border-border-base text-fg-subtle mt-2.5 border-t pt-2.5 text-xs">
            As categorias voltam ao catálogo padrão. Saúde, alimentação, faculdade, cursos e
            rotina não são tocados.
          </p>
        </div>

        <div>
          <p className="text-fg-muted mb-1.5 text-xs font-medium">Digite o código para liberar</p>
          <div className="bg-negative/10 rounded-lg px-3 py-3 text-center">
            <span className="text-negative font-mono text-2xl font-medium tracking-[0.32em]">
              {code}
            </span>
          </div>
        </div>

        <div>
          <Input
            autoFocus
            value={typed}
            maxLength={CODE_LENGTH}
            autoComplete="off"
            spellCheck={false}
            aria-label="Código de confirmação"
            placeholder={'—'.repeat(CODE_LENGTH)}
            onChange={(e) => {
              setTyped(e.target.value)
              if (erro) setErro(null)
            }}
            className="text-center font-mono text-base tracking-[0.24em] uppercase"
          />
          {erro && (
            <p className="text-negative mt-1.5 flex items-center gap-1.5 text-xs">
              <AlertTriangle className="size-3.5" />
              {erro}
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
