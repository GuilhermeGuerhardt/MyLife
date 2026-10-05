import { AlertTriangle, Check, Copy, Tags } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { CaixaDeSelecao } from '@/components/ui/caixa-de-selecao'
import { Badge, Callout, EmptyState, Segmented, Stat, Toggle } from '@/components/ui/misc'
import { formatCents } from '@/lib/finance/money'
import { rowMatches, type ImportRow, type ImportSummary, type RowFilter } from '@/lib/finance/import'
import { shortDate } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Acima disso a tabela vira rolagem infinita sem ajudar ninguém a conferir. */
const MAX_VISIBLE = 150

/** O palpite de categoria de uma linha, já com o nome resolvido para a tela. */
export interface SugestaoDaLinha {
  categoryId: string
  nome: string
  /** A palavra ou a frase que sustentou o palpite. */
  chave: string
}

/** A conferência antes de gravar: o que entra, o que repete e o que deu erro. */
export function ImportPreview({
  rows,
  summary,
  filter,
  onFilterChange,
  selected,
  onToggle,
  sugestoes,
  sugerindo,
  onSugerirChange,
  baseDeAprendizado,
}: {
  rows: ImportRow[]
  summary: ImportSummary
  filter: RowFilter
  onFilterChange: (filter: RowFilter) => void
  selected: Set<number>
  onToggle: (line: number) => void
  sugestoes: Map<number, SugestaoDaLinha>
  sugerindo: boolean
  onSugerirChange: (valor: boolean) => void
  /** Quantos lançamentos seus sustentam os palpites. */
  baseDeAprendizado: number
}) {
  const visible = rows.filter((row) => rowMatches(row, filter))

  // Quantas linhas entrariam sem categoria nenhuma se o palpite não existisse.
  const semCategoria = rows.filter(
    (row) => !row.error && row.kind !== 'transfer' && row.categoryLabel.trim() === '',
  ).length

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
            {summary.duplicates === 1 ? 'linha já existe' : 'linhas já existem'} no app: mesmo
            lançamento, a mesma parcela de um parcelamento, ou a assinatura que a recorrência já
            tinha previsto para este mês. {summary.duplicates === 1 ? 'Veio' : 'Vieram'}{' '}
            desmarcada{summary.duplicates === 1 ? '' : 's'}, para nada entrar em dobro.
          </Callout>
        )}

        {semCategoria > 0 && (
          <CategoriaSugerida
            semCategoria={semCategoria}
            sugeridas={sugestoes.size}
            sugerindo={sugerindo}
            onSugerirChange={onSugerirChange}
            baseDeAprendizado={baseDeAprendizado}
          />
        )}

        <RowTable
          rows={visible.slice(0, MAX_VISIBLE)}
          selected={selected}
          onToggle={onToggle}
          sugestoes={sugestoes}
        />

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

/**
 * A faixa que explica de onde vem a categoria adivinhada.
 *
 * Sem ela, uma categoria aparecendo sozinha numa linha que o arquivo deixou em
 * branco parece invenção do programa. Dizendo quantas foram e de onde saíram —
 * do que você mesmo já classificou —, a conferência em lote fica possível: ou
 * você confia, ou desliga a chave e importa sem nenhuma.
 */
function CategoriaSugerida({
  semCategoria,
  sugeridas,
  sugerindo,
  onSugerirChange,
  baseDeAprendizado,
}: {
  semCategoria: number
  sugeridas: number
  sugerindo: boolean
  onSugerirChange: (valor: boolean) => void
  baseDeAprendizado: number
}) {
  return (
    <div className="border-border-base bg-surface-2 flex items-start gap-3 rounded-lg border p-3">
      <Tags className="text-accent mt-0.5 size-4 shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="text-fg text-xs font-medium">Categoria pelo seu histórico</p>
        <p className="text-fg-muted mt-0.5 text-xs leading-relaxed">
          {baseDeAprendizado === 0 ? (
            <>
              {semCategoria} linhas vêm sem categoria, e o app ainda não tem lançamentos
              classificados de onde aprender. Conforme você for categorizando, ele passa a
              preencher sozinho nas próximas importações.
            </>
          ) : sugerindo ? (
            <>
              {sugeridas} de {semCategoria} linhas sem categoria foram preenchidas pelo que você já
              classificou em {baseDeAprendizado} lançamentos. Passe o mouse na categoria para ver
              por qual palavra. O resto entra sem categoria, porque o app só palpita depois de
              ver a mesma coisa duas vezes.
            </>
          ) : (
            <>
              As {semCategoria} linhas sem categoria entram em branco. Ligando a chave, o app
              preenche com base nos {baseDeAprendizado} lançamentos que você já classificou.
            </>
          )}
        </p>
      </div>

      <Toggle
        checked={sugerindo}
        disabled={baseDeAprendizado === 0}
        label="Sugerir categoria pelo histórico"
        onChange={onSugerirChange}
      />
    </div>
  )
}

function RowTable({
  rows,
  selected,
  onToggle,
  sugestoes,
}: {
  rows: ImportRow[]
  selected: Set<number>
  onToggle: (line: number) => void
  sugestoes: Map<number, SugestaoDaLinha>
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
        <thead className="bg-surface-2 text-fg-subtle text-xs">
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
                <CaixaDeSelecao
                  checked={selected.has(row.line)}
                  disabled={row.error !== null}
                  onChange={() => onToggle(row.line)}
                  aria-label={`Importar linha ${row.line}`}
                />
              </td>
              <td className="text-fg-subtle p-2 text-xs">{row.line}</td>
              <td className="text-fg-muted p-2 whitespace-nowrap">
                {row.error ? '—' : shortDate(row.date)}
              </td>
              <td className="p-2">
                <span className="text-fg">{row.description || '—'}</span>
                {row.installment && (
                  <span className="text-fg-subtle ml-1.5 text-xs">
                    {row.installment.n}/{row.installment.total}
                  </span>
                )}
                {row.detail && (
                  <span className="text-fg-subtle ml-1.5 text-xs">· {row.detail}</span>
                )}
              </td>
              <td className="text-fg-muted p-2 text-xs">
                <CelulaDeCategoria row={row} sugestao={sugestoes.get(row.line)} />
              </td>
              <td
                className={cn(
                  'p-2 text-right whitespace-nowrap tabular-nums',
                  row.kind === 'income' ? 'text-positive' : 'text-fg',
                )}
              >
                {/* A transferência sai com seta em vez de sinal: ela não soma
                    nem subtrai do mês, só troca o dinheiro de conta. */}
                {row.error
                  ? '—'
                  : row.kind === 'transfer'
                    ? `⇄ ${formatCents(row.amountCents)}`
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


/**
 * A categoria na linha da prévia: a do arquivo, a adivinhada, ou nada.
 *
 * A adivinhada sai tracejada e com a palavra que a justificou na dica — o mesmo
 * tratamento que o Caderno dá ao link para uma anotação que ainda não existe.
 * Parece o que é: uma proposta, não um dado que veio no arquivo.
 */
function CelulaDeCategoria({
  row,
  sugestao,
}: {
  row: ImportRow
  sugestao: SugestaoDaLinha | undefined
}) {
  if (row.kind === 'transfer') return <>para {row.transferToLabel || '?'}</>
  if (row.categoryLabel) return <>{row.categoryLabel}</>
  if (!sugestao) return <>—</>

  return (
    <span
      title={`Sugerido por "${sugestao.chave}", que você já classificou assim antes`}
      className="text-fg-subtle decoration-border-strong underline decoration-dashed underline-offset-2"
    >
      {sugestao.nome}
    </span>
  )
}
