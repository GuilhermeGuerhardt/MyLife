import { ArrowRight } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge, Segmented, Stat } from '@/components/ui/misc'
import type { Account, Category, Transaction } from '@/data/types'
import { TransactionList } from '@/features/finance/lista-de-lancamentos'
import { formatCents } from '@/lib/finance/money'
import type { OpenMonthSummary } from '@/lib/finance/open-month'
import type { PendingOccurrence } from '@/lib/finance/recurring'
import type { OpenInvoice } from '@/lib/finance/reports'
import { FaturasAVencer } from './faturas-a-vencer'
import { RecorrentesALancar } from './recorrentes-a-lancar'

/**
 * Os lançamentos do mês, em duas leituras.
 *
 * "Últimos" é o retrovisor e "Ainda esse mês" é o que vem pela frente. A aba
 * escolhida fica lembrada entre visitas: quem acompanha o mês pelo que falta
 * não quer reescolher isso toda vez que abre a tela.
 */

/** Onde a aba escolhida do painel fica lembrada. */
const CHAVE = 'life:financeiro-painel'

type Aba = 'latest' | 'open'

function lerAba(): Aba {
  try {
    return localStorage.getItem(CHAVE) === 'open' ? 'open' : 'latest'
  } catch {
    // Navegador com armazenamento bloqueado: vale o padrão.
    return 'latest'
  }
}

function useAba(): [Aba, (aba: Aba) => void] {
  const [aba, setAba] = useState<Aba>(lerAba)

  const escolher = useCallback((nova: Aba) => {
    setAba(nova)
    try {
      localStorage.setItem(CHAVE, nova)
    } catch {
      // Sem armazenamento a escolha vale só nesta visita.
    }
  }, [])

  return [aba, escolher]
}


/** O que dizer quando não há lançamento em aberto, mas o mês ainda cobra algo. */
function textoDoVazio(faturas: number, recorrentes: number): string {
  if (faturas > 0 && recorrentes > 0) return 'Faltam a fatura e as recorrentes abaixo.'
  if (faturas > 0) return 'Só falta a fatura do cartão, abaixo.'
  if (recorrentes > 0) return 'Só faltam as recorrentes abaixo.'
  return 'Tudo deste mês já está pago.'
}

export function PainelDoMes({
  doMes,
  emAberto,
  faturas,
  resumoAberto,
  pendentes,
  contas,
  categoriaPorId,
  onEditar,
  onMarcarPago,
  onLancarRecorrentes,
}: {
  doMes: Transaction[]
  emAberto: Transaction[]
  /** Faturas de cartão que vencem no mês — o que o cartão vai cobrar nele. */
  faturas: OpenInvoice[]
  resumoAberto: OpenMonthSummary
  pendentes: PendingOccurrence[]
  contas: Account[]
  categoriaPorId: Map<string, Category>
  onEditar: (transaction: Transaction) => void
  onMarcarPago: (transaction: Transaction, pago: boolean) => void
  onLancarRecorrentes: (pendentes: PendingOccurrence[]) => Promise<unknown>
}) {
  const [aba, setAba] = useAba()

  return (
    <div className="lg:col-span-2">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={aba}
          onChange={setAba}
          options={[
            { value: 'latest' as const, label: 'Últimos lançamentos' },
            {
              value: 'open' as const,
              label:
                resumoAberto.count > 0
                  ? `Ainda esse mês (${resumoAberto.count})`
                  : 'Ainda esse mês',
            },
          ]}
        />
        <Link to="/financeiro/transacoes">
          <Button variant="ghost" size="sm">
            Ver todos <ArrowRight />
          </Button>
        </Link>
      </div>

      {aba === 'latest' ? (
        <Card>
          <TransactionList
            transactions={doMes.slice(0, 8)}
            accounts={contas}
            categoryById={categoriaPorId}
            onEdit={onEditar}
            onSetPaid={onMarcarPago}
            emptyTitle="Nada lançado neste mês"
            emptyDescription='Use o botão acima ou o registro rápido (Ctrl+K): "gastei 35 no mercado".'
          />
        </Card>
      ) : (
        <Card>
          {resumoAberto.count > 0 && (
            <div className="border-border-base flex flex-wrap items-end gap-x-8 gap-y-3 border-b px-5 py-4">
              <Stat
                label="A pagar"
                value={formatCents(resumoAberto.toPayCents)}
                tone={resumoAberto.toPayCents > 0 ? 'negative' : undefined}
              />
              <Stat
                label="A receber"
                value={formatCents(resumoAberto.toReceiveCents)}
              />
              <Stat
                label="Saldo do que falta"
                value={`${resumoAberto.balanceCents < 0 ? '−' : '+'}${formatCents(
                  Math.abs(resumoAberto.balanceCents),
                )}`}
                tone={resumoAberto.balanceCents < 0 ? 'negative' : undefined}
              />
              {resumoAberto.overdueCount > 0 && (
                <div className="ml-auto">
                  <Badge tone="negative">
                    {resumoAberto.overdueCount} vencido
                    {resumoAberto.overdueCount === 1 ? '' : 's'}
                  </Badge>
                </div>
              )}
            </div>
          )}

          <TransactionList
            transactions={emAberto}
            accounts={contas}
            categoryById={categoriaPorId}
            onEdit={onEditar}
            onSetPaid={onMarcarPago}
            emptyTitle={
              pendentes.length > 0 || faturas.length > 0
                ? 'Nenhum lançamento em aberto'
                : 'Nada em aberto'
            }
            emptyDescription={textoDoVazio(faturas.length, pendentes.length)}
          />

          <FaturasAVencer faturas={faturas} contas={contas} />

          <RecorrentesALancar
            pendentes={pendentes}
            categoriaPorId={categoriaPorId}
            onLancarTodas={onLancarRecorrentes}
          />
        </Card>
      )}
    </div>
  )
}
