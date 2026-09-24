/**
 * O andamento e o recibo de uma importação.
 *
 * Um módulo à parte, sem dependência nenhuma, porque estas três coisas são
 * ditas em dois lugares muito distantes: na tela de Planilhas, que carrega o
 * mundo das finanças, e no cartão do canto, que está montado na raiz do app em
 * todas as telas. Se o cartão precisasse importar a gravação só para saber
 * escrever "42 lançamentos importados", o pacote inicial levaria o importador
 * inteiro para quem abriu o Caderno.
 */

/** Andamento da gravação, para a barra saber onde está. */
export interface ImportProgress {
  done: number
  total: number
}

export interface ImportResult {
  transactions: number
  accountsCreated: number
  categoriesCreated: number
}

/** O recibo da importação, em palavras. */
export function descreverResultado(result: ImportResult): { titulo: string; detalhe: string } {
  const criados = [
    result.accountsCreated > 0 &&
      `${result.accountsCreated} ${result.accountsCreated === 1 ? 'conta criada' : 'contas criadas'}`,
    result.categoriesCreated > 0 &&
      `${result.categoriesCreated} ${result.categoriesCreated === 1 ? 'categoria criada' : 'categorias criadas'}`,
  ].filter(Boolean)

  const etiqueta = 'Os lançamentos ficaram com a etiqueta "importado".'

  return {
    titulo: `${result.transactions} ${result.transactions === 1 ? 'lançamento importado' : 'lançamentos importados'}`,
    detalhe: criados.length > 0 ? `${criados.join(' e ')}. ${etiqueta}` : etiqueta,
  }
}
