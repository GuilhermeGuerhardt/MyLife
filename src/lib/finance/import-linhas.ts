/**
 * A linha do arquivo virando um lançamento para revisar.
 *
 * Junta o mapeamento de colunas com a leitura de cada célula e decide o que
 * impede a linha de entrar. Nada aqui grava nada: o resultado é o que a prévia
 * mostra para a pessoa conferir antes de dizer sim.
 */

import { today } from '@/lib/dates'
import { parseAmount } from '@/lib/finance/money'
import type { ColumnMap } from './import-colunas'
import {
  cleanAccountLabel,
  isBlank,
  parseDate,
  parseInstallment,
  parseKind,
  parsePaid,
  parseTransferParties,
  type Installment,
} from './import-celulas'

export interface ImportRow {
  /** Linha no arquivo, contando o cabeçalho — é o que a pessoa vê no Excel. */
  line: number
  date: string
  kind: 'income' | 'expense' | 'transfer'
  amountCents: number
  description: string
  detail: string | null
  accountLabel: string
  /** Conta que recebe, só em transferência. */
  transferToLabel: string
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

    // De onde sai e para onde vai. Fora da transferência só existe a primeira.
    let origem = cleanAccountLabel(cell(cells, map.account))
    let destino = kind === 'transfer' ? cleanAccountLabel(cell(cells, map.transferTo)) : ''

    if (kind === 'transfer') {
      // A coluna manda; a frase é o resgate de quem não tem coluna. O extrato
      // costuma trazer só "Transferência de Banco Azul para Poupança", com o
      // método em branco, e é dali que saem as duas pontas.
      const partes = parseTransferParties(parsed.description)
      if (partes) {
        if (!origem) origem = partes.de
        if (!destino) destino = partes.para
      }
    }

    let error: string | null = null
    if (!date) error = rawDate.trim() ? `Data inválida: "${rawDate.trim()}"` : 'Sem data'
    else if (amountCents === 0) error = rawAmount.trim() ? `Valor inválido: "${rawAmount.trim()}"` : 'Sem valor'
    else if (!parsed.description) error = 'Sem descrição'
    else if (kind === 'transfer' && !destino) {
      // Sem as duas pontas não é transferência, é metade de uma. Melhor recusar
      // a linha do que gravar um dinheiro que sai de uma conta e não chega em
      // nenhuma — que é o que "virar despesa" fazia com ela.
      error = 'Transferência sem conta de destino: escreva "de X para Y" ou aponte a coluna de destino'
    }

    return {
      line,
      date: date ?? today(),
      kind,
      amountCents,
      description: parsed.description,
      detail: isBlank(rawDetail) ? null : rawDetail.trim(),
      accountLabel: origem,
      transferToLabel: destino,
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
    // Transferência fica fora das duas somas: dinheiro que anda entre contas da
    // mesma pessoa não é ganho nem gasto, e somá-lo inflava o mês.
    if (row.kind === 'income') summary.incomeCents += row.amountCents
    else if (row.kind === 'expense') summary.expenseCents += row.amountCents

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
