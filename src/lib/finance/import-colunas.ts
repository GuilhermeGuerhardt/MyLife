/**
 * Que papel cada coluna do arquivo cumpre.
 *
 * Cada app exporta com um cabeçalho diferente, então o mapeamento é um chute
 * pelos nomes das colunas — e a tela deixa corrigir. Um formato desconhecido
 * vira trabalho de dois cliques, não um pedido de funcionalidade.
 */

export type ImportField =
  | 'date'
  | 'amount'
  | 'kind'
  | 'description'
  | 'detail'
  | 'account'
  | 'transferTo'
  | 'category'
  | 'status'

export const FIELD_LABELS: Record<ImportField, string> = {
  date: 'Data',
  amount: 'Valor',
  kind: 'Tipo (receita/despesa)',
  description: 'Descrição',
  detail: 'Complemento',
  account: 'Conta',
  transferTo: 'Conta de destino (transferência)',
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
  // Sem o singelo "para": na passada por conteúdo ele acharia "Comparativo" e
  // qualquer cabeçalho que por acaso contenha essas quatro letras.
  transferTo: ['conta de destino', 'conta destino', 'destino', 'para conta'],
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
  // diferencia quatro cobranças idênticas do mesmo boleto se perderia.
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
