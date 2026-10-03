import { CalendarClock, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge, Progress, SectionTitle, Stat } from '@/components/ui/misc'
import type { Account, Category, Transaction } from '@/data/types'
import { TransactionList } from '@/features/finance/lista-de-lancamentos'
import type { AccountSummary } from '@/features/finance/use-finance'
import { competenceLabel, statementPeriod, type Competence } from '@/lib/finance/billing'
import { invoiceItems } from '@/lib/finance/reports'
import { formatCents } from '@/lib/finance/money'
import { longDate, percent, relativeDay, shortDate } from '@/lib/format'

/**
 * O total da fatura, com o que ainda falta pagar.
 *
 * Quitada, vira selo em vez de número repetido; paga pela metade, diz quanto
 * resta. Os dois valores iguais não viram frase nenhuma — seria dizer a mesma
 * coisa duas vezes.
 */
function TotalDaFatura({ total, aberto }: { total: number; aberto: number }) {
  return (
    <Stat
      label="Total da fatura"
      value={formatCents(total)}
      hint={
        total > 0 && aberto === 0 ? (
          <Badge tone="positive">fatura paga</Badge>
        ) : aberto > 0 && aberto !== total ? (
          `${formatCents(aberto)} ainda em aberto`
        ) : undefined
      }
    />
  )
}

/** Vermelho perto do limite, amarelo na metade: o aviso vem antes do estouro. */
function tomDoLimite(usado: number, limite: number): 'negative' | 'warning' | 'accent' {
  if (limite <= 0) return 'accent'
  const uso = usado / limite
  return uso > 0.8 ? 'negative' : uso > 0.5 ? 'warning' : 'accent'
}

/**
 * Os cartões, um por fatura da competência.
 *
 * Cada um mostra o período de compras que a fatura cobre — é o que explica por
 * que a compra de ontem não está nela — e a lista do que caiu dentro.
 */
export function Cartoes({
  cartoes,
  competence,
  movimento,
  contas,
  categoriaPorId,
  onEditar,
  onQuitar,
  onEditarLancamento,
  onMarcarPago,
}: {
  cartoes: AccountSummary[]
  competence: Competence
  /** O extrato inteiro: a fatura escolhe por data, não pelo mês da tela. */
  movimento: Transaction[]
  contas: Account[]
  categoriaPorId: Map<string, Category>
  onEditar: (conta: Account) => void
  onQuitar: (conta: Account) => void
  onEditarLancamento: (transaction: Transaction) => void
  onMarcarPago: (transaction: Transaction, pago: boolean) => void
}) {
  if (cartoes.length === 0) return null

  return (
    <div>
      <SectionTitle>Cartões</SectionTitle>
      <div className="space-y-4">
        {cartoes.map(({ account, invoice, openInvoice, available }) => {
          const period = statementPeriod(competence, {
            closingDay: account.closing_day ?? 1,
            dueDay: account.due_day ?? 10,
          })
          const items = invoiceItems(account, competence, movimento)
          const emAberto = items.filter((t) => !t.paid)
          const limit = account.credit_limit_cents
          const used = limit && available !== null ? limit - available : 0
          const tom = tomDoLimite(used, limit ?? 0)

          return (
            <Card key={account.id}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <span className="size-3 rounded-full" style={{ background: account.color }} />
                    {account.name}
                  </span>
                }
                description={`Fatura de ${competenceLabel(competence)} · compras de ${shortDate(period.start)} a ${shortDate(period.end)}`}
                action={
                  <button
                    type="button"
                    onClick={() => onEditar(account)}
                    className="text-fg-subtle hover:text-fg transition-colors"
                    aria-label={`Editar ${account.name}`}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                }
              />
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <TotalDaFatura total={invoice ?? 0} aberto={openInvoice ?? 0} />
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="text-fg-subtle size-3.5" />
                      <div>
                        <p className="text-fg text-sm font-medium">
                          Vence {longDate(period.dueDate)}
                        </p>
                        <p className="text-fg-subtle text-xs first-letter:uppercase">
                          {relativeDay(period.dueDate)}
                        </p>
                      </div>
                    </div>
                    {emAberto.length > 0 && (
                      <Button variant="secondary" size="sm" onClick={() => onQuitar(account)}>
                        Quitar fatura
                      </Button>
                    )}
                  </div>
                </div>

                {limit && available !== null && (
                  <div className="space-y-1.5">
                    <div className="text-fg-muted flex justify-between text-xs">
                      <span>
                        {formatCents(available)} disponíveis de {formatCents(limit)}
                      </span>
                      <Badge tone={tom === 'accent' ? 'neutral' : tom}>
                        {percent((used / limit) * 100, 0)} usado
                      </Badge>
                    </div>
                    <Progress value={used} max={limit} tone={tom} />
                  </div>
                )}

                <div className="border-border-base -mx-5 border-t">
                  <TransactionList
                    transactions={items}
                    accounts={contas}
                    categoryById={categoriaPorId}
                    onEdit={onEditarLancamento}
                    onSetPaid={onMarcarPago}
                    emptyTitle="Fatura sem lançamentos"
                    emptyDescription="Compras feitas depois do fechamento aparecem na fatura seguinte."
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
