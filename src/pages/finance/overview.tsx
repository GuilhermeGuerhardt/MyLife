/**
 * A visão geral do Financeiro.
 *
 * Esta tela compõe: os blocos moram em `features/finance/overview`, e o que ela
 * faz aqui é escolher o mês, juntar o que cada bloco precisa e abrir os
 * formulários. O que dá trabalho — saldo, fluxo, fatura, orçamento — vem pronto
 * de `useFinance`.
 */

import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { useAccountChecks, useCategories, useRecurring } from '@/data/queries'
import { useCreateTransaction, useMaterializeRecurring, useSetTransactionPaid } from '@/features/finance/actions'
import { useAvisoDeCompetencia } from '@/features/finance/aviso-de-competencia'
import { ContasEOrcamento } from '@/features/finance/overview/contas-e-orcamento'
import { DespesasPorCategoria, FluxoDeCaixa } from '@/features/finance/overview/graficos-do-mes'
import { AvisoDeAtrasos, NumerosDoMes } from '@/features/finance/overview/numeros-do-mes'
import { PainelDoMes } from '@/features/finance/overview/painel-do-mes'
import { Previsoes } from '@/features/finance/overview/previsoes'
import { PrimeiraConta } from '@/features/finance/overview/primeira-conta'
import { MonthNav } from '@/features/finance/month-nav'
import { TransactionForm } from '@/features/finance/transaction-form'
import { useFinance } from '@/features/finance/use-finance'
import { useTransactionEditor } from '@/features/finance/use-transaction-editor'
import { addMonths, competenceLabel, toCompetence } from '@/lib/finance/billing'
import { isOpen, summarizeOpenMonth } from '@/lib/finance/open-month'
import { resolveSliceColors } from '@/lib/finance/palette'
import { pendingOccurrences } from '@/lib/finance/recurring'
import {
  invoicesDueIn,
  lateInvoices,
  monthlySeries,
  overdueSummary,
} from '@/lib/finance/reports'
import { today } from '@/lib/utils'

export function FinanceOverview() {
  const [competence, setCompetence] = useState(toCompetence(today()))
  const finance = useFinance(competence)
  const { data: categories } = useCategories()
  const { data: rules } = useRecurring()
  const { data: conferencias } = useAccountChecks()
  const createTransaction = useCreateTransaction()
  const setPaid = useSetTransactionPaid()
  const materialize = useMaterializeRecurring()
  const { avisar, aviso } = useAvisoDeCompetencia(competence, setCompetence)
  const { open: openEditor, editor } = useTransactionEditor()

  const [lancando, setLancando] = useState(false)

  if (!finance.hasAccounts) return <PrimeiraConta />

  // Os dois avisos que valem interromper: o que venceu e o que ainda nem foi
  // lançado. O resto da tela é consulta.
  const atrasos = overdueSummary(finance.transactions, today(), finance.cardIds)
  const faturasVencidas = lateInvoices(finance.accounts, finance.transactions, today())
  const pendentes = pendingOccurrences(rules, competence, finance.transactions)

  // O que falta no mês: o previsto que já existe, mais a regra que ainda não
  // virou lançamento. A ordem é da data mais antiga para a mais nova, o que
  // sobe o vencido ao topo sem precisar de regra separada.
  // Compra no cartão fica fora da lista do que falta pagar: ela não é conta
  // sua, é linha da fatura — e a fatura entra inteira, logo abaixo.
  const emAberto = finance.monthTransactions
    .filter((t) => isOpen(t) && !finance.cardIds.has(t.account_id))
    .sort((a, b) => a.date.localeCompare(b.date))

  const faturasDoMes = invoicesDueIn(finance.accounts, finance.transactions, competence)
  const resumoAberto = summarizeOpenMonth(
    finance.monthTransactions,
    pendentes,
    today(),
    finance.cardIds,
    faturasDoMes,
  )

  // Seis meses até a competência aberta.
  const months = Array.from({ length: 6 }, (_, i) => addMonths(competence, i - 5))
  const serie = monthlySeries(finance.transactions, months).map((point) => ({
    ...point,
    label: competenceLabel(point.competence).slice(0, 3),
  }))

  /**
   * Fatias do gráfico e da legenda, resolvidas de uma vez só.
   *
   * Antes o donut lia as 8 maiores e a legenda as 5 maiores por conta própria,
   * cada um resolvendo a cor do seu lado — o que abria espaço para a bolinha da
   * legenda não bater com a fatia que ela nomeia.
   */
  const fatias = resolveSliceColors(
    finance.expensesByCategory.slice(0, 8).map((item) => {
      const category = item.categoryId ? finance.categoryById.get(item.categoryId) : null
      return {
        key: item.categoryId ?? 'none',
        name: category?.name ?? 'Sem categoria',
        value: item.total,
        percent: item.percent,
        color: category?.color ?? null,
      }
    }),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        description="A compra no cartão fica no mês em que foi feita; a fatura aparece no mês em que vence."
        action={
          <div className="flex items-center gap-2">
            <MonthNav competence={competence} onChange={setCompetence} />
            <Button onClick={() => setLancando(true)}>
              <Plus />
              Lançamento
            </Button>
          </div>
        }
      />

      <AvisoDeAtrasos
        atrasos={atrasos}
        faturas={faturasVencidas}
        nomeDaConta={(id) => finance.accounts.find((conta) => conta.id === id)?.name ?? 'cartão'}
      />

      <NumerosDoMes
        saldo={finance.totalBalance}
        faturasAbertas={finance.openInvoices}
        fluxo={finance.flow}
      />

      <Previsoes
        finance={finance}
        conferencias={conferencias}
        saldoPrevisto={finance.totalBalance + resumoAberto.balanceCents}
        competence={competence}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <FluxoDeCaixa serie={serie} />
        <DespesasPorCategoria fatias={fatias} competence={competence} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PainelDoMes
          doMes={finance.monthTransactions}
          emAberto={emAberto}
          faturas={faturasDoMes}
          resumoAberto={resumoAberto}
          saldoAtual={finance.totalBalance}
          pendentes={pendentes}
          contas={finance.accounts}
          categoriaPorId={finance.categoryById}
          onEditar={openEditor}
          onMarcarPago={(transaction, pago) => void setPaid(transaction, pago)}
          onLancarRecorrentes={materialize}
        />

        <ContasEOrcamento
          resumos={finance.summaries}
          orcamentos={finance.budgets}
          competence={competence}
        />
      </div>

      {lancando && (
        <TransactionForm
          accounts={finance.accounts}
          categories={categories}
          onClose={() => setLancando(false)}
          onSave={async (draft) => {
            avisar(await createTransaction(draft))
            setLancando(false)
          }}
        />
      )}

      {editor}
      {aviso}
    </div>
  )
}
