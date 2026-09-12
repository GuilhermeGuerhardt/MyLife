/**
 * O estado das quatro etapas da importação: escolher o arquivo, conferir as
 * colunas, apontar contas e categorias, revisar a prévia.
 *
 * Fica fora da tela porque quase tudo aqui é derivação — as linhas saem do
 * arquivo mais o mapeamento, as sugestões saem das linhas, o resumo sai da
 * seleção. A tela só desenha o que este hook já resolveu.
 */

import { useEffect, useMemo, useState } from 'react'
import { useAccounts, useCategories, useTransactions } from '@/data/queries'
import {
  buildRows,
  detectColumns,
  distinctLabels,
  markDuplicates,
  missingFields,
  parseCsv,
  readText,
  summarize,
  type ColumnMap,
  type RowFilter,
} from '@/lib/finance/import'
import {
  labelKinds,
  suggestAccounts,
  suggestCategories,
  useRunImport,
  type ImportProgress,
  type ImportResult,
} from './use-import'

export function useImportWizard() {
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
  const [filter, setFilter] = useState<RowFilter>('all')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

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

  async function loadFile(file: File) {
    setReadError(null)
    setResult(null)
    try {
      const parsed = parseCsv(await readText(file))
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

  function reset() {
    setFileName(null)
    setCells([])
    setMap({})
    setResult(null)
    setReadError(null)
  }

  function toggle(line: number) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(line)) next.delete(line)
      else next.add(line)
      return next
    })
  }

  async function importNow() {
    setRunning(true)
    setProgress({ done: 0, total: 0 })
    try {
      const outcome = await runImport(
        {
          rows: rows.filter((row) => selected.has(row.line) && !row.error),
          accounts: accountChoice,
          categories: categoryChoice,
          fallbackAccountId: fallbackAccount,
        },
        setProgress,
      )
      setResult(outcome)
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  return {
    accounts,
    categories,

    fileName,
    header: cells[0] ?? [],
    dataRows: Math.max(cells.length - 1, 0),
    map,
    setMap,
    readError,
    loadFile,
    reset,

    accountLabels,
    accountChoice,
    chooseAccount: (label: string, value: string) =>
      setAccountChoice((current) => ({ ...current, [label]: value })),
    fallbackAccount,
    setFallbackAccount,

    categoryLabels,
    categoryChoice,
    chooseCategory: (label: string, value: string) =>
      setCategoryChoice((current) => ({ ...current, [label]: value })),

    rows,
    summary: summarize(rows, (row) => selected.has(row.line)),
    selected,
    toggle,
    filter,
    setFilter,

    running,
    progress,
    result,
    importNow,
  }
}
