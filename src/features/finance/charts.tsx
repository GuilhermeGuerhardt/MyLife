import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
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

/** "R$ 1,2 mil" — eixo legível sem virar uma parede de zeros. */
function compact(cents: number): string {
  const value = cents / 100
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1).replace('.', ',')} mil`
  }
  return String(Math.round(value))
}
