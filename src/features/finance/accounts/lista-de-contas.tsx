import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/misc'
import { ACCOUNT_KIND_LABELS, type Account, type AccountCheck } from '@/data/types'
import { LinhaDeConta } from '@/features/finance/linha-de-conta'
import type { AccountSummary } from '@/features/finance/use-finance'
import { daysSinceCheck, lastCheck, needsCheck, unchecked } from '@/lib/finance/conferencia'
import { formatCents } from '@/lib/finance/money'
import type { TransactionLike } from '@/lib/finance/reports'
import { shortDate } from '@/lib/format'
import { today } from '@/lib/utils'

/**
 * As contas que têm saldo — corrente, poupança, carteira.
 *
 * É lista, não um cartão por conta: o que se faz aqui é comparar saldos, e
 * comparar números exige uma coluna, não caixas espalhadas. Cartão fica de
 * fora da lista porque não tem saldo: tem fatura, e isso é a outra seção.
 */
export function ListaDeContas({
  contas,
  conferencias,
  movimento,
  onEditar,
  onConferir,
}: {
  contas: AccountSummary[]
  conferencias: AccountCheck[]
  /** O extrato inteiro: a conferência não se limita ao mês da tela. */
  movimento: TransactionLike[]
  onEditar: (conta: Account) => void
  onConferir: (conta: Account) => void
}) {
  if (contas.length === 0) return null

  return (
    <div>
      <SectionTitle>Contas</SectionTitle>
      <Card className="overflow-hidden">
        <div className="divide-border-base divide-y">
          {contas.map(({ account, balance }) => {
            const ultima = lastCheck(conferencias, account.id)
            const pendentes = unchecked(movimento, account.id, ultima).length
            const dias = daysSinceCheck(ultima, today())
            const lembrar = needsCheck(ultima, today(), pendentes)

            return (
              <LinhaDeConta
                key={account.id}
                cor={account.color}
                nome={account.name}
                negativo={balance < 0}
                valor={formatCents(balance)}
                detalhe={
                  <>
                    {account.bank ?? ACCOUNT_KIND_LABELS[account.kind]}
                    {ultima
                      ? ` · conferido até ${shortDate(ultima.date)}${
                          dias !== null && dias >= 30 ? ` (há ${dias} dias)` : ''
                        }${pendentes > 0 ? `, ${pendentes} depois` : ''}`
                      : ' · extrato nunca conferido'}
                  </>
                }
              >
                {/* O botao sobe de tom quando passou do mes ou nunca houve
                    conferencia e ja ha movimento: e lembrete, nao alarme. */}
                <Button
                  variant={lembrar ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => onConferir(account)}
                >
                  Conferir
                </Button>
                <button
                  type="button"
                  onClick={() => onEditar(account)}
                  className="text-fg-subtle hover:text-fg transition-colors"
                  aria-label={`Editar ${account.name}`}
                >
                  <Pencil className="size-3.5" />
                </button>
              </LinhaDeConta>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
