import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/misc'
import { useTransactions } from '@/data/queries'
import type { Account } from '@/data/types'
import { competenceLabel, toCompetence } from '@/lib/finance/billing'
import { formatCents } from '@/lib/finance/money'
import {
  parcelamentosEmAndamento,
  parcelasDoMes,
  type Parcelamento,
} from '@/lib/finance/parcelamentos'
import { shortDate } from '@/lib/format'
import { today } from '@/lib/utils'

export const mesEAno = (data: string) => competenceLabel(toCompetence(data)).toLowerCase()

/** "por mês", "por ano", "a cada 3 meses". */
export function frequencia(intervaloMeses: number): string {
  if (intervaloMeses === 1) return 'por mês'
  if (intervaloMeses === 12) return 'por ano'
  return `a cada ${intervaloMeses} meses`
}

/** A linha de apoio de um parcelamento: valor, próxima parcela e até quando vai. */
export function resumoDoParcelamento(item: Parcelamento): string {
  return [
    `${formatCents(item.proxima?.valorCents ?? 0)} ${frequencia(item.intervaloMeses)}`,
    item.proxima
      ? `próxima ${shortDate(item.proxima.date)}, parcela ${item.proxima.numero} de ${item.total}`
      : null,
    `até ${mesEAno(item.ultimaData)}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Os parcelamentos em andamento, ao lado das regras recorrentes.
 *
 * Não são regras, e por isso não ficam na mesma lista: as parcelas já estão
 * lançadas, uma por mês, e não há nada para confirmar. Mas é aqui que a pessoa
 * procura "o que eu pago todo mês", e a moto em 48 vezes tem de estar à vista.
 */
export function Parcelamentos({ contas }: { contas: Account[] }) {
  const { data: lancamentos } = useTransactions()
  const lista = useMemo(() => parcelamentosEmAndamento(lancamentos), [lancamentos])
  const doMes = useMemo(() => parcelasDoMes(lancamentos, today()), [lancamentos])

  if (lista.length === 0) return null

  return (
    <div>
      <SectionTitle
        action={
          doMes > 0 && (
            <span className="text-fg-muted text-xs">
              Parcelas deste mês: <span className="text-fg">{formatCents(doMes)}</span>
            </span>
          )
        }
      >
        Parcelamentos
      </SectionTitle>
      <Card>
        <ul className="divide-border-base divide-y">
          {lista.map((item) => {
            const conta = contas.find((c) => c.id === item.accountId)
            return (
              <li key={item.grupo} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-fg truncate text-sm">{item.description}</p>
                  <p className="text-fg-subtle truncate text-xs">
                    {resumoDoParcelamento(item)}
                    {conta ? ` · ${conta.name}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-fg text-sm font-medium tabular-nums">
                    {formatCents(item.restanteCents)}
                  </p>
                  <p className="text-fg-subtle text-xs">
                    faltam {item.restantes} {item.restantes === 1 ? 'parcela' : 'parcelas'}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
