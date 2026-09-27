import { TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Stat } from '@/components/ui/misc'
import type { OverdueSummary } from '@/lib/finance/reports'
import { formatCents } from '@/lib/finance/money'
import { percent, shortDate } from '@/lib/format'

/**
 * O aviso do que venceu.
 *
 * É o único cartão da tela que interrompe: o resto é consulta, e isto é conta
 * que já passou da data. Só aparece quando há o que avisar.
 */
export function AvisoDeAtrasos({ atrasos }: { atrasos: OverdueSummary }) {
  if (atrasos.count === 0) return null

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card className="border-negative/40">
        <CardContent className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-negative text-sm font-medium">
              {atrasos.count} lançamento{atrasos.count === 1 ? '' : 's'} vencido
              {atrasos.count === 1 ? '' : 's'}
            </p>
            <p className="text-fg-muted mt-0.5 text-xs">
              {formatCents(atrasos.totalCents)} em aberto
              {atrasos.oldestDate && ` · o mais antigo de ${shortDate(atrasos.oldestDate)}`}
            </p>
          </div>
          <Link to="/financeiro/transacoes">
            <Button variant="secondary" size="sm">
              Ver
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

/** Os quatro números do topo: saldo, o que entrou, o que saiu e o que sobrou. */
export function NumerosDoMes({
  saldo,
  faturasAbertas,
  fluxo,
}: {
  saldo: number
  faturasAbertas: number
  fluxo: { income: number; expense: number; net: number; savingsRate: number }
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent>
          <Stat
            icon={<Wallet className="size-3.5" />}
            label="Saldo em contas"
            value={formatCents(saldo)}
            hint={
              faturasAbertas > 0
                ? `${formatCents(faturasAbertas)} em faturas abertas`
                : 'Cartões não entram no saldo'
            }
            tone={saldo < 0 ? 'negative' : undefined}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stat
            icon={<TrendingUp className="size-3.5" />}
            label="Receitas do mês"
            value={formatCents(fluxo.income)}
            tone="positive"
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stat
            icon={<TrendingDown className="size-3.5" />}
            label="Despesas do mês"
            value={formatCents(fluxo.expense)}
            tone="negative"
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stat
            label="Sobrou"
            value={formatCents(fluxo.net)}
            tone={fluxo.net < 0 ? 'negative' : 'positive'}
            hint={
              fluxo.income > 0
                ? `Taxa de poupança: ${percent(fluxo.savingsRate, 0)}`
                : 'Sem receita lançada no mês'
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
