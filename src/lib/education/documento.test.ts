// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import {
  blocosDoHtml,
  blocosParaTexto,
  markdownParaTexto,
  nomeDeArquivo,
  textoDoBloco,
} from './documento'

describe('blocos do HTML', () => {
  it('lê título com o nível certo', () => {
    const [bloco] = blocosDoHtml('<h2>Revisão</h2>')
    expect(bloco).toMatchObject({ tipo: 'titulo', nivel: 2 })
    expect(textoDoBloco(bloco!)).toBe('Revisão')
  })

  it('guarda as marcas de cada trecho', () => {
    const [bloco] = blocosDoHtml('<p>um <strong>dois</strong> <em>três</em></p>')
    expect(bloco!.trechos.map((t) => [t.texto, t.marcas])).toEqual([
      ['um ', {}],
      ['dois', { negrito: true }],
      ['três', { italico: true }],
    ])
  })

  it('marcas se acumulam quando aninhadas', () => {
    const [bloco] = blocosDoHtml('<p><strong><em>os dois</em></strong></p>')
    expect(bloco!.trechos[0]!.marcas).toEqual({ negrito: true, italico: true })
  })

  it('pega a cor da letra e a do marca-texto', () => {
    const [bloco] = blocosDoHtml(
      '<p><span style="color: #0091ff">azul</span> <mark data-color="#fde68a">marcado</mark></p>',
    )
    expect(bloco!.trechos[0]!.marcas.cor).toBe('#0091ff')
    expect(bloco!.trechos[1]!.marcas.fundo).toBe('#fde68a')
  })

  it('pega a cor do sublinhado', () => {
    const [bloco] = blocosDoHtml('<p><u data-cor="#e5484d">atenção</u></p>')
    expect(bloco!.trechos[0]!.marcas).toMatchObject({
      sublinhado: true,
      corDoSublinhado: '#e5484d',
    })
  })

  it('tarefa traz o estado', () => {
    const html =
      '<ul data-type="taskList">' +
      '<li data-checked="true"><label><input type="checkbox" checked></label><div><p>feita</p></div></li>' +
      '<li data-checked="false"><label><input type="checkbox"></label><div><p>aberta</p></div></li>' +
      '</ul>'
    expect(blocosDoHtml(html).map((b) => [b.tipo, b.feita, textoDoBloco(b)])).toEqual([
      ['tarefa', true, 'feita'],
      ['tarefa', false, 'aberta'],
    ])
  })

  it('separa lista comum de numerada', () => {
    const blocos = blocosDoHtml('<ul><li><p>a</p></li></ul><ol><li><p>b</p></li></ol>')
    expect(blocos.map((b) => b.tipo)).toEqual(['item', 'item-numerado'])
  })

  it('bloco de código sai inteiro, sem virar parágrafos', () => {
    const [bloco] = blocosDoHtml('<pre><code>linha 1\nlinha 2</code></pre>')
    expect(bloco!.tipo).toBe('codigo')
    expect(textoDoBloco(bloco!)).toBe('linha 1\nlinha 2')
  })

  it('a linha divisória vira bloco próprio', () => {
    expect(blocosDoHtml('<p>a</p><hr><p>b</p>').map((b) => b.tipo)).toEqual([
      'paragrafo',
      'linha',
      'paragrafo',
    ])
  })

  it('bloco vazio não entra', () => {
    expect(blocosDoHtml('<p></p><p>   </p><p>vale</p>')).toHaveLength(1)
  })

  it('a caixa da tarefa não vira texto', () => {
    const html =
      '<ul data-type="taskList"><li data-checked="false"><label><input type="checkbox"><span></span></label><div><p>texto</p></div></li></ul>'
    expect(textoDoBloco(blocosDoHtml(html)[0]!)).toBe('texto')
  })
})

describe('blocos para texto puro', () => {
  it('desenha cada tipo de bloco', () => {
    const html =
      '<h2>Título</h2><p>Parágrafo.</p><ul><li><p>item</p></li></ul>' +
      '<ul data-type="taskList"><li data-checked="true"><label><input type="checkbox" checked></label><div><p>feita</p></div></li></ul>' +
      '<blockquote><p>citada</p></blockquote>'
    expect(blocosParaTexto(blocosDoHtml(html))).toBe(
      'TÍTULO\n\nParágrafo.\n- item\n[x] feita\n> citada\n',
    )
  })

  it('não deixa três linhas em branco seguidas', () => {
    const texto = blocosParaTexto(blocosDoHtml('<h1>A</h1><h1>B</h1><h1>C</h1>'))
    expect(texto).not.toMatch(/\n{3}/)
  })
})

describe('markdown para texto puro', () => {
  it('tira a marcação e mantém o texto', () => {
    const md = '# Título\n\nCom **negrito**, *itálico* e [link](http://x).'
    expect(markdownParaTexto(md)).toBe('TÍTULO\n\nCom negrito, itálico e link.\n')
  })

  it('o [[link]] vira o título dele', () => {
    expect(markdownParaTexto('Ver [[Arquitetura hexagonal]].')).toBe(
      'Ver Arquitetura hexagonal.\n',
    )
  })

  it('o conteúdo do bloco de código sobrevive', () => {
    expect(markdownParaTexto('```js\nconst x = 1\n```')).toContain('const x = 1')
  })
})

describe('nome de arquivo', () => {
  it('tira acento e troca espaço por hífen', () => {
    expect(nomeDeArquivo('Revisão de Redes')).toBe('Revisao-de-Redes')
  })

  it('tira o que não pode ir em nome de arquivo', () => {
    expect(nomeDeArquivo('TCP/IP: a "pilha"')).toBe('TCPIP-a-pilha')
  })

  it('título vazio ganha um nome qualquer', () => {
    expect(nomeDeArquivo('   ')).toBe('anotacao')
    expect(nomeDeArquivo('///')).toBe('anotacao')
  })
})
