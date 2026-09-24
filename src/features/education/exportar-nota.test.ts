// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportarNota, saidasPossiveis } from './exportar-nota'

const salvos: Array<{ nome: string; conteudo: string | Uint8Array }> = []

vi.mock('@/lib/salvar-arquivo', () => ({
  salvarArquivo: (nome: string, conteudo: string | Uint8Array) => {
    salvos.push({ nome, conteudo })
    return Promise.resolve(true)
  },
}))

const ultimo = () => salvos[salvos.length - 1]!

beforeEach(() => {
  salvos.length = 0
})

describe('o que cada formato oferece', () => {
  it('texto formatado vai para Word, PDF e txt', () => {
    expect(saidasPossiveis('html')).toEqual(['docx', 'pdf', 'txt'])
  })

  it('Markdown vai para md e txt', () => {
    expect(saidasPossiveis('markdown')).toEqual(['md', 'txt'])
  })
})

describe('exportação', () => {
  it('o .md sai como foi escrito', async () => {
    await exportarNota('Redes de Computadores', '# Camadas\n\n- física', 'markdown', 'md')
    expect(ultimo().nome).toBe('Redes-de-Computadores.md')
    expect(ultimo().conteudo).toBe('# Camadas\n\n- física')
  })

  it('o .txt de uma anotação formatada perde as marcas e guarda a estrutura', async () => {
    const html = '<h2>Aula</h2><p>Texto <strong>forte</strong>.</p><ul><li><p>item</p></li></ul>'
    await exportarNota('Aula 1', html, 'html', 'txt')
    expect(ultimo().nome).toBe('Aula-1.txt')
    expect(ultimo().conteudo).toBe('Aula 1\n\nAULA\n\nTexto forte.\n- item\n')
  })

  it('o .txt de uma anotação em Markdown também', async () => {
    await exportarNota('Aula 2', '## Tópico\n\nCom **negrito**.', 'markdown', 'txt')
    expect(ultimo().conteudo).toBe('Aula 2\n\nTÓPICO\n\nCom negrito.\n')
  })

  it('o .docx sai como um arquivo do Word de verdade', async () => {
    const html =
      '<h1>Título</h1><p><span style="color: #0091ff">colorido</span> ' +
      // O marca-texto sai por `shading`, que é o caminho que guarda a cor
      // escolhida; montar o documento já prova que o Word aceita o que foi
      // pedido, porque a biblioteca recusa atributo inválido na montagem.
      '<mark data-color="#fde68a">marcado</mark></p>' +
      '<ul data-type="taskList"><li data-checked="true"><label><input type="checkbox" checked></label><div><p>feita</p></div></li></ul>'
    await exportarNota('Revisão', html, 'html', 'docx')

    expect(ultimo().nome).toBe('Revisao.docx')
    const bytes = ultimo().conteudo as Uint8Array
    expect(bytes.length).toBeGreaterThan(1000)
    // `PK`: todo .docx é um zip, e é assim que o Word o reconhece.
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b])
  })
})
