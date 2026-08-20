import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { decimal, shortDate } from '@/lib/format'

export interface WeightPoint {
  date: string
  value: number
  average: number
  projected?: number
}

/**
 * Pesagens cruas em pontinhos, média móvel de 7 dias como linha cheia.
 * A separação é proposital: a média é a tendência que importa, e ver os pontos
 * espalhados em volta dela explica por que um dia ruim na balança não é nada.
 */
export function WeightChart({
  data,
  targetKg,
  height = 260,
}: {
  data: WeightPoint[]
  targetKg?: number | null
  height?: number
}) {
  const values = data.flatMap((d) => [d.value, d.average, d.projected ?? d.average])
  if (targetKg) values.push(targetKg)
  const min = Math.floor(Math.min(...values) - 1)
  const max = Math.ceil(Math.max(...values) + 1)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          domain={[min, max]}
          tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            fontSize: 12,
            color: 'var(--fg)',
          }}
          labelFormatter={(label) => shortDate(String(label))}
          formatter={(value, name) => [
            `${decimal(Number(value), 1)} kg`,
            name === 'average' ? 'Média 7 dias' : name === 'projected' ? 'Projetado' : 'Pesagem',
          ]}
        />
        <Area
          type="monotone"
          dataKey="average"
          stroke="var(--accent)"
          strokeWidth={2}
          fill="url(#weightFill)"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Scatter dataKey="value" fill="var(--fg-subtle)" shape="circle" r={2} />
        {data.some((d) => d.projected !== undefined) && (
          <Line
            type="monotone"
            dataKey="projected"
            stroke="var(--fg-subtle)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
