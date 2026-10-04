import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CaixaDeSelecao } from '@/components/ui/caixa-de-selecao'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { Badge } from '@/components/ui/misc'
import { useRecurring, useTransactions } from '@/data/queries'
import type { Account, Category, Transaction } from '@/data/types'
import { competenceLabel, toCompetence } from '@/lib/finance/billing'
import { formatCents } from '@/lib/finance/money'
import {
  propostaDaBusca,
  recorrentesNoHistorico,
  type LancamentoDoHistorico,
  type RecorrenteDoHistorico,
} from '@/lib/finance/recorrentes-do-extrato'
import { today } from '@/lib/utils'
import { RecurringForm, type RecurringDraft } from './recurring-form'

function paraHistorico(lancamento: Transaction): LancamentoDoHistorico {
  return {
    id: lancamento.id,
    description: lancamento.description,
    amountCents: lancamento.amount_cents,
    date: lancamento.date,
    kind: lancamento.kind,
    account_id: lancamento.account_id,
    category_id: lancamento.category_id,
    installment_group_id: lancamento.installment_group_id,
    recurring_id: lancamento.recurring_id,
  }
}

function paraRegra(achado: RecorrenteDoHistorico): RecurringDraft {
  return {
    description: achado.description,
    account_id: achado.accountId,
    category_id: achado.categoryId,
    kind: achado.kind,
    amount_cents: achado.amountCents,
    day_of_month: achado.dayOfMonth,
    start_date: achado.startDate,
    end_date: achado.endDate,
    active: true,
  }
}

const mesEAno = (data: string) => competenceLabel(toCompetence(data)).toLowerCase()

/**
 * O que se repete nos lançamentos já gravados e ainda não tem regra.
 *
 * Existe porque a sugestão da importação só enxerga o arquivo do momento: quem
 * importou em pedaços, ou antes de a detecção saber ler parcela, ficava com a
 * parcela da construtora solta para sempre. Aqui a procura é no histórico
 * inteiro, a qualquer hora.
 *
 * E quando nem isso acha, a busca pela descrição monta a regra com o que
 * encontrar, para a pessoa conferir no formulário.
 */
export function RecorrentesDoHistorico({
  contas,
  categorias,
}: {
  contas: Account[]
  categorias: Category[]
}) {
  const { data: lancamentos, updateMany } = useTransactions()
  const { data: regras, create } = useRecurring()
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set())
  const [criando, setCriando] = useState(false)
  const [termo, setTermo] = useState('')
  const [revisando, setRevisando] = useState<RecorrenteDoHistorico | null>(null)

  const historico = useMemo(() => lancamentos.map(paraHistorico), [lancamentos])
  const achados = useMemo(
    () => recorrentesNoHistorico(historico, regras, today()),
    [historico, regras],
  )
  const proposta = useMemo(() => propostaDaBusca(historico, termo), [historico, termo])

  /**
   * Cria a regra e liga a ela os lançamentos que a originaram.
   *
   * A ligação é o que impede a mesma conta de voltar como sugestão, mesmo que a
   * pessoa tenha dado à regra um nome diferente do extrato.
   */
  async function criarRegra(rascunho: RecurringDraft, origem: LancamentoDoHistorico[]) {
    const regra = await create.mutateAsync(rascunho)
    await updateMany(origem.map((item) => ({ id: item.id, patch: { recurring_id: regra.id } })))
  }

  async function criarEscolhidos() {
    setCriando(true)
    try {
      for (const achado of achados) {
        if (escolhidos.has(chave(achado))) await criarRegra(paraRegra(achado), achado.ocorrencias)
      }
      setEscolhidos(new Set())
    } finally {
      setCriando(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Achados no seu histórico"
        description="O que se repete nos lançamentos que você já tem e ainda não virou regra, inclusive parcela de financiamento, que ganha data para acabar."
      />
      <CardContent className="space-y-4">
        {achados.length === 0 ? (
          <p className="text-fg-muted text-sm">
            Nada novo se repete no histórico. Se alguma conta mensal ficou de fora, procure pela
            descrição logo abaixo.
          </p>
        ) : (
          <>
            <ul className="divide-border-base border-border-base divide-y rounded-lg border">
              {achados.map((achado) => {
                const id = chave(achado)
                const conta = contas.find((item) => item.id === achado.accountId)
                return (
                  <li key={id} className="flex items-center gap-3 px-4 py-3">
                    <CaixaDeSelecao
                      checked={escolhidos.has(id)}
                      aria-label={`Criar recorrente: ${achado.description}`}
                      onChange={(marcada) =>
                        setEscolhidos((atual) => {
                          const proximo = new Set(atual)
                          if (marcada) proximo.add(id)
                          else proximo.delete(id)
                          return proximo
                        })
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-fg truncate text-sm">{achado.description}</p>
                      <p className="text-fg-subtle truncate text-xs">
                        {[
                          `todo dia ${achado.dayOfMonth}`,
                          `${achado.meses} meses`,
                          conta?.name,
                          achado.parcela && achado.endDate
                            ? `parcela ${achado.parcela.atual} de ${achado.parcela.total}, até ${mesEAno(achado.endDate)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    {achado.valorVaria && <Badge tone="neutral">valor varia</Badge>}
                    <span className="text-fg text-sm font-medium tabular-nums">
                      {formatCents(achado.amountCents)}
                    </span>
                  </li>
                )
              })}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-fg-subtle text-xs">
                Começam no mês seguinte ao último lançamento, para não repetir o que já está lá.
              </p>
              <Button
                onClick={() => void criarEscolhidos()}
                disabled={criando || escolhidos.size === 0}
              >
                {criando ? 'Criando…' : `Criar ${escolhidos.size || ''}`.trim()}
              </Button>
            </div>
          </>
        )}

        <div className="border-border-base space-y-2 border-t pt-4">
          <Field label="Não achou? Procure pela descrição">
            <Input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="moto, construtora, financiamento…"
              className="pl-9"
            />
            <Search className="text-fg-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          </Field>

          {termo.trim().length >= 2 &&
            (proposta ? (
              <div className="bg-surface-2 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3">
                <div className="min-w-0">
                  <p className="text-fg truncate text-sm">{proposta.description}</p>
                  <p className="text-fg-subtle text-xs">
                    {[
                      `${proposta.meses} ${proposta.meses === 1 ? 'mês' : 'meses'}, de ${mesEAno(proposta.ocorrencias[0]!.date)} a ${mesEAno(proposta.ocorrencias.at(-1)!.date)}`,
                      `dia ${proposta.dayOfMonth}`,
                      formatCents(proposta.amountCents),
                      proposta.parcela
                        ? `parcela ${proposta.parcela.atual} de ${proposta.parcela.total}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setRevisando(proposta)}>
                  Revisar e criar
                </Button>
              </div>
            ) : (
              <p className="text-fg-muted text-xs">Nenhum lançamento com “{termo.trim()}”.</p>
            ))}
        </div>
      </CardContent>

      {revisando && (
        <RecurringForm
          initial={null}
          rascunho={paraRegra(revisando)}
          accounts={contas}
          categories={categorias}
          onClose={() => setRevisando(null)}
          onRemove={null}
          onSave={async (rascunho) => {
            await criarRegra(rascunho, revisando.ocorrencias)
            setRevisando(null)
            setTermo('')
          }}
        />
      )}
    </Card>
  )
}

function chave(achado: RecorrenteDoHistorico): string {
  return `${achado.kind}:${achado.accountId}:${achado.amountCents}:${achado.description}`
}
