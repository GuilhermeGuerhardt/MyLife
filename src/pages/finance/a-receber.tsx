/**
 * Quem te deve: a parte dos outros nas contas que você pagou.
 *
 * Esta tela compõe. As regras de agrupar por pessoa estão em
 * `lib/finance/a-receber`, as ações e os formulários em
 * `features/finance/a-receber`.
 */

import { Plus, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { EmptyState, PainelDeNumeros, SectionTitle, Stat } from '@/components/ui/misc'
import { PageHeader } from '@/components/ui/page-header'
import { useTransactions } from '@/data/queries'
import type { Receivable } from '@/data/types'
import { NovoAReceberForm, ReceberForm } from '@/features/finance/a-receber/formularios'
import { useAReceber } from '@/features/finance/a-receber/use-a-receber'
import { useFinance } from '@/features/finance/use-finance'
import { confirmar } from '@/lib/avisos'
import {
  emAbertoPorPessoa,
  pessoasConhecidas,
  recebidoEntre,
  totalEmAberto,
} from '@/lib/finance/a-receber'
import { competenceLabel, toCompetence } from '@/lib/finance/billing'
import { fimDoMes } from '@/lib/finance/saldo-por-mes'
import { formatCents } from '@/lib/finance/money'
import { relativeDay, shortDate } from '@/lib/format'
import { today } from '@/lib/utils'

export function AReceberPage() {
  const { itens, registrar, receber, desfazer, apagar } = useAReceber()
  const { data: lancamentos } = useTransactions()
  const finance = useFinance()
  const [anotando, setAnotando] = useState(false)
  const [recebendo, setRecebendo] = useState<Receivable[] | null>(null)

  const mes = toCompetence(today())
  const grupos = emAbertoPorPessoa(itens)
  const recebidos = itens
    .filter((item) => item.received_at)
    .sort((a, b) => b.received_at!.localeCompare(a.received_at!))
    .slice(0, 8)
  const contasDeDinheiro = finance.accounts.filter((conta) => conta.kind !== 'credit')

  async function aoApagar(item: Receivable) {
    const ok = await confirmar(`Apagar "${item.description}" de ${item.person}? A dívida some da lista.`, {
      confirmar: 'Apagar',
    })
    if (ok) await apagar(item.id)
  }

  async function aoDesfazer(item: Receivable) {
    const ok = await confirmar(
      'Desfazer o recebimento? A receita de reembolso sai do extrato e o valor volta a ficar em aberto.',
      { confirmar: 'Desfazer' },
    )
    if (ok) await desfazer(item)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="A receber"
        description="A parte dos outros nas contas que você pagou. A despesa fica inteira no extrato; quando o dinheiro volta, entra como reembolso."
        action={
          <Button onClick={() => setAnotando(true)}>
            <Plus />
            <span className="max-sm:sr-only">Alguém me deve</span>
          </Button>
        }
      />

      <PainelDeNumeros>
        <Stat label="Em aberto" value={formatCents(totalEmAberto(itens))} />
        <Stat label="Pessoas" value={String(grupos.length)} />
        <Stat
          label="Recebido no mês"
          value={formatCents(recebidoEntre(itens, `${mes}-01`, fimDoMes(mes)))}
          hint={competenceLabel(mes)}
        />
      </PainelDeNumeros>

      {grupos.length === 0 ? (
        <Card>
          <EmptyState
            title="Ninguém te deve nada"
            description="Pagou a conta do jantar e cada um vai te mandar a parte? Anote aqui e o app lembra de quem falta."
            action={
              <Button size="sm" onClick={() => setAnotando(true)}>
                Alguém me deve
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {grupos.map((grupo) => (
            <Card key={grupo.chave}>
              <CardHeader
                title={grupo.nome}
                description={`${formatCents(grupo.totalCents)} · desde ${shortDate(grupo.itens[0]!.date)} (${relativeDay(grupo.itens[0]!.date)})`}
                action={
                  <Button variant="secondary" size="sm" onClick={() => setRecebendo(grupo.itens)}>
                    {grupo.itens.length > 1 ? 'Recebi tudo' : 'Recebi'}
                  </Button>
                }
              />
              <ul className="divide-border-base mt-3 divide-y border-t">
                {grupo.itens.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-fg truncate text-sm">{item.description}</p>
                      <p className="text-fg-subtle text-xs">{shortDate(item.date)}</p>
                    </div>
                    <span className="text-fg text-sm font-medium tabular-nums">
                      {formatCents(item.amount_cents)}
                    </span>
                    {grupo.itens.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => setRecebendo([item])}>
                        Recebi
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => void aoApagar(item)}
                      className="text-fg-subtle hover:text-negative transition-colors"
                      aria-label={`Apagar ${item.description}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {recebidos.length > 0 && (
        <div>
          <SectionTitle>Recebidos</SectionTitle>
          <Card>
            <ul className="divide-border-base divide-y">
              {recebidos.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-fg-muted truncate text-sm">
                      {item.person} · {item.description}
                    </p>
                    <p className="text-fg-subtle text-xs">recebido {shortDate(item.received_at!)}</p>
                  </div>
                  <span className="text-fg-muted text-sm tabular-nums">
                    {formatCents(item.amount_cents)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void aoDesfazer(item)}
                    className="text-fg-subtle hover:text-fg transition-colors"
                    aria-label={`Desfazer o recebimento de ${item.description}`}
                    title="Desfazer"
                  >
                    <Undo2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {anotando && (
        <NovoAReceberForm
          despesas={lancamentos}
          pessoas={pessoasConhecidas(itens)}
          onClose={() => setAnotando(false)}
          onSave={async (novo) => {
            await registrar(novo)
            setAnotando(false)
          }}
        />
      )}

      {recebendo && (
        <ReceberForm
          itens={recebendo}
          contas={contasDeDinheiro}
          onClose={() => setRecebendo(null)}
          onConfirm={async (contaId, data) => {
            await receber(recebendo, contaId, data)
            setRecebendo(null)
          }}
        />
      )}
    </div>
  )
}
