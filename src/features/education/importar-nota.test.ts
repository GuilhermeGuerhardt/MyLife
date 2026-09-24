// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import { exportarNota } from './exportar-nota'
import { ImportacaoInvalida, lerArquivoDeNota } from './importar-nota'

const salvos: Array<{ nome: string; conteudo: string | Uint8Array }> = []

vi.mock('@/lib/salvar-arquivo', () => ({
  salvarArquivo: (nome: string, conteudo: string | Uint8Array) => {
    salvos.push({ nome, conteudo })
    return Promise.resolve(true)
  },
}))

const arquivo = (nome: string, conteudo: string | Uint8Array) =>
  new File([conteudo as BlobPart], nome)

describe('importação', () => {
  it('o .md continua Markdown', async () => {
    const nota = await lerArquivoDeNota(arquivo('Redes-de-Computadores.md', '# Camadas\n\n- física'))
    expect(nota).toEqual({
      title: 'Redes de Computadores',
      content: '# Camadas\n\n- física',
      format: 'markdown',
    })
  })

  it('o .txt vira texto formatado', async () => {
    const nota = await lerArquivoDeNota(arquivo('anotacoes.txt', 'primeira\n\nsegunda'))
    expect(nota.format).toBe('html')
    expect(nota.content).toBe('<p>primeira</p><p>segunda</p>')
  })

  it('recusa o que não sabe ler', async () => {
    await expect(lerArquivoDeNota(arquivo('planilha.xlsx', 'seja o que for'))).rejects.toBeInstanceOf(
      ImportacaoInvalida,
    )
  })

  it('recusa o arquivo grande demais para virar uma linha do banco', async () => {
    await expect(
      lerArquivoDeNota(arquivo('enorme.txt', 'a'.repeat(2_000_001))),
    ).rejects.toBeInstanceOf(ImportacaoInvalida)
  })

  /**
   * Ida e volta pelo Word: o mesmo `.docx` que a exportação monta é o que a
   * importação lê. É o que prova que as duas metades combinam — cada uma
   * passando só nos próprios testes deixaria justamente esse encontro de fora.
   */
  it('o .docx exportado volta como anotação formatada', async () => {
    const html = '<h1>Arquitetura</h1><p>Camada de <strong>domínio</strong>.</p>'
    await exportarNota('Arquitetura', html, 'html', 'docx')
    const bytes = salvos[salvos.length - 1]!.conteudo as Uint8Array

    const nota = await lerArquivoDeNota(arquivo('Arquitetura.docx', bytes))
    expect(nota.format).toBe('html')
    expect(nota.title).toBe('Arquitetura')
    expect(nota.content).toContain('Camada de')
    expect(nota.content).toContain('<strong>domínio</strong>')
  })
})
