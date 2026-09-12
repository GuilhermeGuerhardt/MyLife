import { AlertTriangle, Check, Copy } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge, Callout, EmptyState, Segmented, Stat } from '@/components/ui/misc'
import { formatCents } from '@/lib/finance/money'
import { rowMatches, type ImportRow, type ImportSummary, type RowFilter } from '@/lib/finance/import'
import { shortDate } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Acima disso a tabela vira rolagem infinita sem ajudar ninguém a conferir. */
const MAX_VISIBLE = 150

/** A conferência antes de gravar: o que entra, o que repete e o que deu erro. */
export function ImportPreview({
  rows,
  summary,
  filter,
  onFilterChange,
  selected,
  onToggle,
}: {
  rows: ImportRow[]
  summary: ImportSummary
  filter: RowFilter
  onFilterChange: (filter: RowFilter) => void
  selected: Set<number>
  onToggle: (line: number) => void
}) {
  const visible = rows.filter((row) => rowMatches(row, filter))

  return (
    <Card>
      <CardHeader
        title="Prévia"
        description="Desmarque o que não quiser trazer. Duplicadas já vêm desmarcadas."
        action={
          <Segmented<RowFilter>
            value={filter}
            onChange={onFilterChange}
            options={[
              { value: 'all', label: `Todas ${rows.length}` },
              { value: 'ready', label: 'Novas' },
              { value: 'duplicate', label: `Repetidas ${summary.duplicates}` },
              { value: 'error', label: `Erros ${summary.errors}` },
            ]}
          />
        }
      />
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Vão entrar" value={String(summary.ready)} />
          <Stat label="Receitas" value={formatCents(summary.incomeCents)} />
          <Stat label="Despesas" value={formatCents(summary.expenseCents)} />
          <Stat
            label="Período"
            value={
              summary.from && summary.to
                ? `${shortDate(summary.from)} – ${shortDate(summary.to)}`
                : '—'
            }
          />
        </div>

        {summary.duplicates > 0 && (
          <Callout tone="warning" icon={<AlertTriangle className="size-3.5" />}>
            {summary.duplicates}{' '}
            {summary.duplicates === 1 ? 'linha já existe' : 'linhas já existem'} no app (mesma data,
            valor e descrição). Vieram desmarcadas para a reimportação do mesmo extrato não
            duplicar nada.
          </Callout>
        )}

        <RowTable rows={visible.slice(0, MAX_VISIBLE)} selected={selected} onToggle={onToggle} />

        {visible.length > MAX_VISIBLE && (
          <p className="text-fg-subtle text-center text-xs">
            Mostrando {MAX_VISIBLE} de {visible.length} linhas. As demais seguem a seleção atual e
            serão importadas normalmente.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function RowTable({
  rows,
  selected,
  onToggle,
}: {
  rows: ImportRow[]
  selected: Set<number>
  onToggle: (line: number) => void
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Check className="size-5" />}
        title="Nada aqui"
        description="Nenhuma linha se encaixa neste filtro."
      />
    )
  }

  return (
    <div className="border-border-base overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-fg-subtle text-[11px]">
          <tr>
            <th className="w-10 p-2" />
            <th className="w-12 p-2 text-left font-medium">Linha</th>
            <th className="p-2 text-left font-medium">Data</th>
            <th className="p-2 text-left font-medium">Descrição</th>
            <th className="p-2 text-left font-medium">Categoria</th>
            <th className="p-2 text-right font-medium">Valor</th>
            <th className="p-2 text-left font-medium">Situação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.line}
              className={cn(
                'border-border-base border-t',
                row.error && 'opacity-50',
                !row.error && !selected.has(row.line) && 'opacity-60',
              )}
            >
              <td className="p-2 text-center">
                <input
                  type="checkbox"
                  checked={selected.has(row.line)}
                  disabled={row.error !== null}
                  onChange={() => onToggle(row.line)}
                  aria-label={`Importar linha ${row.line}`}
                />
              </td>
              <td className="text-fg-subtle p-2 text-[11px]">{row.line}</td>
              <td className="text-fg-muted p-2 whitespace-nowrap">
                {row.error ? '—' : shortDate(row.date)}
              </td>
              <td className="p-2">
                <span className="text-fg">{row.description || '—'}</span>
                {row.installment && (
                  <span className="text-fg-subtle ml-1.5 text-[11px]">
                    {row.installment.n}/{row.installment.total}
                  </span>
                )}
                {row.detail && (
                  <span className="text-fg-subtle ml-1.5 text-[11px]">· {row.detail}</span>
                )}
              </td>
              <td className="text-fg-muted p-2 text-xs">{row.categoryLabel || '—'}</td>
              <td
                className={cn(
                  'p-2 text-right whitespace-nowrap tabular-nums',
                  row.kind === 'income' ? 'text-positive' : 'text-fg',
                )}
              >
                {row.error
                  ? '—'
                  : `${row.kind === 'income' ? '+' : '−'} ${formatCents(row.amountCents)}`}
              </td>
              <td className="p-2">
                <RowStatus row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RowStatus({ row }: { row: ImportRow }) {
  if (row.error) {
    return (
      <Badge tone="negative">
        <AlertTriangle className="size-3" />
        {row.error}
      </Badge>
    )
  }

  if (row.duplicate) {
    return (
      <Badge tone="warning">
        <Copy className="size-3" />
        Já existe
      </Badge>
    )
  }

  return <Badge tone={row.paid ? 'positive' : 'neutral'}>{row.paid ? 'Pago' : 'Em aberto'}</Badge>
}
