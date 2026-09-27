// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { alternarTarefaDaNota, tarefasDaNota } from './tarefas-da-nota'

const MARKDOWN = ['## Aula', '', '- [ ] ler o capítulo 3', '- [x] entregar a lista', '- texto solto'].join(
  '\n',
)

const HTML =
  '<ul data-type="taskList">' +
  '<li data-checked="false"><label><input type="checkbox"><span></span></label><div><p>ler o capítulo 3</p></div></li>' +
  '<li data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>entregar a lista</p></div></li>' +
  '</ul>'

describe('as tarefas de uma anotação', () => {
  it('lê as do Markdown com texto e estado', () => {
    expect(tarefasDaNota(MARKDOWN, 'markdown')).toEqual([
      { ordinal: 0, texto: 'ler o capítulo 3', feita: false },
      { ordinal: 1, texto: 'entregar a lista', feita: true },
    ])
  })

  it('lê as do texto formatado do mesmo jeito', () => {
    expect(tarefasDaNota(HTML, 'html')).toEqual([
      { ordinal: 0, texto: 'ler o capítulo 3', feita: false },
      { ordinal: 1, texto: 'entregar a lista', feita: true },
    ])
  })

  it('anotação sem tarefa nenhuma devolve lista vazia', () => {
    expect(tarefasDaNota('<p>só texto</p>', 'html')).toEqual([])
    expect(tarefasDaNota('só texto', 'markdown')).toEqual([])
  })
})

describe('marcar de fora da anotação', () => {
  it('marca a do Markdown pela posição', () => {
    const novo = alternarTarefaDaNota(MARKDOWN, 'markdown', 0, false)!
    expect(novo).toContain('- [x] ler o capítulo 3')
    expect(novo).toContain('- [x] entregar a lista')
  })

  it('marca a do texto formatado, e os dois atributos concordam', () => {
    const novo = alternarTarefaDaNota(HTML, 'html', 0, false)!
    const primeira = tarefasDaNota(novo, 'html')[0]!
    expect(primeira.feita).toBe(true)
    expect(novo).toContain('data-checked="true"')
  })

  it('desmarca de volta', () => {
    const marcada = alternarTarefaDaNota(HTML, 'html', 1, true)!
    expect(tarefasDaNota(marcada, 'html')[1]!.feita).toBe(false)
  })

  /**
   * A anotação pode ter mudado entre ver a lista e clicar nela. Marcar a tarefa
   * errada em silêncio é pior do que o clique não funcionar.
   */
  it('não mexe em nada quando o estado divergiu', () => {
    expect(alternarTarefaDaNota(HTML, 'html', 0, true)).toBeNull()
    expect(alternarTarefaDaNota(MARKDOWN, 'markdown', 1, false)).toBeNull()
  })

  it('posição que não existe não faz nada', () => {
    expect(alternarTarefaDaNota(HTML, 'html', 9, false)).toBeNull()
  })
})
