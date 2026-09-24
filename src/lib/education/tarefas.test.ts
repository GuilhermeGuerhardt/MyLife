import { describe, expect, it } from 'vitest'
import { alternarTarefa, linhasDeTarefa, progressoDasTarefas } from './tarefas'

describe('achar as tarefas', () => {
  it('pega marcador de traço, asterisco, mais e número', () => {
    const md = '- [ ] traço\n* [ ] asterisco\n+ [ ] mais\n1. [ ] ponto\n2) [ ] parêntese'
    expect(linhasDeTarefa(md).map((t) => t.linha)).toEqual([0, 1, 2, 3, 4])
  })

  it('aceita [x] e [X] como marcada', () => {
    expect(linhasDeTarefa('- [x] um\n- [X] dois\n- [ ] três').map((t) => t.marcada)).toEqual([
      true,
      true,
      false,
    ])
  })

  it('conta as aninhadas na ordem do documento', () => {
    const md = '- [ ] pai\n  - [x] filha\n    - [ ] neta\n- [ ] tio'
    expect(linhasDeTarefa(md).map((t) => t.linha)).toEqual([0, 1, 2, 3])
  })

  it('atravessa várias listas separadas por texto', () => {
    const md = '- [ ] a\n\ntexto no meio\n\n- [x] b\n\n## Título\n\n1. [ ] c'
    expect(linhasDeTarefa(md).map((t) => t.linha)).toEqual([0, 4, 8])
  })

  it('ignora o que está dentro de bloco de código', () => {
    const md = '- [ ] vale\n\n```\n- [ ] não vale\n- [x] nem esta\n```\n\n- [ ] vale de novo'
    expect(linhasDeTarefa(md).map((t) => t.linha)).toEqual([0, 7])
  })

  it('bloco com til também conta como código', () => {
    expect(linhasDeTarefa('~~~\n- [ ] escondida\n~~~').map((t) => t.linha)).toEqual([])
  })

  it('colchete solto em parágrafo não é tarefa', () => {
    expect(linhasDeTarefa('Isto [ ] não é tarefa\n- item comum sem colchete')).toEqual([])
  })

  it('exige espaço depois do colchete', () => {
    expect(linhasDeTarefa('- [ ]sem espaço')).toEqual([])
  })
})

describe('alternar', () => {
  const md = '# Lista\n\n- [ ] Comprar pão\n- [x] Estudar\n  - [ ] Revisar\n'

  it('marca a desmarcada', () => {
    expect(alternarTarefa(md, 0, false)).toBe(
      '# Lista\n\n- [x] Comprar pão\n- [x] Estudar\n  - [ ] Revisar\n',
    )
  })

  it('desmarca a marcada', () => {
    expect(alternarTarefa(md, 1, true)).toBe(
      '# Lista\n\n- [ ] Comprar pão\n- [ ] Estudar\n  - [ ] Revisar\n',
    )
  })

  it('preserva a indentação da aninhada', () => {
    expect(alternarTarefa(md, 2, false)).toContain('  - [x] Revisar')
  })

  it('duas tarefas com o mesmo texto: mexe só na clicada', () => {
    const repetido = '- [ ] Revisar\n- [ ] Revisar\n- [ ] Revisar'
    expect(alternarTarefa(repetido, 1, false)).toBe('- [ ] Revisar\n- [x] Revisar\n- [ ] Revisar')
  })

  it('o ordinal pula o bloco de código, como a renderização', () => {
    const comCodigo = '- [ ] antes\n\n```\n- [ ] no código\n```\n\n- [ ] depois'
    expect(alternarTarefa(comCodigo, 1, false)).toBe(
      '- [ ] antes\n\n```\n- [ ] no código\n```\n\n- [x] depois',
    )
  })

  it('não toca no resto do texto', () => {
    const rico = '**Negrito** e [link](http://x) antes\n\n- [ ] tarefa\n\n`código` depois'
    const novo = alternarTarefa(rico, 0, false)!
    expect(novo).toContain('**Negrito** e [link](http://x) antes')
    expect(novo).toContain('`código` depois')
  })

  it('estado divergente aborta em vez de marcar a errada', () => {
    // A tela achava que estava marcada; no texto está desmarcada.
    expect(alternarTarefa(md, 0, true)).toBeNull()
  })

  it('ordinal fora da faixa não faz nada', () => {
    expect(alternarTarefa(md, 99, false)).toBeNull()
    expect(alternarTarefa(md, -1, false)).toBeNull()
  })

  it('alternar duas vezes devolve o texto original', () => {
    const uma = alternarTarefa(md, 0, false)!
    expect(alternarTarefa(uma, 0, true)).toBe(md)
  })
})

describe('progresso', () => {
  it('conta feitas e total', () => {
    expect(progressoDasTarefas('- [x] a\n- [ ] b\n- [X] c')).toEqual({ feitas: 2, total: 3 })
  })

  it('texto sem tarefa nenhuma', () => {
    expect(progressoDasTarefas('só um parágrafo')).toEqual({ feitas: 0, total: 0 })
  })
})
