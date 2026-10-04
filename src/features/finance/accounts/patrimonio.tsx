import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Stat } from '@/components/ui/misc'
import { SaldoChart } from '@/features/finance/charts'
import { competenceLabel } from '@/lib/finance/billing'
import { formatCents } from '@/lib/finance/money'
import type { PontoDePatrimonio } from '@/lib/finance/patrimonio'

/**
 * O patrimônio dos últimos meses: contas mais investimentos, menos a dívida
 * dos cartões.
 *
 * O número de cima é o de hoje; a linha mostra para onde ele vem andando. A
 * composição fica escrita embaixo do número, e não como mais um gráfico: são
 * três valores, e três valores se leem melhor como texto.
 */
export function Patrimonio({ pontos }: { pontos: PontoDePatrimonio[] }) {
  const hoje = pontos.at(-1)
  if (!hoje || pontos.length < 2) return null

  const inicio = pontos[0]!
  const variacao = hoje.totalCents - inicio.totalCents
  const desde = competenceLabel(inicio.competence).toLowerCase()

  const partes = [
    `Contas ${formatCents(hoje.contasCents)}`,
    hoje.investimentosCents !== 0 ? `investimentos ${formatCents(hoje.investimentosCents)}` : null,
    hoje.dividaCents > 0 ? `cartões −${formatCents(hoje.dividaCents)}` : null,
  ].filter(Boolean)

  return (
    <Card>
      <CardHeader
        title="Patrimônio"
        description="Tudo o que é seu menos o que você deve: contas e investimentos, menos a dívida dos cartões. Investimento conta pelo que entrou e saiu, sem o rendimento que não foi lançado."
      />
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Stat
            label="Hoje"
            value={formatCents(hoje.totalCents)}
            tone={hoje.totalCents < 0 ? 'negative' : undefined}
            hint={partes.join(' · ')}
          />
          <p className="text-fg-muted text-xs">
            {variacao === 0
              ? `Igual a ${desde}`
              : `${variacao > 0 ? '+' : '−'}${formatCents(Math.abs(variacao))} desde ${desde}`}
          </p>
        </div>
        <SaldoChart
          height={140}
          data={pontos.map((ponto) => ({
            label: competenceLabel(ponto.competence).slice(0, 3),
            saldoCents: ponto.totalCents,
            previsto: false,
          }))}
          descrever={(_, indice) => (indice === pontos.length - 1 ? 'hoje' : 'fim do mês')}
        />
      </CardContent>
    </Card>
  )
}
