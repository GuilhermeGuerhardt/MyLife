import { describe, expect, it } from 'vitest'
import {
  extensaoDoArquivo,
  formatoDeDestino,
  limparHtmlImportado,
  textoParaHtml,
  tituloDoArquivo,
} from './importacao'

describe('extensão do arquivo', () => {
  it('reconhece as que sabemos ler', () => {
    expect(extensaoDoArquivo('resumo.md')).toBe('md')
    expect(extensaoDoArquivo('resumo.markdown')).toBe('md')
    expect(extensaoDoArquivo('Aula 3.DOCX')).toBe('docx')
    expect(extensaoDoArquivo('apostila.pdf')).toBe('pdf')
    expect(extensaoDoArquivo('notas.txt')).toBe('txt')
  })

  it('recusa o que não sabemos ler', () => {
    expect(extensaoDoArquivo('planilha.xlsx')).toBeNull()
    expect(extensaoDoArquivo('sem-extensao')).toBeNull()
  })

  it('o ponto do meio do nome não confunde', () => {
    expect(extensaoDoArquivo('aula 2.1 - redes.md')).toBe('md')
  })
})

describe('formato de destino', () => {
  it('só o Markdown continua Markdown', () => {
    expect(formatoDeDestino('md')).toBe('markdown')
    expect(formatoDeDestino('txt')).toBe('html')
    expect(formatoDeDestino('docx')).toBe('html')
    expect(formatoDeDestino('pdf')).toBe('html')
  })
})

describe('título do arquivo', () => {
  it('tira a extensão e devolve os espaços', () => {
    expect(tituloDoArquivo('Revisao-de-Redes.md')).toBe('Revisao de Redes')
    expect(tituloDoArquivo('aula_03_final.docx')).toBe('aula 03 final')
  })

  it('nome vazio ganha um título qualquer', () => {
    expect(tituloDoArquivo('.md')).toBe('Anotação importada')
  })
})

describe('texto para HTML', () => {
  it('uma linha, um parágrafo', () => {
    expect(textoParaHtml('primeira\n\nsegunda\n')).toBe('<p>primeira</p><p>segunda</p>')
  })

  it('escapa o que pareceria marcação', () => {
    expect(textoParaHtml('a < b & c')).toBe('<p>a &lt; b &amp; c</p>')
  })

  it('arquivo em branco não vira parágrafo vazio', () => {
    expect(textoParaHtml('   \n\n  ')).toBe('')
  })
})

describe('limpeza do HTML importado', () => {
  it('a imagem embutida fica de fora', () => {
    expect(limparHtmlImportado('<p>antes</p><img src="data:image/png;base64,AAAA"><p>depois</p>')).toBe(
      '<p>antes</p><p>depois</p>',
    )
  })

  it('script e style não entram', () => {
    expect(limparHtmlImportado('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>')
  })

  it('o parágrafo vazio do Word some', () => {
    expect(limparHtmlImportado('<p>um</p><p> </p><p>dois</p>')).toBe('<p>um</p><p>dois</p>')
  })
})
