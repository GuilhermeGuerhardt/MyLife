import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CaixaDeSelecao } from '@/components/ui/caixa-de-selecao'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'
import { useRecurring } from '@/data/queries'
import { formatCents } from '@/lib/finance/money'
import { competenceLabel, toCompetence } from '@/lib/finance/billing'
import { chaveDoPadrao, type RecorrenteSugerida } from '@/lib/finance/recorrentes-do-extrato'
import { cn } from '@/lib/utils'

/**
 * O que o extrato mostrou que se repete todo mês.
 *
 * Aparece depois da importação, com as caixas desmarcadas: criar regra é
 * decisão, não efeito colateral de abrir um arquivo. O app sabe reconhecer o
 * padrão, mas quem sabe se o aluguel vai continuar é você.
 *
 * Cada regra sugerida começa no mês seguinte ao último que veio no arquivo —
 * sem isso ela recriaria em seguida o lançamento que acabou de ser importado.
 */
export function RecorrentesSugeridas({
  sugestoes,
  contaPorRotulo,
}: {
  sugestoes: RecorrenteSugerida[]
  /** De que conta é cada rótulo do arquivo, como a importação resolveu. */
  contaPorRotulo: (rotulo: string) => string | null
}) {
  const { data: existentes, create } = useRecurring()
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set())
  const [criadas, setCriadas] = useState(0)
  const [criando, setCriando] = useState(false)

  // Regra que já existe não volta a ser oferecida: importar o mesmo extrato de
  // novo não pode encher a tela de recorrentes repetidas.
  const jaCadastradas = new Set(
    existentes.map((regra) => `${regra.kind}:${chaveDoPadrao(regra.description)}`),
  )

  const novas = sugestoes.filter(
    (sugestao) =>
      !jaCadastradas.has(`${sugestao.kind}:${chaveDoPadrao(sugestao.description)}`) &&
      contaPorRotulo(sugestao.accountLabel) !== null,
  )

  if (criadas > 0) {
    return (
      <Card>
        <CardContent className="text-fg text-sm">
          {criadas} recorrente{criadas === 1 ? '' : 's'} criada{criadas === 1 ? '' : 's'}. Elas
          aparecem como pendentes no mês, para você confirmar — nada é lançado sozinho.
        </CardContent>
      </Card>
    )
  }

  if (novas.length === 0) return null

  async function criar() {
    setCriando(true)
    let feitas = 0

    for (const sugestao of novas) {
      if (!escolhidas.has(chave(sugestao))) continue
      const contaId = contaPorRotulo(sugestao.accountLabel)
      if (!contaId) continue

      await create.mutateAsync({
        description: sugestao.description,
        account_id: contaId,
        category_id: null,
        kind: sugestao.kind,
        amount_cents: sugestao.amountCents,
        day_of_month: sugestao.dayOfMonth,
        start_date: sugestao.startDate,
        // Parcela tem fim: a regra para sozinha depois da última.
        end_date: sugestao.endDate,
        active: true,
      })
      feitas++
    }

    setCriadas(feitas)
    setCriando(false)
  }

  return (
    <Card>
      <CardHeader
        title="Isto parece se repetir todo mês"
        description="Virar recorrente é opcional: a regra fica pendente no mês e só vira lançamento quando você confirma."
      />
      <CardContent className="space-y-3">
        <div className="divide-border-base border-border-base divide-y rounded-lg border">
          {novas.map((sugestao) => {
            const id = chave(sugestao)
            const marcada = escolhidas.has(id)

            return (
              <div
                key={id}
                className={cn('flex items-center gap-3 px-4 py-3', !marcada && 'opacity-70')}
              >
                {/* A descrição é o rótulo da caixa: clicar no texto marca, como antes. */}
                <CaixaDeSelecao
                  checked={marcada}
                  aria-label={`Criar recorrente: ${sugestao.description}`}
                  className="min-w-0 flex-1"
                  onChange={() =>
                    setEscolhidas((atual) => {
                      const proximo = new Set(atual)
                      if (proximo.has(id)) proximo.delete(id)
                      else proximo.add(id)
                      return proximo
                    })
                  }
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-fg block truncate text-sm">{sugestao.description}</span>
                    <span className="text-fg-subtle block text-xs">
                      Todo dia {sugestao.dayOfMonth} · apareceu em {sugestao.meses} meses
                      {sugestao.parcela && sugestao.endDate
                        ? ` · parcela ${sugestao.parcela.atual} de ${sugestao.parcela.total}, até ${competenceLabel(toCompetence(sugestao.endDate)).toLowerCase()}`
                        : ''}
                    </span>
                  </span>
                </CaixaDeSelecao>

                {sugestao.valorVaria && <Badge tone="neutral">valor varia</Badge>}

                <span className="text-fg text-sm font-medium">
                  {formatCents(sugestao.amountCents)}
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-fg-subtle text-xs">
            Começam a valer no mês seguinte ao último do arquivo, para não repetir o que você
            acabou de importar.
          </p>
          <Button onClick={() => void criar()} disabled={criando || escolhidas.size === 0}>
            {criando ? 'Criando…' : `Criar ${escolhidas.size || ''}`.trim()}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function chave(sugestao: RecorrenteSugerida): string {
  return `${sugestao.kind}:${chaveDoPadrao(sugestao.description)}`
}
