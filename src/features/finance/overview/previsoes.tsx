import { Link } from 'react-router-dom'
import { CardContent } from '@/components/ui/card'
import { Carrossel, type Slide } from '@/components/ui/carrossel'
import { Progress } from '@/components/ui/misc'
import type { AccountCheck, Receivable } from '@/data/types'
import { CategoryIcon } from '@/features/finance/category-icons'
import type { useFinance } from '@/features/finance/use-finance'
import { emAbertoPorPessoa, totalEmAberto } from '@/lib/finance/a-receber'
import { competenceLabel, type Competence } from '@/lib/finance/billing'
import { lastCheck, needsCheck, unchecked, daysSinceCheck } from '@/lib/finance/conferencia'
import { formatCents } from '@/lib/finance/money'
import { commitmentProjection, openInvoices } from '@/lib/finance/reports'
import { longDate, percent, relativeDay } from '@/lib/format'
import { today } from '@/lib/utils'
import { CompromissoFuturo } from './compromisso-futuro'

/** Um ano à frente: o horizonte de um parcelamento comum. */
const MESES_A_FRENTE = 12

type Financeiro = ReturnType<typeof useFinance>

/**
 * O que vem pela frente, um painel por vez.
 *
 * São perguntas que a pessoa faz de vez em quando — quanto já está comprometido,
 * qual fatura vem agora, quanto deve sobrar, qual envelope estourou — e que não
 * cabem como sete cartões fixos: a tela viraria um painel de aeroporto e o olho
 * aprenderia a pular tudo.
 *
 * Cada painel só existe quando tem o que dizer. Num app recém-instalado o
 * carrossel inteiro some, em vez de mostrar sete caixas vazias.
 */
export function Previsoes({
  finance,
  conferencias,
  saldoPrevisto,
  competence,
  aReceber,
}: {
  finance: Financeiro
  conferencias: AccountCheck[]
  /** O que os outros te devem. */
  aReceber: Receivable[]
  /** Saldo de hoje mais o que falta entrar e sair no mês. */
  saldoPrevisto: number
  competence: Competence
}) {
  const slides: Slide[] = []

  const comprometido = commitmentProjection(finance.transactions, competence, MESES_A_FRENTE)
  if (comprometido.total > 0) {
    slides.push({
      id: 'comprometido',
      titulo: 'Comprometido',
      conteudo: <CompromissoFuturo projecao={comprometido} meses={MESES_A_FRENTE} />,
    })
  }

  const proximaFatura = openInvoices(finance.accounts, finance.transactions)[0]
  if (proximaFatura) {
    const cartao = finance.accounts.find((conta) => conta.id === proximaFatura.accountId)
    slides.push({
      id: 'fatura',
      titulo: 'Próxima fatura',
      conteudo: (
        <Painel
          rotulo={`Próxima fatura · ${cartao?.name ?? 'cartão'}`}
          valor={formatCents(proximaFatura.totalCents)}
          apoio={`Fatura de ${competenceLabel(proximaFatura.competence).toLowerCase()}, vence ${longDate(
            proximaFatura.dueDate,
          )} (${relativeDay(proximaFatura.dueDate)})`}
          atalho={{ para: '/financeiro/contas', texto: 'Ver cartões' }}
        />
      ),
    })
  }

  slides.push({
    id: 'saldo-previsto',
    titulo: 'Saldo previsto',
    conteudo: (
      <Painel
        rotulo="Saldo previsto para o fim do mês"
        valor={formatCents(saldoPrevisto)}
        negativo={saldoPrevisto < 0}
        apoio="Saldo de hoje, menos o que falta pagar, mais o que falta receber."
      />
    ),
  })

  const devido = totalEmAberto(aReceber)
  if (devido > 0) {
    const pessoas = emAbertoPorPessoa(aReceber)
    const maisAntigo = pessoas
      .map((pessoa) => pessoa.itens[0]!.date)
      .reduce((antigo, data) => (data < antigo ? data : antigo))
    slides.push({
      id: 'a-receber',
      titulo: 'A receber',
      conteudo: (
        <Painel
          rotulo="Os outros te devem"
          valor={formatCents(devido)}
          apoio={`${pessoas.length === 1 ? pessoas[0]!.nome : `${pessoas.length} pessoas`} · o mais antigo é de ${longDate(maisAntigo)} (${relativeDay(maisAntigo)}). Não entra no saldo previsto: dinheiro dos outros só conta quando volta.`}
          atalho={{ para: '/financeiro/a-receber', texto: 'Ver' }}
        />
      ),
    })
  }

  const maiorGasto = finance.expensesByCategory[0]
  if (maiorGasto) {
    const categoria = maiorGasto.categoryId
      ? finance.categoryById.get(maiorGasto.categoryId)
      : null
    slides.push({
      id: 'maior-gasto',
      titulo: 'Maior gasto',
      conteudo: (
        <Painel
          rotulo={`Onde mais foi o dinheiro em ${competenceLabel(competence).toLowerCase()}`}
          valor={formatCents(maiorGasto.total)}
          apoio={`${categoria?.name ?? 'Sem categoria'} · ${percent(maiorGasto.percent, 0)} do mês, em ${maiorGasto.count} lançamento${maiorGasto.count === 1 ? '' : 's'}`}
          enfeite={
            categoria ? (
              <CategoryIcon icon={categoria.icon} color={categoria.color} className="size-4" />
            ) : null
          }
        />
      ),
    })
  }

  const estourado = finance.budgets.find((item) => item.progress.status === 'exceeded')
  if (estourado) {
    slides.push({
      id: 'envelope',
      titulo: 'Envelope estourado',
      conteudo: (
        <Painel
          rotulo={`${estourado.category?.name ?? 'Envelope'} passou do limite`}
          valor={formatCents(Math.abs(estourado.progress.remaining))}
          negativo
          apoio={`${formatCents(estourado.progress.spent)} gastos de ${formatCents(estourado.progress.limit)} orçados`}
          atalho={{ para: '/financeiro/orcamento', texto: 'Ver orçamento' }}
        >
          <Progress value={estourado.progress.percent} tone="negative" />
        </Painel>
      ),
    })
  }

  const meta = finance.goals.find((item) => !item.projection.reached)
  if (meta) {
    slides.push({
      id: 'meta',
      titulo: 'Meta',
      conteudo: (
        <Painel
          rotulo={`Faltam para ${meta.goal.name}`}
          valor={formatCents(meta.projection.remaining)}
          apoio={
            meta.projection.monthlyNeeded
              ? `${formatCents(meta.projection.monthlyNeeded)} por mês nos próximos ${meta.projection.monthsLeft}`
              : `${percent(meta.projection.percent, 0)} do caminho feito`
          }
          atalho={{ para: '/financeiro/orcamento', texto: 'Ver metas' }}
        >
          <Progress value={meta.projection.percent} />
        </Painel>
      ),
    })
  }

  const paraConferir = finance.accounts
    .filter((conta) => conta.kind !== 'credit')
    .map((conta) => {
      const ultima = lastCheck(conferencias, conta.id)
      return {
        conta,
        ultima,
        pendentes: unchecked(finance.transactions, conta.id, ultima).length,
        dias: daysSinceCheck(ultima, today()),
      }
    })
    .find((item) => needsCheck(item.ultima, today(), item.pendentes))

  if (paraConferir) {
    slides.push({
      id: 'conferir',
      titulo: 'Conferir extrato',
      conteudo: (
        <Painel
          rotulo={`${paraConferir.conta.name} sem conferência`}
          valor={
            paraConferir.dias === null ? 'nunca conferida' : `há ${paraConferir.dias} dias`
          }
          apoio={`${paraConferir.pendentes} lançamento${paraConferir.pendentes === 1 ? '' : 's'} efetivado${paraConferir.pendentes === 1 ? '' : 's'} desde então. Conferir é comparar o saldo com o do banco numa data.`}
          atalho={{ para: '/financeiro/contas', texto: 'Conferir' }}
        />
      ),
    })
  }

  return <Carrossel slides={slides} />
}

/** O desenho comum dos painéis: rótulo, número e uma linha de explicação. */
function Painel({
  rotulo,
  valor,
  apoio,
  negativo = false,
  enfeite,
  atalho,
  children,
}: {
  rotulo: string
  valor: string
  apoio: string
  negativo?: boolean
  enfeite?: React.ReactNode
  atalho?: { para: string; texto: string }
  children?: React.ReactNode
}) {
  return (
    <CardContent className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-fg-muted flex items-center gap-1.5 text-xs font-medium">
            {enfeite}
            {rotulo}
          </p>
          <p
            className={
              negativo
                ? 'text-negative font-serif mt-1.5 text-[22px] leading-none font-semibold'
                : 'text-fg font-serif mt-1.5 text-[22px] leading-none font-semibold'
            }
          >
            {valor}
          </p>
        </div>
        {atalho && (
          <Link
            to={atalho.para}
            className="text-fg-muted hover:text-fg shrink-0 text-xs underline underline-offset-4"
          >
            {atalho.texto}
          </Link>
        )}
      </div>

      {children}

      <p className="text-fg-subtle text-xs leading-relaxed">{apoio}</p>
    </CardContent>
  )
}
