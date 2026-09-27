// @vitest-environment happy-dom
import { Editor } from '@tiptap/core'
import { TableKit } from '@tiptap/extension-table'
import { TaskItem } from '@tiptap/extension-task-item'
import { TaskList } from '@tiptap/extension-task-list'
import { StarterKit } from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { Alternavel, AlternavelTitulo, Destaque } from './blocos-notion'

/**
 * O Enter, em cada bloco do caderno.
 *
 * Existe por um defeito de verdade: o bloco alternável declara um atalho de
 * `Enter` para que a tecla, dentro do título dele, desça para o conteúdo. Só
 * que atalho declarado num nó do TipTap vale no documento inteiro — e assim
 * todo Enter da anotação caía ali, movendo o cursor para o bloco seguinte em
 * vez de quebrar a linha. Escapava só o último bloco do documento, onde a conta
 * de destino estourava, o que fazia o defeito parecer aleatório.
 *
 * Por isso o teste não se limita ao bloco alternável: quebrar linha é a tecla
 * mais usada do editor, e vale conferir em cada tipo de bloco.
 */

function abrir(html: string): Editor {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, TaskList, TaskItem, Alternavel, AlternavelTitulo, Destaque, TableKit],
    content: html,
  })
}

function enter(ed: Editor): void {
  ed.view.someProp('handleKeyDown', (f) =>
    f(ed.view, new KeyboardEvent('keydown', { key: 'Enter' })),
  )
}

/** Posição logo depois do texto informado. */
function depoisDe(ed: Editor, texto: string): number {
  let achado = -1
  ed.state.doc.descendants((node, pos) => {
    if (achado === -1 && node.isText && node.text?.includes(texto)) {
      achado = pos + node.text.indexOf(texto) + texto.length
    }
  })
  return achado
}

describe('Enter quebra a linha', () => {
  it('no parágrafo com texto, no meio do documento', () => {
    const ed = abrir('<p>primeiro</p><h2>depois</h2>')
    ed.commands.setTextSelection(depoisDe(ed, 'primeiro'))
    enter(ed)
    expect(ed.getHTML()).toContain('<p>primeiro</p><p></p><h2>depois</h2>')
    ed.destroy()
  })

  it('no parágrafo vazio, no meio do documento', () => {
    const ed = abrir('<p></p><h2>depois</h2>')
    ed.commands.setTextSelection(1)
    enter(ed)
    expect(ed.getHTML()).toContain('<p></p><p></p><h2>depois</h2>')
    ed.destroy()
  })

  it('na lista com marcador', () => {
    const ed = abrir('<ul><li><p>um</p></li></ul><h2>fim</h2>')
    ed.commands.setTextSelection(depoisDe(ed, 'um'))
    enter(ed)
    expect(ed.getHTML()).toContain('<li><p>um</p></li><li><p></p></li>')
    ed.destroy()
  })

  it('na lista numerada', () => {
    const ed = abrir('<ol><li><p>um</p></li></ol><h2>fim</h2>')
    ed.commands.setTextSelection(depoisDe(ed, 'um'))
    enter(ed)
    expect(ed.getHTML()).toContain('<li><p>um</p></li><li><p></p></li>')
    ed.destroy()
  })

  it('na lista de tarefas', () => {
    const ed = abrir(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>um</p></li></ul><h2>fim</h2>',
    )
    ed.commands.setTextSelection(depoisDe(ed, 'um'))
    enter(ed)
    expect(ed.getHTML().match(/data-type="taskItem"/g)).toHaveLength(2)
    ed.destroy()
  })

  it('no título', () => {
    const ed = abrir('<h2>titulo</h2><p>depois</p>')
    ed.commands.setTextSelection(depoisDe(ed, 'titulo'))
    enter(ed)
    expect(ed.getHTML()).toContain('<h2>titulo</h2><p></p>')
    ed.destroy()
  })

  it('na citação', () => {
    const ed = abrir('<blockquote><p>um</p></blockquote><h2>fim</h2>')
    ed.commands.setTextSelection(depoisDe(ed, 'um'))
    enter(ed)
    expect(ed.getHTML()).toContain('<blockquote><p>um</p><p></p></blockquote>')
    ed.destroy()
  })

  it('no destaque', () => {
    const ed = abrir('<blockquote data-destaque="sim"><p>um</p></blockquote><h2>fim</h2>')
    ed.commands.setTextSelection(depoisDe(ed, 'um'))
    enter(ed)
    expect(ed.getHTML()).toContain('<p>um</p><p></p>')
    ed.destroy()
  })

  it('no corpo do bloco alternável', () => {
    const ed = abrir(
      '<details data-aberto="true"><summary>T</summary><p>um</p></details><h2>fim</h2>',
    )
    ed.commands.setTextSelection(depoisDe(ed, 'um'))
    enter(ed)
    expect(ed.getHTML()).toContain('<p>um</p><p></p>')
    ed.destroy()
  })

  it('na célula da tabela', () => {
    const ed = abrir('<table><tbody><tr><td><p>um</p></td></tr></tbody></table><h2>fim</h2>')
    ed.commands.setTextSelection(depoisDe(ed, 'um'))
    enter(ed)
    expect(ed.getHTML()).toContain('<p>um</p><p></p>')
    ed.destroy()
  })
})

describe('Enter no título do bloco alternável', () => {
  it('desce para o conteúdo em vez de partir o título em dois', () => {
    const ed = abrir(
      '<details data-aberto="true"><summary>Titulo</summary><p>corpo</p></details><p>fora</p>',
    )
    ed.commands.setTextSelection(depoisDe(ed, 'Titulo'))
    enter(ed)

    expect(ed.getHTML().match(/<summary>/g)).toHaveLength(1)
    expect(ed.getHTML()).toContain('<summary>Titulo</summary>')
    ed.destroy()
  })
})
