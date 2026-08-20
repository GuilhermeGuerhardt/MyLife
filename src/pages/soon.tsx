import { BookOpen, GraduationCap, Wallet, type LucideIcon } from 'lucide-react'
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

export function EducationSoon() {
  return (
    <ModulePreview
      icon={GraduationCap}
      title="Faculdade"
      phase="Fase 3"
      intro="Várias instituições em paralelo, grade curricular com pré-requisitos e o cálculo automático do que ainda falta para formar."
      groups={[
        {
          name: 'Curso e grade',
          items: [
            'Instituições e cursos (graduação, pós, técnico), com carga horária total e semestre atual',
            'Grade curricular com créditos, pré-requisitos e status por disciplina',
            'Progresso em % e tela "o que falta", incluindo horas complementares, estágio e TCC',
            'Histórico com CR/CRA calculado',
          ],
        },
        {
          name: 'Semestre em andamento',
          items: [
            'Notas por avaliação com peso e média parcial',
            'Controle de faltas com o limite de 25%: "você pode faltar mais 3 aulas"',
            'Simulador: "preciso de 6,5 na final para passar"',
            'Grade de horários semanal e calendário de provas e entregas',
          ],
        },
        {
          name: 'Anotações e resumos',
          items: [
            'Editor Markdown com upload de PDF e imagem, vinculado à disciplina',
            'Tags e busca full-text em português direto no Postgres',
            'Flashcards com repetição espaçada gerados a partir dos resumos',
          ],
        },
        {
          name: 'Integrações',
          items: [
            'Provas e entregas aparecem no dashboard e no calendário unificado',
            'Mensalidade lançada como despesa recorrente no módulo financeiro',
            'Export das anotações em Markdown ou PDF',
          ],
        },
      ]}
    />
  )
}

export function CoursesSoon() {
  return (
    <ModulePreview
      icon={BookOpen}
      title="Cursos"
      phase="Fase 3"
      intro="Mesma estrutura da faculdade, adaptada a cursos livres — Udemy, Alura, YouTube ou qualquer trilha própria."
      groups={[
        {
          name: 'Catálogo',
          items: [
            'Plataforma, instrutor, link, carga horária e custo',
            'Trilhas agrupando cursos por objetivo ("Back-end Node", "Inglês")',
            'Avaliação pessoal e status (fazendo, pausado, concluído, abandonado)',
          ],
        },
        {
          name: 'Progresso',
          items: [
            'Módulos e aulas com percentual automático',
            '"Próxima aula" fixada no dashboard',
            'Ritmo necessário para bater o prazo: "2 aulas/dia para terminar até 30/09"',
            'Certificado salvo no Storage com data de conclusão',
          ],
        },
        {
          name: 'Estudo',
          items: [
            'Anotações e flashcards reaproveitando o módulo da faculdade',
            'Tempo de estudo registrado e somado aos hábitos',
          ],
        },
        {
          name: 'Integrações',
          items: [
            'Custo do curso vira despesa no financeiro',
            'Meta anual de cursos concluídos alimentada automaticamente',
          ],
        },
      ]}
    />
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
