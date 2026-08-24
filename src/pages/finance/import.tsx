import { AlertTriangle, ArrowLeft, Check, Copy, Info, Loader2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, Select } from '@/components/ui/field'
import { Badge, EmptyState, Segmented, Stat } from '@/components/ui/misc'
import { useAccounts, useCategories, useTransactions } from '@/data/queries'
import { ExportCard } from '@/features/finance/export-card'
import { ResetFinanceCard } from '@/features/finance/reset-card'
import {
  CREATE,
  IGNORE,
  labelKinds,
  suggestAccounts,
  suggestCategories,
  useRunImport,
  type ImportResult,
} from '@/features/finance/use-import'
import {
  buildRows,
  detectColumns,
  distinctLabels,
  FIELD_LABELS,
  markDuplicates,
  missingFields,
  parseCsv,
  summarize,
  type ColumnMap,
  type ImportField,
  type ImportRow,
} from '@/lib/finance/import'
import { formatCents } from '@/lib/finance/money'
import { shortDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const FIELDS = Object.keys(FIELD_LABELS) as ImportField[]

type Filter = 'all' | 'ready' | 'duplicate' | 'error'

/** Acima disso a tabela vira rolagem infinita sem ajudar ninguém a conferir. */
const MAX_VISIBLE = 150

export function ImportPage() {
  const navigate = useNavigate()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const { data: transactions } = useTransactions()
  const runImport = useRunImport()

  const [fileName, setFileName] = useState<string | null>(null)
  const [cells, setCells] = useState<string[][]>([])
  const [map, setMap] = useState<ColumnMap>({})
  const [readError, setReadError] = useState<string | null>(null)

  const [accountChoice, setAccountChoice] = useState<Record<string, string>>({})
  const [categoryChoice, setCategoryChoice] = useState<Record<string, string>>({})
  const [fallbackAccount, setFallbackAccount] = useState('')

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<Filter>('all')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const header = cells[0] ?? []

  const rows = useMemo(() => {
    if (cells.length < 2 || missingFields(map).length > 0) return []
    return markDuplicates(buildRows(cells.slice(1), map), transactions)
  }, [cells, map, transactions])

  const accountLabels = useMemo(() => distinctLabels(rows, (row) => row.accountLabel), [rows])
  const categoryLabels = useMemo(() => labelKinds(rows), [rows])

  // Toda vez que as linhas mudam — arquivo novo ou coluna remapeada — as
  // sugestões e a seleção são recalculadas. Manter escolhas antigas sobre
  // linhas que já não existem só produziria mapeamento fantasma.
  useEffect(() => {
    setAccountChoice(suggestAccounts(accountLabels, accounts))
    setCategoryChoice(suggestCategories(categoryLabels, categories))
    setSelected(new Set(rows.filter((row) => !row.error && !row.duplicate).map((row) => row.line)))
    // `accounts` e `categories` de propósito fora: uma criação durante a
    // importação não deve reescrever o que a pessoa acabou de escolher.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, accountLabels, categoryLabels])

  useEffect(() => {
    if (!fallbackAccount && accounts.length > 0) setFallbackAccount(accounts[0]!.id)
  }, [accounts, fallbackAccount])

  const loadFile = async (file: File) => {
    setReadError(null)
    setResult(null)
    try {
      const text = await readText(file)
      const parsed = parseCsv(text)
      if (parsed.length < 2) {
        setReadError('O arquivo não tem linhas de dados além do cabeçalho.')
        return
      }
      setFileName(file.name)
      setCells(parsed)
      setMap(detectColumns(parsed[0]!))
    } catch {
      setReadError('Não consegui ler o arquivo. Ele precisa ser um CSV de texto.')
    }
  }

  const missing = missingFields(map)
  const summary = summarize(rows, (row) => selected.has(row.line))
  const visible = rows.filter((row) => matchesFilter(row, filter))

  const toggle = (line: number) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(line)) next.delete(line)
      else next.add(line)
      return next
    })

  const importNow = async () => {
    setRunning(true)
    try {
      const outcome = await runImport({
        rows: rows.filter((row) => selected.has(row.line) && !row.error),
        accounts: accountChoice,
        categories: categoryChoice,
        fallbackAccountId: fallbackAccount,
      })
      setResult(outcome)
    } finally {
      setRunning(false)
    }
  }

  if (result) {
    return (
      <Done result={result} onAgain={() => reset()} onSeeAll={() => navigate('/financeiro/transacoes')} />
    )
  }

  function reset() {
    setFileName(null)
    setCells([])
    setMap({})
    setResult(null)
    setReadError(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/financeiro/transacoes" className="text-fg-subtle hover:text-fg">
              <ArrowLeft className="size-4" />
            </Link>
            <h1 className="text-fg text-xl font-semibold">Planilhas</h1>
          </div>
          <p className="text-fg-muted mt-1 max-w-2xl text-sm">
            Traga o extrato exportado de outro app em vez de redigitar, ou leve os seus
            lançamentos para fora. Tudo acontece no seu navegador — nada é enviado para lugar
            nenhum — e nada é gravado até você conferir a prévia.
          </p>
        </div>
        {fileName && (
          <Button variant="secondary" onClick={reset}>
            Trocar arquivo
          </Button>
        )}
      </div>

      {!fileName ? (
        <>
          <ExportCard />
          <FilePicker onPick={loadFile} error={readError} />
          <ResetFinanceCard />
        </>
      ) : (
        <>
          <Card>
            <CardHeader
              title="Colunas"
              description={`${fileName} · ${cells.length - 1} linhas · o mapeamento abaixo foi deduzido do cabeçalho`}
            />
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {FIELDS.map((field) => (
                  <Field
                    key={field}
                    label={FIELD_LABELS[field]}
                    error={missing.includes(field) ? 'Obrigatório' : undefined}
                  >
                    <Select
                      value={map[field] ?? ''}
                      onChange={(event) =>
                        setMap((current) => ({
                          ...current,
                          [field]: event.target.value === '' ? undefined : Number(event.target.value),
                        }))
                      }
                    >
                      <option value="">— não usar —</option>
                      {header.map((name, index) => (
                        <option key={index} value={index}>
                          {name || `Coluna ${index + 1}`}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ))}
              </div>

              {missing.length > 0 && (
                <Note tone="negative">
                  Sem {missing.map((field) => FIELD_LABELS[field]).join(', ')} não dá para montar um
                  lançamento. Escolha a coluna correspondente acima.
                </Note>
              )}
            </CardContent>
          </Card>

          {rows.length > 0 && (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader
                    title="Contas"
                    description="Para onde vai cada conta citada no arquivo"
                  />
                  <CardContent className="space-y-3">
                    {accountLabels.length === 0 ? (
                      <Field
                        label="Conta de destino"
                        hint="O arquivo não traz coluna de conta — tudo entra nesta."
                      >
                        <Select
                          value={fallbackAccount}
                          onChange={(event) => setFallbackAccount(event.target.value)}
                        >
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    ) : (
                      accountLabels.map((label) => (
                        <Field key={label} label={label}>
                          <Select
                            value={accountChoice[label] ?? CREATE}
                            onChange={(event) =>
                              setAccountChoice((current) => ({ ...current, [label]: event.target.value }))
                            }
                          >
                            <option value={CREATE}>+ Criar conta "{label}"</option>
                            {accounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.name}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader
                    title="Categorias"
                    description="O palpite vem das palavras-chave que o app já usa no registro rápido"
                  />
                  <CardContent className="max-h-80 space-y-3 overflow-y-auto">
                    {categoryLabels.length === 0 ? (
                      <p className="text-fg-subtle text-sm">
                        O arquivo não traz categoria. Os lançamentos entram sem categoria e você
                        classifica depois.
                      </p>
                    ) : (
                      categoryLabels.map(({ label, kind }) => (
                        <Field key={label} label={label}>
                          <Select
                            value={categoryChoice[label] ?? CREATE}
                            onChange={(event) =>
                              setCategoryChoice((current) => ({
                                ...current,
                                [label]: event.target.value,
                              }))
                            }
                          >
                            <option value={CREATE}>+ Criar categoria "{label}"</option>
                            <option value={IGNORE}>— sem categoria —</option>
                            {categories
                              .filter((category) => category.kind === kind)
                              .map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                          </Select>
                        </Field>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader
                  title="Prévia"
                  description="Desmarque o que não quiser trazer. Duplicadas já vêm desmarcadas."
                  action={
                    <Segmented<Filter>
                      value={filter}
                      onChange={setFilter}
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
                    <Note tone="warning">
                      {summary.duplicates} {summary.duplicates === 1 ? 'linha já existe' : 'linhas já existem'} no
                      app (mesma data, valor e descrição). Vieram desmarcadas para a reimportação do
                      mesmo extrato não duplicar nada.
                    </Note>
                  )}

                  <RowTable
                    rows={visible.slice(0, MAX_VISIBLE)}
                    selected={selected}
                    onToggle={toggle}
                  />

                  {visible.length > MAX_VISIBLE && (
                    <p className="text-fg-subtle text-center text-xs">
                      Mostrando {MAX_VISIBLE} de {visible.length} linhas. As demais seguem a seleção
                      atual e serão importadas normalmente.
                    </p>
                  )}
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <p className="text-fg-subtle mr-auto text-xs">
                  {summary.ready} de {rows.length} linhas serão gravadas.
                </p>
                <Button variant="secondary" onClick={reset}>
                  Cancelar
                </Button>
                <Button onClick={importNow} disabled={summary.ready === 0 || running}>
                  {running ? <Loader2 className="animate-spin" /> : <Check />}
                  {running ? 'Importando…' : `Importar ${summary.ready}`}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function FilePicker({ onPick, error }: { onPick: (file: File) => void; error: string | null }) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <Card>
      <CardContent>
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            const file = event.dataTransfer.files[0]
            if (file) onPick(file)
          }}
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition-colors',
            dragging ? 'border-accent bg-accent-soft' : 'border-border-base',
          )}
        >
          <Upload className="text-fg-subtle size-6" />
          <p className="text-fg mt-3 text-sm font-medium">Arraste o CSV aqui</p>
          <p className="text-fg-muted mt-1 max-w-md text-xs">
            Exporte o extrato do outro app em CSV. O cabeçalho é reconhecido sozinho — e se o seu
            for diferente, dá para corrigir coluna por coluna na tela seguinte.
          </p>
          <Button className="mt-4" variant="secondary" onClick={() => input.current?.click()}>
            Escolher arquivo
          </Button>
          <input
            ref={input}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onPick(file)
              event.target.value = ''
            }}
          />
          {error && <p className="text-negative mt-4 text-xs">{error}</p>}
        </div>

        <div className="text-fg-subtle mt-4 flex items-start gap-2 text-xs">
          <Info className="mt-px size-3.5 shrink-0" />
          <p>
            Valor em reais (<code>R$ 1.130,00</code>), data em ISO ou dd/mm/aaaa, e uma coluna de
            situação como "Já foi pago" / "Falta pagar". Parcela escrita no nome —{' '}
            <code>CG 160 Fan (5/48)</code> — vira parcelamento de verdade no app.
          </p>
        </div>
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
                {row.detail && <span className="text-fg-subtle ml-1.5 text-[11px]">· {row.detail}</span>}
              </td>
              <td className="text-fg-muted p-2 text-xs">{row.categoryLabel || '—'}</td>
              <td
                className={cn(
                  'p-2 text-right whitespace-nowrap tabular-nums',
                  row.kind === 'income' ? 'text-positive' : 'text-fg',
                )}
              >
                {row.error ? '—' : `${row.kind === 'income' ? '+' : '−'} ${formatCents(row.amountCents)}`}
              </td>
              <td className="p-2">
                {row.error ? (
                  <Badge tone="negative">
                    <AlertTriangle className="size-3" />
                    {row.error}
                  </Badge>
                ) : row.duplicate ? (
                  <Badge tone="warning">
                    <Copy className="size-3" />
                    Já existe
                  </Badge>
                ) : (
                  <Badge tone={row.paid ? 'positive' : 'neutral'}>
                    {row.paid ? 'Pago' : 'Em aberto'}
                  </Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Done({
  result,
  onAgain,
  onSeeAll,
}: {
  result: ImportResult
  onAgain: () => void
  onSeeAll: () => void
}) {
  const created = [
    result.accountsCreated > 0 &&
      `${result.accountsCreated} ${result.accountsCreated === 1 ? 'conta criada' : 'contas criadas'}`,
    result.categoriesCreated > 0 &&
      `${result.categoriesCreated} ${result.categoriesCreated === 1 ? 'categoria criada' : 'categorias criadas'}`,
  ].filter(Boolean)

  return (
    <Card>
      <CardContent>
        <EmptyState
          icon={<Check className="size-5" />}
          title={`${result.transactions} ${result.transactions === 1 ? 'lançamento importado' : 'lançamentos importados'}`}
          description={
            created.length > 0
              ? `${created.join(' e ')}. Os lançamentos ficaram com a etiqueta "importado".`
              : 'Os lançamentos ficaram com a etiqueta "importado".'
          }
          action={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onAgain}>
                Importar outro
              </Button>
              <Button onClick={onSeeAll}>Ver lançamentos</Button>
            </div>
          }
        />
      </CardContent>
    </Card>
  )
}

function Note({ tone, children }: { tone: 'warning' | 'negative'; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'mt-4 flex items-start gap-2 rounded-lg border p-3 text-xs',
        tone === 'warning'
          ? 'bg-warning/10 text-warning border-transparent'
          : 'bg-negative/10 text-negative border-transparent',
      )}
    >
      <AlertTriangle className="mt-px size-3.5 shrink-0" />
      <p>{children}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------

function matchesFilter(row: ImportRow, filter: Filter): boolean {
  if (filter === 'all') return true
  if (filter === 'error') return row.error !== null
  if (filter === 'duplicate') return row.duplicate
  return !row.error && !row.duplicate
}

/**
 * Lê o arquivo como texto.
 *
 * Tenta UTF-8 e cai para Windows-1252 quando aparece o caractere de
 * substituição: o Excel em português ainda exporta assim, e sem essa segunda
 * tentativa "Alimentação" chegaria como "Alimenta��o".
 */
async function readText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  if (!utf8.includes('�')) return utf8
  return new TextDecoder('windows-1252').decode(buffer)
}
