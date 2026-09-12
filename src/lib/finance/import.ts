/**
 * Importação de extrato em planilha (CSV).
 *
 * O ganho aqui não é técnico, é de atrito: quem já mantém as contas em outro
 * app não vai redigitar seis meses de lançamento à mão. Exportar de lá e jogar
 * o arquivo aqui é a única forma de a migração acontecer de verdade.
 *
 * Nada neste arquivo conhece React ou o banco. São funções puras de texto para
 * `ImportRow`, o que permite testar o caso chato — vírgula dentro de aspas,
 * "R$ 1.130,00", parcela "(5/48)" — sem montar tela nenhuma.
 *
 * O formato não é fixo de propósito. Cada app exporta com um cabeçalho
 * diferente, então `detectColumns` chuta o mapeamento pelos nomes das colunas e
 * a tela deixa corrigir. Um formato desconhecido vira trabalho de dois cliques,
 * não um pedido de funcionalidade.
 */

import { today } from '@/lib/dates'
import { parseAmount } from '@/lib/finance/money'

// ---------------------------------------------------------------------------
// Leitura do CSV
// ---------------------------------------------------------------------------

/**
 * Descobre o separador contando ocorrências fora de aspas na primeira linha.
 *
 * Testar `,` e `;` importa no Brasil: o Excel em português exporta com ponto e
 * vírgula justamente porque a vírgula já é o separador decimal.
 */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const candidates = [',', ';', '\t', '|']

  let best = ','
  let bestCount = 0
  for (const candidate of candidates) {
    let count = 0
    let quoted = false
    for (const char of firstLine) {
      if (char === '"') quoted = !quoted
      else if (char === candidate && !quoted) count++
    }
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }
  return best
}

/**
 * CSV para matriz de strings.
 *
 * Implementado à mão em vez de com uma dependência: a regra do RFC 4180 cabe
 * em trinta linhas, e o parser precisa aguentar exatamente um caso que um
 * `split(',')` erraria — o valor `"R$ 1.130,00"`, com vírgula dentro das
 * aspas. Aspas duplicadas (`""`) viram uma aspa literal.
 */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  // O BOM do Excel entraria como parte do nome da primeira coluna e estragaria
  // a detecção do cabeçalho.
  const input = text.replace(/^﻿/, '')

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < input.length; index++) {
    const char = input[index]

    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"'
          index++
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Linha em branco no fim do arquivo é regra, não exceção.
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''))
}

// ---------------------------------------------------------------------------
// Mapeamento de colunas
// ---------------------------------------------------------------------------

export type ImportField =
  | 'date'
  | 'amount'
  | 'kind'
  | 'description'
  | 'detail'
  | 'account'
  | 'category'
  | 'status'

export const FIELD_LABELS: Record<ImportField, string> = {
  date: 'Data',
  amount: 'Valor',
  kind: 'Tipo (receita/despesa)',
  description: 'Descrição',
  detail: 'Complemento',
  account: 'Conta',
  category: 'Categoria',
  status: 'Situação',
}

/** Campos sem os quais não dá para montar um lançamento. */
export const REQUIRED_FIELDS: ImportField[] = ['date', 'amount', 'description']

export type ColumnMap = Partial<Record<ImportField, number>>

const HEADER_SYNONYMS: Record<ImportField, string[]> = {
  date: ['data', 'date', 'data lancamento', 'data da transacao', 'dia', 'vencimento', 'competencia'],
  amount: ['valor', 'amount', 'quantia', 'preco', 'value', 'montante', 'total'],
  kind: ['tipo', 'kind', 'type', 'natureza', 'operacao', 'entrada saida'],
  description: ['nome', 'descricao', 'description', 'historico', 'titulo', 'estabelecimento', 'lancamento', 'memo'],
  detail: ['complemento', 'observacao', 'observacoes', 'detalhe', 'detalhes', 'nota', 'notas', 'obs'],
  account: ['metodo', 'conta', 'account', 'banco', 'carteira', 'forma de pagamento', 'meio', 'origem'],
  category: ['categoria', 'category', 'classificacao', 'grupo'],
  status: ['status', 'situacao', 'estado', 'pago', 'pagamento'],
}

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Chuta o papel de cada coluna pelo nome do cabeçalho.
 *
 * Casa primeiro por igualdade e só depois por conteúdo, senão "data" acharia
 * "data lancamento" antes de "data" e o campo certo perderia a vaga. Uma coluna
 * já usada não é oferecida a outro campo — `Descrição` no arquivo de exemplo é
 * complemento, e sem isso ela roubaria o lugar de `Nome`.
 */
export function detectColumns(header: string[]): ColumnMap {
  const normalized = header.map(normalizeText)
  const map: ColumnMap = {}
  const taken = new Set<number>()

  const claim = (field: ImportField, predicate: (name: string, synonym: string) => boolean) => {
    if (map[field] !== undefined) return
    for (const synonym of HEADER_SYNONYMS[field]) {
      const index = normalized.findIndex(
        (name, position) => !taken.has(position) && name !== '' && predicate(name, synonym),
      )
      if (index !== -1) {
        map[field] = index
        taken.add(index)
        return
      }
    }
  }

  const fields = Object.keys(HEADER_SYNONYMS) as ImportField[]
  for (const field of fields) claim(field, (name, synonym) => name === synonym)
  for (const field of fields) claim(field, (name, synonym) => name.includes(synonym))

  // Uma coluna com cara de descrição que sobrou é complemento. É o caso do
  // extrato com "Nome" e "Descrição" lado a lado: a primeira é o lançamento, a
  // segunda detalha. Sem esta passada a segunda ficaria órfã e o "Claro" que
  // diferencia quatro cobranças idênticas da Boleto se perderia.
  if (map.detail === undefined) {
    const index = normalized.findIndex(
      (name, position) =>
        !taken.has(position) &&
        name !== '' &&
        DETAIL_FALLBACK.some((synonym) => name.includes(synonym)),
    )
    if (index !== -1) map.detail = index
  }

  return map
}

const DETAIL_FALLBACK = ['descricao', 'description', 'historico', 'memo', 'titulo']

export function missingFields(map: ColumnMap): ImportField[] {
  return REQUIRED_FIELDS.filter((field) => map[field] === undefined)
}

// ---------------------------------------------------------------------------
// Leitura de cada célula
// ---------------------------------------------------------------------------

/**
 * Aceita ISO (`2026-09-30`), brasileiro (`30/09/2026`) e as variantes com dois
 * dígitos de ano. Devolve `null` no que não reconhece, para a linha virar um
 * erro visível em vez de um lançamento com data errada.
 */
export function parseDate(value: string): string | null {
  const text = value.trim()
  if (!text) return null

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(text)
  if (br) {
    const year = Number(br[3])
    // "26" é 2026, não 26 d.C. — o pivô em 2000 basta para extrato bancário.
    return validDate(year < 100 ? 2000 + year : year, Number(br[2]), Number(br[1]))
  }

  return null
}

function validDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day, 12)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const INCOME_WORDS = ['receita', 'entrada', 'credito', 'income', 'ganho', 'provento', 'deposito', 'recebimento']
const EXPENSE_WORDS = ['despesa', 'saida', 'debito', 'expense', 'gasto', 'pagamento', 'compra']

/**
 * Descobre se é receita ou despesa.
 *
 * A coluna de tipo manda quando existe. Sem ela, sobra o sinal do valor — que
 * é como a maioria dos extratos bancários se expressa.
 */
export function parseKind(typeText: string, rawAmount: string): 'income' | 'expense' {
  const text = normalizeText(typeText)
  if (text) {
    if (INCOME_WORDS.some((word) => text.includes(word))) return 'income'
    if (EXPENSE_WORDS.some((word) => text.includes(word))) return 'expense'
  }
  return rawAmount.trim().startsWith('-') ? 'expense' : text ? 'expense' : 'income'
}

const PAID_WORDS = ['pago', 'paga', 'recebido', 'recebida', 'efetivado', 'liquidado', 'concluido', 'sim', 'ok', 'true']
const UNPAID_WORDS = ['falta', 'pendente', 'aberto', 'previsto', 'agendado', 'a pagar', 'a receber', 'nao', 'false']

/**
 * "Já foi pago" e "Falta pagar" contêm os dois a palavra "pagar", então a
 * negação é testada primeiro — o contrário marcaria como quitada toda conta
 * que ainda vence.
 */
export function parsePaid(statusText: string, fallback = true): boolean {
  const text = normalizeText(statusText)
  if (!text) return fallback
  if (UNPAID_WORDS.some((word) => text.includes(word))) return false
  if (PAID_WORDS.some((word) => text.includes(word))) return true
  return fallback
}

export interface Installment {
  n: number
  total: number
}

/**
 * Separa a parcela do nome: `Geladeira (5/48)` vira `Geladeira` + 5 de 48.
 *
 * Guardar isso estruturado é o que permite ao app saber quanto ainda falta da
 * moto — a informação estava ali no texto, só não era somável.
 */
export function parseInstallment(description: string): {
  description: string
  installment: Installment | null
} {
  const match = /^(.*?)\s*[([](\d{1,3})\s*[/de]{1,2}\s*(\d{1,3})[)\]]\s*$/i.exec(description.trim())
  if (!match) return { description: description.trim(), installment: null }

  const n = Number(match[2])
  const total = Number(match[3])
  if (n < 1 || total < 1 || n > total) return { description: description.trim(), installment: null }

  return { description: (match[1] ?? '').trim(), installment: { n, total } }
}

/**
 * Limpa o rótulo da conta: `Conta - Banco Azul` vira `Banco Azul`.
 *
 * O prefixo é do app de origem, não do banco. Mantê-lo faria "Conta - Banco
 * Inter" e "Banco Azul" virarem duas contas diferentes na hora de casar.
 */
export function cleanAccountLabel(value: string): string {
  const text = value.trim()
  const match = /^(?:conta|cartao|cart[ãa]o|carteira)\s*[-–:]\s*(.+)$/i.exec(text)
  return (match?.[1] ?? text).trim()
}

/** Placeholder de célula vazia usado por vários exportadores. */
function isBlank(value: string): boolean {
  const text = value.trim()
  return text === '' || text === '-' || text === '--' || text === 'N/A'
}

// ---------------------------------------------------------------------------
// Linhas prontas para revisão
// ---------------------------------------------------------------------------

export interface ImportRow {
  /** Linha no arquivo, contando o cabeçalho — é o que a pessoa vê no Excel. */
  line: number
  date: string
  kind: 'income' | 'expense'
  amountCents: number
  description: string
  detail: string | null
  accountLabel: string
  categoryLabel: string
  paid: boolean
  installment: Installment | null
  /** Preenchido quando a linha não vira lançamento. */
  error: string | null
  /** Igual a um lançamento que já existe no app. */
  duplicate: boolean
  /** Igual a outra linha do próprio arquivo, mais acima. */
  repeated: boolean
}

function cell(cells: string[], index: number | undefined): string {
  return index === undefined ? '' : (cells[index] ?? '')
}

/**
 * Converte as linhas de dados em `ImportRow`.
 *
 * Linha ruim não interrompe a importação: ela vira uma linha com `error` e a
 * tela mostra o motivo. Um arquivo de 400 lançamentos com três datas quebradas
 * deve importar 397, não falhar inteiro.
 */
export function buildRows(dataRows: string[][], map: ColumnMap, firstLine = 2): ImportRow[] {
  return dataRows.map((cells, index) => {
    const line = firstLine + index
    const rawDate = cell(cells, map.date)
    const rawAmount = cell(cells, map.amount)
    const rawDescription = cell(cells, map.description)
    const rawDetail = cell(cells, map.detail)

    const date = parseDate(rawDate)
    const amountCents = Math.abs(parseAmount(rawAmount))
    const parsed = parseInstallment(rawDescription)
    const kind = parseKind(cell(cells, map.kind), rawAmount)

    let error: string | null = null
    if (!date) error = rawDate.trim() ? `Data inválida: "${rawDate.trim()}"` : 'Sem data'
    else if (amountCents === 0) error = rawAmount.trim() ? `Valor inválido: "${rawAmount.trim()}"` : 'Sem valor'
    else if (!parsed.description) error = 'Sem descrição'

    return {
      line,
      date: date ?? today(),
      kind,
      amountCents,
      description: parsed.description,
      detail: isBlank(rawDetail) ? null : rawDetail.trim(),
      accountLabel: cleanAccountLabel(cell(cells, map.account)),
      categoryLabel: isBlank(cell(cells, map.category)) ? '' : cell(cells, map.category).trim(),
      paid: parsePaid(cell(cells, map.status)),
      installment: parsed.installment,
      error,
      duplicate: false,
      repeated: false,
    }
  })
}

// ---------------------------------------------------------------------------
// Deduplicação
// ---------------------------------------------------------------------------

export interface ExistingLike {
  date: string
  amount_cents: number
  description: string
  kind: 'income' | 'expense' | 'transfer'
}

/**
 * Identidade de um lançamento para fins de repetição.
 *
 * Data, valor, tipo e descrição normalizada. Sem a conta de propósito: o mesmo
 * extrato reimportado depois de a pessoa ter renomeado a conta continua sendo
 * o mesmo lançamento, e duplicar seria pior do que deixar passar.
 */
export function dedupKey(row: {
  date: string
  amountCents: number
  description: string
  kind: string
}): string {
  return [row.date, row.amountCents, row.kind, normalizeText(row.description)].join('|')
}

/**
 * Marca o que já existe no app e o que se repete dentro do próprio arquivo.
 *
 * Contagem em vez de conjunto porque repetição legítima acontece: duas viagens
 * de metrô de R$ 5,40 no mesmo dia são dois lançamentos. Só a partir da
 * terceira ocorrência, quando o app já tem duas, é que sobra duplicata.
 */
export function markDuplicates(rows: ImportRow[], existing: ExistingLike[]): ImportRow[] {
  const seen = new Map<string, number>()
  for (const item of existing) {
    const key = dedupKey({
      date: item.date,
      amountCents: item.amount_cents,
      description: item.description,
      kind: item.kind,
    })
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }

  const withinFile = new Map<string, number>()

  return rows.map((row) => {
    if (row.error) return row

    const key = dedupKey(row)
    const remaining = seen.get(key) ?? 0
    const repeatedInFile = (withinFile.get(key) ?? 0) > 0

    if (remaining > 0) {
      seen.set(key, remaining - 1)
      return { ...row, duplicate: true }
    }

    withinFile.set(key, (withinFile.get(key) ?? 0) + 1)
    return { ...row, repeated: repeatedInFile }
  })
}

// ---------------------------------------------------------------------------
// Resumo
// ---------------------------------------------------------------------------

export interface ImportSummary {
  total: number
  ready: number
  duplicates: number
  errors: number
  incomeCents: number
  expenseCents: number
  from: string | null
  to: string | null
}

export function summarize(rows: ImportRow[], selected: (row: ImportRow) => boolean): ImportSummary {
  const summary: ImportSummary = {
    total: rows.length,
    ready: 0,
    duplicates: 0,
    errors: 0,
    incomeCents: 0,
    expenseCents: 0,
    from: null,
    to: null,
  }

  for (const row of rows) {
    if (row.error) {
      summary.errors++
      continue
    }
    if (row.duplicate) summary.duplicates++
    if (!selected(row)) continue

    summary.ready++
    if (row.kind === 'income') summary.incomeCents += row.amountCents
    else summary.expenseCents += row.amountCents

    if (!summary.from || row.date < summary.from) summary.from = row.date
    if (!summary.to || row.date > summary.to) summary.to = row.date
  }

  return summary
}

/** Rótulos distintos de uma coluna, na ordem em que aparecem. */
export function distinctLabels(rows: ImportRow[], pick: (row: ImportRow) => string): string[] {
  const seen = new Set<string>()
  const labels: string[] = []
  for (const row of rows) {
    const label = pick(row).trim()
    if (!label || seen.has(label)) continue
    seen.add(label)
    labels.push(label)
  }
  return labels
}

/** As abas da prévia. */
export type RowFilter = 'all' | 'ready' | 'duplicate' | 'error'

export function rowMatches(row: ImportRow, filter: RowFilter): boolean {
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
 * tentativa "Alimentação" chegaria cheia de losangos de interrogação.
 */
export async function readText(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer()
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  if (!utf8.includes('\uFFFD')) return utf8
  return new TextDecoder('windows-1252').decode(buffer)
}
