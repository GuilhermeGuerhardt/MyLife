import { Wallet, type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'

/**
 * Módulos das próximas fases. Em vez de um "em breve" vazio, cada tela lista o
 * escopo já definido — serve de referência enquanto o módulo não existe.
 */
function ModulePreview({
  icon: Icon,
  title,
  phase,
  intro,
  groups,
}: {
  icon: LucideIcon
  title: string
  phase: string
  intro: string
  groups: Array<{ name: string; items: string[] }>
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="bg-accent-soft text-accent flex size-11 shrink-0 items-center justify-center rounded-xl">
          <Icon className="size-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-fg text-xl font-semibold">{title}</h1>
            <Badge tone="accent">{phase}</Badge>
          </div>
          <p className="text-fg-muted mt-1 max-w-2xl text-sm">{intro}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <Card key={group.name}>
            <CardContent className="space-y-3">
              <h2 className="text-fg text-sm font-semibold">{group.name}</h2>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li key={item} className="text-fg-muted flex gap-2.5 text-xs leading-relaxed">
                    <span className="bg-accent mt-1.5 size-1 shrink-0 rounded-full" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function FinanceSoon() {
  return (
    <ModulePreview
      icon={Wallet}
      title="Financeiro"
      phase="Fase 2"
      intro="Controle de gastos que bate com a realidade: fatura de cartão por competência, parcelas e recorrentes tratadas como o banco trata."
      groups={[
        {
          name: 'Lançamentos',
          items: [
            'Contas: corrente, poupança, carteira, cartão e investimento',
            'Receitas, despesas e transferências com categoria, subcategoria e tags',
            'Compras parceladas geram N parcelas de uma vez',
            'Fatura de cartão fechada por competência (fechamento/vencimento), não pela data da compra',
            'Recorrentes (aluguel, assinaturas, mensalidade) geradas automaticamente',
          ],
        },
        {
          name: 'Planejamento',
          items: [
            'Orçamento mensal por categoria, com alerta em 80% e 100%',
            'Metas de economia com aporte, prazo e projeção de chegada',
            'Dívidas com juros e simulador de quitação',
          ],
        },
        {
          name: 'Relatórios',
          items: [
            'Fluxo de caixa mensal e comparativo mês a mês',
            'Gastos por categoria e maiores despesas',
            'Taxa de poupança e evolução do patrimônio',
          ],
        },
        {
          name: 'Automação',
          items: [
            'Importação de extrato OFX e CSV com deduplicação',
            'Regras de categorização automática ("contém IFOOD → Delivery")',
            'Registro por texto: "gastei 35 no mercado" no Ctrl+K',
          ],
        },
      ]}
    />
  )
}
