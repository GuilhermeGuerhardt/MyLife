import { Copy, PiggyBank, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, EmptyState, Progress, SectionTitle } from '@/components/ui/misc'
import { CategoryIcon } from '@/features/finance/category-icons'
import { InputDeDinheiro } from '@/features/finance/input-de-dinheiro'
import type { useFinance } from '@/features/finance/use-finance'
import { centsToInput, formatCents, parseAmount } from '@/lib/finance/money'

type Envelope = ReturnType<typeof useFinance>['budgets'][number]

/**
 * Os envelopes do mês: um limite por categoria.
 *
 * O limite se edita no próprio cartão, sem abrir formulário — é o ajuste que
 * mais acontece, e vale a pena ser um clique. A gravação é no `blur`, para não
 * escrever a cada tecla.
 */
export function Envelopes({
  envelopes,
  podeCriar,
  onCriar,
  onCopiarMesAnterior,
  onTrocarLimite,
  onRemover,
}: {
  envelopes: Envelope[]
  podeCriar: boolean
  onCriar: () => void
  onCopiarMesAnterior: () => void
  onTrocarLimite: (id: string, centavos: number) => void
  onRemover: (id: string) => void
}) {
  return (
    <div>
      <SectionTitle
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onCopiarMesAnterior}>
              <Copy />
              Copiar mês anterior
            </Button>
            <Button size="sm" onClick={onCriar} disabled={!podeCriar}>
              <Plus />
              Envelope
            </Button>
          </div>
        }
      >
        Envelopes
      </SectionTitle>

      {envelopes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PiggyBank className="size-6" />}
            title="Nenhum envelope neste mês"
            description="Defina um limite para as categorias que costumam fugir do controle — delivery e lazer são os suspeitos de sempre."
            action={
              <Button size="sm" onClick={onCriar}>
                Criar envelope
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {envelopes.map(({ budget, category, progress }) => (
            <Card key={budget.id}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `${category?.color ?? '#71717a'}1f` }}
                    >
                      <CategoryIcon icon={category?.icon} color={category?.color} />
                    </span>
                    <div>
                      <p className="text-fg text-sm font-medium">{category?.name ?? 'Categoria'}</p>
                      <p className="text-fg-subtle text-xs">
                        {formatCents(progress.spent)} de {formatCents(progress.limit)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemover(budget.id)}
                    className="text-fg-subtle hover:text-negative transition-colors"
                    aria-label="Remover envelope"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                <Progress
                  value={progress.percent}
                  tone={
                    progress.status === 'exceeded'
                      ? 'negative'
                      : progress.status === 'warning'
                        ? 'warning'
                        : 'accent'
                  }
                />

                <div className="flex items-center justify-between">
                  <Badge
                    tone={
                      progress.status === 'exceeded'
                        ? 'negative'
                        : progress.status === 'warning'
                          ? 'warning'
                          : 'positive'
                    }
                  >
                    {progress.status === 'exceeded'
                      ? `${formatCents(Math.abs(progress.remaining))} acima`
                      : `${formatCents(progress.remaining)} disponíveis`}
                  </Badge>
                  <LimiteDoEnvelope
                    centavos={progress.limit}
                    rotulo={`Limite de ${category?.name}`}
                    onGravar={(centavos) => onTrocarLimite(budget.id, centavos)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * O limite de um envelope, editado no próprio cartão.
 *
 * Fica controlado para a máscara poder reescrever o texto a cada tecla, e o
 * efeito mantém o campo em dia quando o valor muda por fora — ao trocar de mês
 * ou ao copiar os envelopes do mês anterior.
 */
function LimiteDoEnvelope({
  centavos,
  rotulo,
  onGravar,
}: {
  centavos: number
  rotulo: string
  onGravar: (centavos: number) => void
}) {
  const [texto, setTexto] = useState(() => centsToInput(centavos))

  useEffect(() => setTexto(centsToInput(centavos)), [centavos])

  return (
    <InputDeDinheiro
      className="h-8 w-28 text-right text-xs"
      aria-label={rotulo}
      value={texto}
      onChange={setTexto}
      onBlur={() => onGravar(parseAmount(texto))}
    />
  )
}
