import { describe, expect, it } from 'vitest'
import { CATEGORY_CATALOG } from '@/data/seed-finance'
import { CATEGORY_ICONS, DEFAULT_ICON, resolveIconName } from './category-icons'

describe('resolveIconName', () => {
  it('aceita o nome do ícone gravado', () => {
    expect(resolveIconName('ShoppingCart')).toBe('ShoppingCart')
  })

  it('traduz o emoji de quem já usava o app', () => {
    expect(resolveIconName('🛒')).toBe('ShoppingCart')
    expect(resolveIconName('🏠')).toBe('House')
    expect(resolveIconName('🩺')).toBe('Stethoscope')
    expect(resolveIconName('💼')).toBe('Briefcase')
  })

  it('traduz emoji com e sem seletor de variação', () => {
    // '🏋️' e '🏋' são bytes diferentes e chegam dos dois jeitos.
    expect(resolveIconName('🏋️')).toBe('Dumbbell')
    expect(resolveIconName('🏋')).toBe('Dumbbell')
    expect(resolveIconName('🍽️')).toBe('UtensilsCrossed')
    expect(resolveIconName('🍽')).toBe('UtensilsCrossed')
  })

  it('cai no genérico sem quebrar quando não reconhece', () => {
    expect(resolveIconName('🦄')).toBe(DEFAULT_ICON)
    expect(resolveIconName('IconeQueNaoExiste')).toBe(DEFAULT_ICON)
    expect(resolveIconName('')).toBe(DEFAULT_ICON)
    expect(resolveIconName(null)).toBe(DEFAULT_ICON)
    expect(resolveIconName(undefined)).toBe(DEFAULT_ICON)
  })

  it('não deixa uma chave herdada de Object atravessar como ícone', () => {
    expect(resolveIconName('toString')).toBe(DEFAULT_ICON)
    expect(resolveIconName('constructor')).toBe(DEFAULT_ICON)
  })

  it('sempre devolve um nome que existe no registro', () => {
    for (const entrada of ['ShoppingCart', '🛒', '🦄', '', 'lixo']) {
      expect(CATEGORY_ICONS[resolveIconName(entrada)]).toBeDefined()
    }
  })
})

describe('catálogo inicial', () => {
  it('não tem mais nenhum emoji — todos viraram nome de ícone', () => {
    for (const categoria of CATEGORY_CATALOG) {
      expect(categoria.icon, `${categoria.name} usa "${categoria.icon}"`).toBeDefined()
      expect(CATEGORY_ICONS[resolveIconName(categoria.icon)]).toBeDefined()
      expect(resolveIconName(categoria.icon)).toBe(categoria.icon)
    }
  })

  it('nenhuma categoria do catálogo caiu no ícone genérico por engano', () => {
    const genericas = CATEGORY_CATALOG.filter((c) => c.icon === DEFAULT_ICON).map((c) => c.name)
    // Só "Outros" e "Outras receitas" têm motivo para ser genéricas.
    expect(genericas).toEqual(['Outros'])
  })
})
