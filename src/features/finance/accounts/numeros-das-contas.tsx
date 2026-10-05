import { PainelDeNumeros, Stat } from '@/components/ui/misc'
import { competenceLabel, type Competence } from '@/lib/finance/billing'
import { formatCents } from '@/lib/finance/money'
import type { FaturasAPagar } from '@/lib/finance/reports'

/**
 * Os três números do topo.
 *
 * O terceiro é o que a pessoa realmente quer saber: quanto sobra depois de
 * pagar os cartões. Saldo e fatura separados dão a impressão de folga que o
 * cartão ainda vai levar embora.
 *
 * As faturas somam a do mês e as que já venceram: a vencida não deixa de ser
 * dívida por ter virado o mês, e o "sobra" que a ignorasse prometia dinheiro
 * que já tinha dono.
 */
export function NumerosDasContas({
  saldo,
  faturas,
  competence,
}: {
  saldo: number
  faturas: FaturasAPagar
  competence: Competence
}) {
  const sobra = saldo - faturas.totalCents

  return (
    <PainelDeNumeros>
      <Stat
        label="Saldo total"
        value={formatCents(saldo)}
        tone={saldo < 0 ? 'negative' : undefined}
        hint="Soma das contas, sem cartões"
      />
      <Stat
        label="Faturas a pagar"
        value={formatCents(faturas.totalCents)}
        hint={
          faturas.vencidasCents > 0 ? (
            <>
              {formatCents(faturas.doMesCents)} de {competenceLabel(competence).toLowerCase()}
              <span className="text-negative">
                {' '}
                + {formatCents(faturas.vencidasCents)} em{' '}
                {faturas.vencidas === 1 ? 'fatura vencida' : `${faturas.vencidas} faturas vencidas`}
              </span>
            </>
          ) : (
            competenceLabel(competence)
          )
        }
      />
      <Stat
        label="Saldo após faturas"
        value={formatCents(sobra)}
        tone={sobra < 0 ? 'negative' : undefined}
        hint="O que sobra depois de pagar os cartões, vencidas inclusive"
      />
    </PainelDeNumeros>
  )
}
