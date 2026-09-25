/**
 * Importação de extrato em planilha (CSV).
 *
 * O ganho aqui não é técnico, é de atrito: quem já mantém as contas em outro
 * app não vai redigitar seis meses de lançamento à mão. Exportar de lá e jogar
 * o arquivo aqui é a única forma de a migração acontecer de verdade.
 *
 * Nada neste caminho conhece React ou o banco. São funções puras de texto para
 * `ImportRow`, o que permite testar o caso chato — vírgula dentro de aspas,
 * "R$ 1.130,00", parcela "(5/48)", transferência entre contas — sem montar tela
 * nenhuma.
 *
 * O caminho tem quatro etapas, cada uma num arquivo:
 *
 * 1. `import-csv` — o texto vira uma matriz de células.
 * 2. `import-colunas` — cada coluna ganha um papel.
 * 3. `import-celulas` — cada célula vira data, valor, tipo, parcela.
 * 4. `import-linhas` — tudo isso vira a linha que a prévia mostra.
 *
 * E `import-dedup` responde à pergunta que vem depois: isto já está no app?
 *
 * Este arquivo é só a porta. Quem usa o importador continua importando daqui,
 * e as etapas ficam livres para mudar de tamanho sem espalhar mudança de
 * `import` por seis telas.
 */

export { detectDelimiter, parseCsv, readText } from './import-csv'

export {
  detectColumns,
  FIELD_LABELS,
  missingFields,
  normalizeText,
  REQUIRED_FIELDS,
  type ColumnMap,
  type ImportField,
} from './import-colunas'

export {
  cleanAccountLabel,
  parseDate,
  parseInstallment,
  parseKind,
  parsePaid,
  parseTransferParties,
  type Installment,
} from './import-celulas'

export {
  buildRows,
  distinctLabels,
  rowMatches,
  summarize,
  type ImportRow,
  type ImportSummary,
  type RowFilter,
} from './import-linhas'

export { dedupKey, markDuplicates, type ExistingLike } from './import-dedup'
