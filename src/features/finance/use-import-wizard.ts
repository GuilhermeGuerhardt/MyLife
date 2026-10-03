/**
 * O estado das quatro etapas da importação: escolher o arquivo, conferir as
 * colunas, apontar contas e categorias, revisar a prévia.
 *
 * Fica fora da tela porque quase tudo aqui é derivação — as linhas saem do
 * arquivo mais o mapeamento, as sugestões saem das linhas, o resumo sai da
 * seleção. A tela só desenha o que este hook já resolveu.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
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
import { treinar } from '@/lib/finance/classificador'
import { sugerirRecorrentes } from '@/lib/finance/recorrentes-do-extrato'
import { useImportRun } from './import-run'
import {
  chaveDaCategoria,
  labelKinds,
  suggestAccounts,
  suggestCategories,
  CREATE,
  IGNORE,
} from './use-import'

export function useImportWizard() {
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const { data: transactions } = useTransactions()
  // A gravação não mora mais aqui: é do provedor na raiz, que sobrevive a esta
  // tela fechar. Daqui sai só o pedido.
  const execucao = useImportRun()

  const [fileName, setFileName] = useState<string | null>(null)
  const [cells, setCells] = useState<string[][]>([])
  const [map, setMap] = useState<ColumnMap>({})
  const [readError, setReadError] = useState<string | null>(null)

  const [accountChoice, setAccountChoice] = useState<Record<string, string>>({})
  const [categoryChoice, setCategoryChoice] = useState<Record<string, string>>({})
  const [fallbackAccount, setFallbackAccount] = useState('')

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<RowFilter>('all')
  const [sugerindo, setSugerindo] = useState(true)

  const estado = execucao.estado
  const running = estado.kind === 'rodando'
  const progress = estado.kind === 'rodando' ? estado.progresso : null

  /**
   * Um resultado já visto antes desta tela abrir é história.
   *
   * Sem isto, voltar a Planilhas depois mostraria de novo o recibo da
   * importação passada em vez da porta para trazer o próximo arquivo. O que
   * terminou enquanto a pessoa estava fora ainda não foi visto, e esse aparece.
   */
  const reciboVelho = useRef(estado.kind === 'concluido' && estado.visto).current
  const result = estado.kind === 'concluido' && !reciboVelho ? estado.resultado : null

  /**
   * Apaga o recibo da importação anterior.
   *
   * Com uma gravação em curso não faz nada: ali `dispensar` significa "esconde
   * o cartão do canto", e trocar de arquivo no meio não é motivo para deixar a
   * pessoa sem o andamento quando sair desta tela.
   */
  const limparRecibo = () => {
    if (estado.kind !== 'rodando') execucao.dispensar()
  }

  const rows = useMemo(() => {
    if (cells.length < 2 || missingFields(map).length > 0) return []
    return markDuplicates(buildRows(cells.slice(1), map), transactions)
  }, [cells, map, transactions])

  // As duas pontas da transferência entram na lista: a conta que recebe também
  // precisa ser apontada, e às vezes ela só existe no arquivo.
  const accountLabels = useMemo(() => {
    const origens = distinctLabels(rows, (row) => row.accountLabel)
    const destinos = distinctLabels(rows, (row) => row.transferToLabel)
    return [...new Set([...origens, ...destinos])]
  }, [rows])
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

  /**
   * O que o seu histórico sabe sobre a categoria de cada linha.
   *
   * O extrato do banco não traz categoria, e sem isto toda importação despeja
   * centenas de lançamentos sem classificação — que ninguém volta para
   * classificar depois. O palpite sai dos lançamentos que você mesmo já
   * categorizou, não de uma tabela pronta: ele conhece a padaria da sua esquina.
   *
   * Só entra onde ficaria vazio. Rótulo vindo do arquivo — inclusive um que
   * você mandou ignorar — manda, e a sugestão nem é calculada.
   */
  const classificador = useMemo(() => treinar(transactions), [transactions])

  const sugestoes = useMemo(() => {
    const fora = new Map<number, { categoryId: string; nome: string; chave: string }>()
    if (!sugerindo) return fora

    const nomes = new Map(categories.map((categoria) => [categoria.id, categoria.name]))

    for (const row of rows) {
      if (row.error || row.kind === 'transfer') continue
      // O arquivo já falou desta linha: a escolha daquele rótulo resolve.
      if (categoryChoice[chaveDaCategoria(row.categoryLabel, row.kind)] !== undefined) continue

      const palpite = classificador.sugerir(row.description, row.kind)
      const nome = palpite && nomes.get(palpite.categoryId)
      // Categoria apagada depois de ter sido usada: o histórico ainda aponta
      // para ela, mas sugerir um nome que não existe mais não ajuda ninguém.
      if (!palpite || !nome) continue

      fora.set(row.line, { categoryId: palpite.categoryId, nome, chave: palpite.chave })
    }

    return fora
  }, [rows, categoryChoice, categories, classificador, sugerindo])

  async function loadFile(file: File) {
    setReadError(null)
    limparRecibo()
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
    setReadError(null)
    limparRecibo()
  }

  function toggle(line: number) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(line)) next.delete(line)
      else next.add(line)
      return next
    })
  }

  /**
   * Entrega o pedido e sai da frente.
   *
   * Não espera o fim de propósito: quem grava é o provedor da raiz, e é ele que
   * continua quando esta tela fechar.
   */
  function importNow() {
    execucao.importar(
      {
        rows: rows.filter((row) => selected.has(row.line) && !row.error),
        accounts: accountChoice,
        categories: categoryChoice,
        fallbackAccountId: fallbackAccount,
        sugestoes: Object.fromEntries(
          [...sugestoes].map(([linha, palpite]) => [linha, palpite.categoryId]),
        ),
      },
      fileName ?? 'planilha',
    )
  }

  /**
   * O que, no arquivo, parece conta de todo mês.
   *
   * Calculado sobre as linhas aproveitáveis, não sobre as marcadas: quem decide
   * é a tela do fim, e lá a pessoa confirma uma a uma.
   */
  const recorrentesSugeridas = useMemo(
    () => sugerirRecorrentes(rows.filter((row) => !row.error)),
    [rows],
  )

  /** De que conta é o rótulo, pela escolha feita na importação. */
  function contaDoRotulo(rotulo: string): string | null {
    const escolhido = accountChoice[rotulo]
    if (escolhido && escolhido !== CREATE && escolhido !== IGNORE) return escolhido
    return fallbackAccount || null
  }

  return {
    accounts,
    categories,
    recorrentesSugeridas,
    contaDoRotulo,

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
    // A chave carrega o rótulo e o tipo: ver `chaveDaCategoria`.
    chooseCategory: (chave: string, value: string) =>
      setCategoryChoice((current) => ({ ...current, [chave]: value })),

    rows,
    sugestoes,
    sugerindo,
    setSugerindo,
    /** Zero quando o app ainda não tem histórico categorizado de onde aprender. */
    baseDeAprendizado: classificador.base,
    summary: summarize(rows, (row) => selected.has(row.line)),
    selected,
    toggle,
    filter,
    setFilter,

    running,
    progress,
    result,
    importNow,
    /** Avisa o provedor de que o recibo já foi mostrado nesta tela. */
    marcarVisto: execucao.marcarVisto,
  }
}
