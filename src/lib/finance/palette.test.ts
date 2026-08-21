import { describe, expect, it } from 'vitest'
import { CHART_PALETTE, resolveSliceColors } from './palette'

describe('resolveSliceColors', () => {
  it('preserva a cor da categoria quando ela é única', () => {
    const out = resolveSliceColors([
      { name: 'Mercado', color: '#22c55e' },
      { name: 'Transporte', color: '#3b82f6' },
    ])
    expect(out.map((s) => s.color)).toEqual(['#22c55e', '#3b82f6'])
  })

  it('dá cores distintas quando todas chegam iguais — o caso da importação', () => {
    const cinza = '#71717a'
    const out = resolveSliceColors(
      ['Boleto', 'Reforma', 'Notebook', 'Curso'].map((name) => ({ name, color: cinza })),
    )
    expect(new Set(out.map((s) => s.color)).size).toBe(4)
    // A primeira mantém o cinza; as seguintes é que precisam se diferenciar.
    expect(out[0]!.color).toBe(cinza)
  })

  it('preenche quem chega sem cor nenhuma', () => {
    const out = resolveSliceColors([{ name: 'Sem categoria', color: null }])
    expect(out[0]!.color).toBe(CHART_PALETTE[0])
  })

  it('não rouba a cor de uma categoria que aparece mais adiante na lista', () => {
    // O caso real: quatro categorias importadas sem cor, e o Mercado — verde
    // de verdade — no meio delas. Se a reserva entregar o verde para uma das
    // cinzas, o Mercado sai laranja e a cor deixa de significar algo.
    const verde = '#22c55e'
    const out = resolveSliceColors([
      { name: 'Boleto', color: null },
      { name: 'Reforma', color: null },
      { name: 'Mercado', color: verde },
    ])
    expect(out.find((s) => s.name === 'Mercado')!.color).toBe(verde)
    expect(new Set(out.map((s) => s.color)).size).toBe(3)
  })

  it('não devolve da reserva um tom que uma categoria anterior já usa', () => {
    const out = resolveSliceColors([
      { name: 'Azul', color: CHART_PALETTE[0]! },
      { name: 'Sem cor', color: null },
    ])
    expect(out[1]!.color).not.toBe(CHART_PALETTE[0])
    expect(out[1]!.color).toBe(CHART_PALETTE[1])
  })

  it('nunca repete cor dentro do que um gráfico mostra', () => {
    const itens = Array.from({ length: CHART_PALETTE.length }, (_, i) => ({
      name: `c${i}`,
      color: null,
    }))
    const cores = resolveSliceColors(itens).map((s) => s.color)
    expect(new Set(cores).size).toBe(CHART_PALETTE.length)
  })

  it('mantém os demais campos do item intactos', () => {
    const out = resolveSliceColors([{ name: 'Mercado', value: 1200, color: null }])
    expect(out[0]).toMatchObject({ name: 'Mercado', value: 1200 })
  })
})
