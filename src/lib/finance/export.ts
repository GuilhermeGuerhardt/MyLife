/**
 * Exportação dos lançamentos em planilha (CSV).
 *
 * O par do `import.ts`. Dado que sai e não volta é dado preso: quem exporta
 * quer abrir no Excel, conferir com o contador ou levar para outro app — e,
 * eventualmente, importar de volta aqui depois de mexer.
 *
 * Por isso o formato não é inventado: os nomes das colunas são exatamente os
 * sinônimos que `detectColumns` já reconhece, e cada valor é escrito na forma
 * que o `parse*` correspondente sabe ler. O arquivo exportado, reimportado sem
 * nenhuma edição, reproduz os mesmos lançamentos — e há teste para isso.
 *
 * Duas escolhas para o Excel brasileiro: separador `;`, porque a vírgula já é
 * o separador decimal aqui, e BOM no começo, sem o qual ele desenha "Alimentação"
 * como "AlimentaÃ§Ã£o".
 */

import type { Competence } from './billing'

/**
 * Cabeçalho do arquivo.
 *
 * Cada nome é um sinônimo exato de `HEADER_SYNONYMS` no `import.ts`. Mudar
 * qualquer um aqui sem mexer lá quebra a reimportação em silêncio — o mapeamento
 * de colunas simplesmente deixa de achar o campo.
 */
export const EXPORT_HEADER = [
  'Data',
  'Valor',
  'Tipo',
  'Descrição',
  'Complemento',
  'Conta',
  'Destino',
  'Categoria',
  'Situação',
] as const

export interface ExportTransaction {
  date: string
  kind: 'income' | 'expense' | 'transfer'
  amount_cents: number
  description: string
  notes: string | null
  account_id: string
  /** Conta que recebe, só em transferência. */
  transfer_account_id: string | null
  category_id: string | null
  paid: boolean
  installment_n: number | null
  installment_total: number | null
}

const KIND_LABEL: Record<ExportTransaction['kind'], string> = {
  income: 'Receita',
  expense: 'Despesa',
  transfer: 'Transferência',
}

/** ISO para dd/mm/aaaa — como o Excel em português espera ver uma data. */
export function toBrDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return day && month && year ? `${day}/${month}/${year}` : iso
}

/** Centavos para "1.234,56", sem símbolo: o Excel trata como número. */
export function toBrAmount(cents: number): string {
  const abs = Math.abs(cents)
  const reais = Math.floor(abs / 100)
  const centavos = String(abs % 100).padStart(2, '0')
  const agrupado = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${cents < 0 ? '-' : ''}${agrupado},${centavos}`
}

/**
 * Devolve a descrição com a parcela no fim, quando houver.
 *
 * `parseInstallment` lê exatamente esta forma na volta, então "Geladeira (3/12)"
 * reimportado volta a ser a parcela 3 de 12 em vez de virar parte do nome.
 */
export function withInstallment(
  description: string,
  n: number | null,
  total: number | null,
): string {
  if (!n || !total || total <= 1) return description
  return `${description} (${n}/${total})`
}

/** Escapa um campo conforme o RFC 4180 — o mesmo que `parseCsv` desfaz. */
export function escapeField(value: string, delimiter: string): string {
  if (!value.includes(delimiter) && !/["\r\n]/.test(value)) return value
  return `"${value.replace(/"/g, '""')}"`
}

export function toCsv(rows: readonly (readonly string[])[], delimiter = ';'): string {
  return rows.map((row) => row.map((cell) => escapeField(cell, delimiter)).join(delimiter)).join('\r\n')
}

export interface ExportNames {
  account: (id: string) => string
  category: (id: string | null) => string
}

/**
 * Monta a matriz do arquivo: cabeçalho e uma linha por lançamento.
 *
 * Ordenado por data crescente — é como um extrato se lê, e é a ordem em que a
 * reimportação encontraria os mesmos lançamentos.
 */
export function buildExportRows(
  transactions: readonly ExportTransaction[],
  names: ExportNames,
): string[][] {
  const ordenadas = [...transactions].sort((a, b) => a.date.localeCompare(b.date))

  return [
    [...EXPORT_HEADER],
    ...ordenadas.map((tx) => [
      toBrDate(tx.date),
      toBrAmount(tx.amount_cents),
      KIND_LABEL[tx.kind],
      withInstallment(tx.description, tx.installment_n, tx.installment_total),
      tx.notes ?? '',
      names.account(tx.account_id),
      // A conta que recebe. Sem esta coluna a transferência voltava pela metade
      // — o arquivo dizia que R$ 100 saíram e não dizia para onde foram.
      tx.transfer_account_id ? names.account(tx.transfer_account_id) : '',
      names.category(tx.category_id),
      tx.paid ? 'Pago' : 'Em aberto',
    ]),
  ]
}

/** BOM na frente: sem ele o Excel lê o arquivo como Latin-1 e come os acentos. */
export function toCsvFile(rows: readonly (readonly string[])[], delimiter = ';'): string {
  return `﻿${toCsv(rows, delimiter)}\r\n`
}

export type ExportScope = 'month' | 'year' | 'all'

export const SCOPE_LABELS: Record<ExportScope, string> = {
  month: 'Mês aberto',
  year: 'Últimos 12 meses',
  all: 'Tudo',
}

/** Os lançamentos que o escopo escolhido alcança, pela competência. */
export function filterByScope<T extends { competence: Competence }>(
  transactions: readonly T[],
  scope: ExportScope,
  competence: Competence,
  addMonths: (competence: Competence, months: number) => Competence,
): T[] {
  if (scope === 'all') return [...transactions]
  if (scope === 'month') return transactions.filter((tx) => tx.competence === competence)

  const desde = addMonths(competence, -11)
  return transactions.filter((tx) => tx.competence >= desde && tx.competence <= competence)
}

export function exportFilename(scope: ExportScope, competence: Competence, isoDate: string): string {
  if (scope === 'month') return `life-lancamentos-${competence}.csv`
  if (scope === 'year') return `life-lancamentos-12-meses-${isoDate}.csv`
  return `life-lancamentos-${isoDate}.csv`
}
