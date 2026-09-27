import type { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'

/**
 * Apaga a tabela e deixa uma linha vazia no lugar dela.
 *
 * O `deleteTable` do editor tira a tabela e não põe nada no lugar: o cursor
 * escorrega para o bloco seguinte, que pode ser um título ou um item de lista,
 * e ali o Enter faz o que faz num item de lista — sai da lista em vez de
 * quebrar a linha. Quem acabou de apagar uma tabela espera continuar escrevendo
 * onde ela estava.
 *
 * Numa transação só: a tabela vira um parágrafo vazio e o cursor entra nele.
 * Assim o desfazer também traz a tabela de volta de uma vez.
 */
export function excluirTabela(editor: Editor): void {
  const { state } = editor
  const { $from } = state.selection

  for (let nivel = $from.depth; nivel > 0; nivel--) {
    const node = $from.node(nivel)
    if (node.type.name !== 'table') continue

    const inicio = $from.before(nivel)
    const tr = state.tr.replaceWith(inicio, inicio + node.nodeSize, state.schema.nodes.paragraph!.create())
    tr.setSelection(TextSelection.near(tr.doc.resolve(inicio + 1)))
    editor.view.dispatch(tr)
    editor.view.focus()
    return
  }
}
