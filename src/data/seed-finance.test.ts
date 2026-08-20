import { describe, expect, it } from 'vitest'
import { CATEGORY_CATALOG, guessCategory } from './seed-finance'
import type { Category } from './types'

const categories = CATEGORY_CATALOG.map((category, index) => ({
  ...category,
  id: `c${index}`,
  created_at: '2026-01-01',
})) as Category[]

const find = (name: string) => categories.find((c) => c.name === name)!

describe('palpite de categoria', () => {
  it('acerta pela palavra-chave', () => {
    expect(guessCategory('mercado da esquina', categories)?.name).toBe('Mercado')
    expect(guessCategory('DELIVERY *LANCHE', categories)?.name).toBe('Delivery')
    expect(guessCategory('POSTO 24H', categories)?.name).toBe('Transporte')
    expect(guessCategory('Netflix.com', categories)?.name).toBe('Assinaturas')
  })

  it('ignora acentos e maiúsculas', () => {
    expect(guessCategory('FARMÁCIA POPULAR', categories)?.name).toBe('Saúde')
  })

  it('prefere a correspondência mais longa', () => {
    // "pao de acucar" (mercado) precisa ganhar de correspondências curtas.
    expect(guessCategory('PAO DE ACUCAR 231', categories)?.name).toBe('Mercado')
  })

  it('respeita o tipo — receita não cai em categoria de despesa', () => {
    expect(guessCategory('salario da empresa', categories, 'income')?.name).toBe('Salário')
    expect(guessCategory('salario da empresa', categories, 'expense')).toBeNull()
  })

  it('devolve null quando nada casa', () => {
    expect(guessCategory('xyzabc', categories)).toBeNull()
    expect(guessCategory('', categories)).toBeNull()
  })

  it('mantém o catálogo com categorias dos dois tipos', () => {
    expect(find('Outros').kind).toBe('expense')
    expect(find('Salário').kind).toBe('income')
  })
})
