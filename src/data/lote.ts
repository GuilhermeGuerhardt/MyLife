/**
 * Gravação em lote, tudo ou nada.
 *
 * Mora fora de `adapters` porque os três destinos usam: o do navegador e o da
 * pasta (em `adapters`) e o do SQLite (em `sqlite-store`, que `adapters`
 * importa). Ficar lá criaria um ciclo entre os dois.
 */

import type { BaseRow } from './types'

/**
 * Aplica as alterações de um lote sobre a coleção, sem gravar nada.
 *
 * Confere tudo antes: um id que sumiu (apagado por outra janela que esta ainda
 * não releu) recusa o lote inteiro. Antes cada item era gravado na sua vez, e
 * o erro no quinto deixava os quatro primeiros gravados e o resto não, com a
 * tela tendo de explicar "parou no meio: 4 de 10".
 */
export function aplicarPatches<T extends BaseRow>(
  rows: T[],
  items: Array<{ id: string; patch: Partial<T> }>,
  table: string,
): { rows: T[]; alterados: T[] } {
  const posicao = new Map(rows.map((row, indice) => [row.id, indice]))
  const faltando = items.find((item) => !posicao.has(item.id))
  if (faltando) throw new Error(`Registro ${faltando.id} não encontrado em ${table}`)

  const agora = new Date().toISOString()
  const proximas = [...rows]
  const alterados = items.map(({ id, patch }) => {
    const indice = posicao.get(id)!
    const alterado = { ...proximas[indice]!, ...patch, updated_at: agora }
    proximas[indice] = alterado
    return alterado
  })
  return { rows: proximas, alterados }
}
