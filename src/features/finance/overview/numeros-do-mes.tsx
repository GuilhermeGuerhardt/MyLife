import { Link } from 'react-router-dom'
import { PainelDeNumeros, Stat } from '@/components/ui/misc'
import type { OpenInvoice, OverdueSummary } from '@/lib/finance/reports'
import { formatCents } from '@/lib/finance/money'
import { percent, shortDate } from '@/lib/format'

/**
 * O aviso do que venceu.
 *
 * É a única coisa da tela que interrompe: o resto é consulta, e isto é conta
 * que já passou da data. Uma linha com régua vermelha basta — um cartão
 * atravessando a tela para dizer uma frase grita mais alto do que o assunto
 * pede, e a cor de alerta gasta rápido quando é usada em tamanho grande.
 *
 * São dois avisos de naturezas diferentes: o boleto que passou da data, e a
 * fatura de cartão que venceu. A compra no cartão nunca aparece aqui — ela não
 * tem prazo próprio, está esperando a fatura em que caiu.
 */
export function AvisoDeAtrasos({
  atrasos,
  faturas,
  nomeDaConta,
}: {
  atrasos: OverdueSummary
  faturas: OpenInvoice[]
  nomeDaConta: (id: string) => string
}) {
  if (atrasos.count === 0 && faturas.length === 0) return null

  return (
    <div className="border-negative space-y-1 border-l-2 py-1 pl-3">
      {atrasos.count > 0 && (
        <p className="text-fg text-sm">
          <span className="font-medium">
            {atrasos.count} lançamento{atrasos.count === 1 ? '' : 's'} vencido
            {atrasos.count === 1 ? '' : 's'}
          </span>
          <span className="text-fg-muted">
            {' — '}
            {formatCents(atrasos.totalCents)} em aberto
            {atrasos.oldestDate && `, o mais antigo de ${shortDate(atrasos.oldestDate)}`}.{' '}
          </span>
          <Link
            to="/financeiro/transacoes"
            className="text-fg decoration-border-strong underline underline-offset-4"
          >
            Ver
          </Link>
        </p>
      )}

      {faturas.map((fatura) => (
        <p key={`${fatura.accountId}-${fatura.competence}`} className="text-fg text-sm">
          <span className="font-medium">Fatura do {nomeDaConta(fatura.accountId)} vencida</span>
          <span className="text-fg-muted">
            {' — '}
            {formatCents(fatura.totalCents)}, venceu em {shortDate(fatura.dueDate)}.{' '}
          </span>
          <Link
            to="/financeiro/contas"
            className="text-fg decoration-border-strong underline underline-offset-4"
          >
            Quitar
          </Link>
        </p>
      ))}
    </div>
  )
}

/** Os quatro números do topo: saldo, o que entrou, o que saiu e o que sobrou. */
export function NumerosDoMes({
  saldo,
  faturasAbertas,
  fluxo,
}: {
  saldo: number
  faturasAbertas: number
  fluxo: { income: number; expense: number; net: number; savingsRate: number }
}) {
  return (
    <PainelDeNumeros>
      <Stat
        label="Saldo em contas"
        value={formatCents(saldo)}
        hint={
          faturasAbertas > 0
            ? `${formatCents(faturasAbertas)} em faturas abertas`
            : 'Cartões não entram no saldo'
        }
        tone={saldo < 0 ? 'negative' : undefined}
      />
      <Stat label="Receitas do mês" value={formatCents(fluxo.income)} />
      <Stat label="Despesas do mês" value={formatCents(fluxo.expense)} />
      <Stat
        label="Sobrou"
        value={formatCents(fluxo.net)}
        tone={fluxo.net < 0 ? 'negative' : undefined}
        hint={
          fluxo.income > 0
            ? `Taxa de poupança: ${percent(fluxo.savingsRate, 0)}`
            : 'Sem receita lançada no mês'
        }
      />
    </PainelDeNumeros>
  )
}
