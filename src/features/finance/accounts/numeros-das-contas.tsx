import { PainelDeNumeros, Stat } from '@/components/ui/misc'
import { competenceLabel, type Competence } from '@/lib/finance/billing'
import { formatCents } from '@/lib/finance/money'

/**
 * Os três números do topo.
 *
 * O terceiro é o que a pessoa realmente quer saber: quanto sobra depois de
 * pagar os cartões. Saldo e fatura separados dão a impressão de folga que o
 * cartão ainda vai levar embora.
 */
export function NumerosDasContas({
  saldo,
  faturas,
  competence,
}: {
  saldo: number
  faturas: number
  competence: Competence
}) {
  const sobra = saldo - faturas

  return (
    <PainelDeNumeros>
      <Stat
        label="Saldo total"
        value={formatCents(saldo)}
        tone={saldo < 0 ? 'negative' : undefined}
        hint="Soma das contas, sem cartões"
      />
      <Stat label="Faturas do mês" value={formatCents(faturas)} hint={competenceLabel(competence)} />
      <Stat
        label="Saldo após faturas"
        value={formatCents(sobra)}
        tone={sobra < 0 ? 'negative' : undefined}
        hint="O que sobra depois de pagar os cartões"
      />
    </PainelDeNumeros>
  )
}
