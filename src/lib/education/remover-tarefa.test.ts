// @vitest-environment happy-dom

/**
 * Apagar a caixinha de dentro da anotação.
 *
 * É a única operação do caderno que não tem desfazer, então o teste cobre mais
 * a recusa do que o sucesso: texto que não bate, ordinal que não existe, e o
 * caso de a anotação ter mudado entre a tela listar e a pessoa confirmar.
 */

import { describe, expect, it } from 'vitest'
import { removerTarefaDaNota, tarefasDaNota } from './tarefas-da-nota'

const MD = [
  '# Aula 3',
  '',
  '- [ ] Refazer a lista',
  '- [x] Ler o capítulo',
  '  - [ ] Seção 2',
  '',
  'Fim.',
].join('\n')

const HTML =
  '<h2>Aula 3</h2>' +
  '<ul data-type="taskList">' +
  '<li data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Refazer a lista</p></div></li>' +
  '<li data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>Ler o capítulo</p></div></li>' +
  '</ul>' +
  '<p>Fim.</p>'

describe('markdown', () => {
  it('tira só a linha da tarefa', () => {
    const depois = removerTarefaDaNota(MD, 'markdown', 0, 'Refazer a lista')
    expect(depois).not.toBeNull()
    expect(depois).not.toContain('Refazer a lista')
    expect(depois).toContain('Ler o capítulo')
    expect(depois).toContain('# Aula 3')
    expect(depois).toContain('Fim.')
  })

  it('deixa a sub-tarefa onde está', () => {
    const depois = removerTarefaDaNota(MD, 'markdown', 1, 'Ler o capítulo')!
    expect(depois).toContain('Seção 2')
  })

  it('recusa quando o texto não bate', () => {
    expect(removerTarefaDaNota(MD, 'markdown', 0, 'Outra coisa')).toBeNull()
  })

  it('recusa ordinal que não existe', () => {
    expect(removerTarefaDaNota(MD, 'markdown', 9, 'Refazer a lista')).toBeNull()
  })

  it('a lista restante continua contando certo', () => {
    const depois = removerTarefaDaNota(MD, 'markdown', 0, 'Refazer a lista')!
    expect(tarefasDaNota(depois, 'markdown').map((t) => t.texto)).toEqual([
      'Ler o capítulo',
      'Seção 2',
    ])
  })
})

describe('texto formatado', () => {
  it('tira o item da lista', () => {
    const depois = removerTarefaDaNota(HTML, 'html', 0, 'Refazer a lista')!
    expect(depois).not.toContain('Refazer a lista')
    expect(depois).toContain('Ler o capítulo')
    expect(depois).toContain('Fim.')
  })

  it('leva a lista junto quando ela fica vazia', () => {
    const umaSo =
      '<ul data-type="taskList"><li data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Única</p></div></li></ul><p>Fim.</p>'
    const depois = removerTarefaDaNota(umaSo, 'html', 0, 'Única')!
    expect(depois).not.toContain('<ul')
    expect(depois).toContain('Fim.')
  })

  it('recusa quando o texto não bate', () => {
    expect(removerTarefaDaNota(HTML, 'html', 0, 'Outra coisa')).toBeNull()
  })

  it('não mexe no resto do documento', () => {
    const depois = removerTarefaDaNota(HTML, 'html', 1, 'Ler o capítulo')!
    expect(depois).toContain('<h2>Aula 3</h2>')
    expect(tarefasDaNota(depois, 'html').map((t) => t.texto)).toEqual(['Refazer a lista'])
  })
})
