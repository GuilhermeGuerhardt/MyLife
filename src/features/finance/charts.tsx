import {
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Competence } from '@/lib/finance/billing'
import { formatCents } from '@/lib/finance/money'

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--fg)',
}

/** Receitas x despesas por mês. Barras lado a lado leem melhor que empilhadas. */
export function CashFlowChart({
  data,
  height = 220,
}: {
  data: Array<{ competence: Competence; income: number; expense: number; label: string }>
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <XAxis
          dataKey="label"
          tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={56}
          tickFormatter={(value: number) => compact(value)}
        />
        <Tooltip
          cursor={{ fill: 'var(--surface-2)' }}
          contentStyle={tooltipStyle}
          formatter={(value, name) => [
            formatCents(Number(value)),
            name === 'income' ? 'Receitas' : 'Despesas',
          ]}
        />
        <Bar dataKey="income" fill="var(--positive)" radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="expense" fill="var(--negative)" radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/**
 * O saldo no fim de cada mês, numa linha só.
 *
 * Fica num gráfico à parte, e não como linha por cima das barras: o saldo
 * costuma ser várias vezes maior que o fluxo de um mês, e no mesmo eixo achataria
 * as barras. Num segundo eixo, a altura de uma coisa deixaria de ser comparável
 * com a da outra, sem nada na tela avisar.
 *
 * O eixo de baixo é de faixas, como o das barras acima: cada ponto fica no meio
 * do mês dele. No eixo padrão de linha os pontos iam até as bordas, e o mês de
 * cima não ficava sobre o mês de baixo.
 */
export function SaldoChart({
  data,
  height = 120,
}: {
  data: Array<{ label: string; saldoCents: number; previsto: boolean }>
  height?: number
}) {
  // Duas séries que se encontram no último mês fechado: a linha cheia vira
  // tracejada sem quebrar na passagem do que foi para o que deve ser.
  const ultimoRealizado = data.reduce((ultimo, ponto, i) => (ponto.previsto ? ultimo : i), -1)
  const linhas = data.map((ponto, i) => ({
    ...ponto,
    realizado: ponto.previsto ? null : ponto.saldoCents,
    projecao: ponto.previsto || i === ultimoRealizado ? ponto.saldoCents : null,
  }))
  const temNegativo = data.some((ponto) => ponto.saldoCents < 0)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={linhas} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <XAxis
          dataKey="label"
          scale="band"
          tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={56}
          domain={['auto', 'auto']}
          tickFormatter={(value: number) => compact(value)}
        />
        {/* O zero só aparece quando o saldo cruza: é a linha que importa ali. */}
        {temNegativo && <ReferenceLine y={0} stroke="var(--negative)" strokeDasharray="2 3" />}
        <Tooltip
          cursor={{ stroke: 'var(--border-strong)' }}
          content={({ active, payload }) => {
            const ponto = payload?.[0]?.payload as (typeof linhas)[number] | undefined
            if (!active || !ponto) return null
            return (
              <div style={tooltipStyle} className="px-2.5 py-1.5">
                <p className="text-fg-muted">
                  {ponto.label} · {ponto.previsto ? 'previsto' : 'fim do mês'}
                </p>
                <p className="text-fg font-medium">{formatCents(ponto.saldoCents)}</p>
              </div>
            )
          }}
        />
        {/* Ponto vazado no previsto: o traço sozinho some num ponto isolado.
            Vem antes do realizado para que, no mês em que os dois se encontram,
            o ponto cheio fique por cima. */}
        <Line
          dataKey="projecao"
          stroke="var(--fg)"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={{ r: 4, fill: 'var(--surface)', stroke: 'var(--fg)', strokeWidth: 2 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
        <Line
          dataKey="realizado"
          stroke="var(--fg)"
          strokeWidth={2}
          dot={{ r: 4, fill: 'var(--fg)', stroke: 'var(--surface)', strokeWidth: 2 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** Distribuição das despesas do mês por categoria. */
export function CategoryDonut({
  data,
  height = 220,
}: {
  data: Array<{ name: string; value: number; color: string }>
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="58%"
          outerRadius="88%"
          paddingAngle={2}
          stroke="var(--surface)"
          strokeWidth={2}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) => [formatCents(Number(value)), String(name)]}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

/**
 * "1,2 mil" — eixo legível sem virar uma parede de zeros.
 *
 * Acima de 10 mil a casa decimal sai: "18,0 mil" não cabia nos 56px do eixo, e
 * o corte comia o primeiro dígito, que virava "8,0 mil" sem nada indicar.
 */
function compact(cents: number): string {
  const value = cents / 100
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (abs >= 10_000) return `${Math.round(value / 1000)} mil`
  if (abs >= 1000) return `${(value / 1000).toFixed(1).replace('.', ',')} mil`
  return String(Math.round(value))
}
