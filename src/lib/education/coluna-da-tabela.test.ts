// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  larguraIdeal,
  LARGURA_MAXIMA,
  LARGURA_MINIMA,
  temCelulaMesclada,
} from './coluna-da-tabela'

describe('larguraIdeal', () => {
  it('acompanha a maior célula da coluna', () => {
    expect(larguraIdeal([80, 213.4, 96])).toBe(213)
  })

  it('não deixa a coluna sumir quando está toda vazia', () => {
    expect(larguraIdeal([])).toBe(LARGURA_MINIMA)
    expect(larguraIdeal([0, 0, 0])).toBe(LARGURA_MINIMA)
  })

  it('para no máximo quando uma célula tem um parágrafo inteiro', () => {
    expect(larguraIdeal([90, 1800])).toBe(LARGURA_MAXIMA)
  })

  it('devolve número inteiro, que é o que vai para o atributo da célula', () => {
    expect(Number.isInteger(larguraIdeal([120.7]))).toBe(true)
  })
})

function tabela(html: string): HTMLTableElement {
  const molde = document.createElement('div')
  molde.innerHTML = `<table><tbody>${html}</tbody></table>`
  return molde.querySelector('table')!
}

describe('temCelulaMesclada', () => {
  it('aceita a tabela comum', () => {
    expect(temCelulaMesclada(tabela('<tr><td>a</td><td>b</td></tr>'))).toBe(false)
  })

  it('não se engana com colspan de 1, que é o mesmo que nenhum', () => {
    expect(temCelulaMesclada(tabela('<tr><td colspan="1">a</td><td>b</td></tr>'))).toBe(false)
  })

  it('acha a célula que ocupa duas colunas', () => {
    expect(temCelulaMesclada(tabela('<tr><td colspan="2">a</td></tr>'))).toBe(true)
  })

  it('acha a célula que ocupa duas linhas', () => {
    const grade = '<tr><td rowspan="2">a</td><td>b</td></tr><tr><td>c</td></tr>'
    expect(temCelulaMesclada(tabela(grade))).toBe(true)
  })

  it('olha todas as linhas, não só a primeira', () => {
    const grade = '<tr><td>a</td><td>b</td></tr><tr><td colspan="2">c</td></tr>'
    expect(temCelulaMesclada(tabela(grade))).toBe(true)
  })
})
