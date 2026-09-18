import { describe, expect, it } from 'vitest'
import {
  decimalInput,
  itensDoDiario,
  kcalFromMacros,
  registrosDaRefeicao,
  resumoDaRefeicao,
  scaleMacros,
  sumMacros,
} from './nutrition'

describe('soma do diário', () => {
  it('soma calorias e macros dos registros', () => {
    expect(
      sumMacros([
        { kcal: 300, protein_g: 10, carb_g: 60, fat_g: 2.5 },
        { kcal: 200, protein_g: 25, carb_g: 4, fat_g: 6 },
      ]),
    ).toEqual({ kcal: 500, protein: 35, carb: 64, fat: 8.5 })
  })

  it('dia sem registro soma zero', () => {
    expect(sumMacros([])).toEqual({ kcal: 0, protein: 0, carb: 0, fat: 0 })
  })
})

describe('calorias pelos macros', () => {
  it('usa 4 kcal por grama de proteína e carboidrato e 9 de gordura', () => {
    // 20*4 + 30*4 + 10*9 = 80 + 120 + 90
    expect(kcalFromMacros(20, 30, 10)).toBe(290)
  })

  it('arredonda para inteiro', () => {
    expect(kcalFromMacros(1.1, 0, 0)).toBe(4)
  })
})

describe('porção', () => {
  const arroz = { kcal: 128, protein_g: 2.5, carb_g: 28.1, fat_g: 0.2 }

  it('converte os valores de 100 g para a quantidade escolhida', () => {
    expect(scaleMacros(arroz, 150)).toEqual({
      kcal: 192,
      protein_g: 3.8,
      carb_g: 42.2,
      fat_g: 0.3,
    })
  })

  it('mantém os valores em 100 g', () => {
    expect(scaleMacros(arroz, 100)).toEqual(arroz)
  })
})

describe('número digitado', () => {
  it('aceita vírgula, ponto e espaço em volta', () => {
    expect(decimalInput('1,5')).toBe(1.5)
    expect(decimalInput('1.5')).toBe(1.5)
    expect(decimalInput('  2 ')).toBe(2)
  })

  it('texto, vazio, zero e negativo viram zero', () => {
    expect(decimalInput('abc')).toBe(0)
    expect(decimalInput('')).toBe(0)
    expect(decimalInput('0')).toBe(0)
    expect(decimalInput('-3')).toBe(0)
  })
})

describe('refeição salva', () => {
  const alimentos = [
    { id: 'f1', name: 'Arroz branco cozido', kcal: 128, protein_g: 2.5, carb_g: 28.1, fat_g: 0.2 },
    { id: 'f2', name: 'Frango grelhado', kcal: 159, protein_g: 32, carb_g: 0, fat_g: 2.5 },
  ]

  it('recalcula os macros na hora, a partir do cadastro atual', () => {
    const registros = registrosDaRefeicao(
      [{ food_id: 'f1', quantity_g: 150 }, { food_id: 'f2', quantity_g: 150 }],
      alimentos,
    )
    expect(registros).toEqual([
      { food_id: 'f1', food_name: 'Arroz branco cozido', quantity_g: 150, kcal: 192, protein_g: 3.8, carb_g: 42.2, fat_g: 0.3 },
      { food_id: 'f2', food_name: 'Frango grelhado', quantity_g: 150, kcal: 239, protein_g: 48, carb_g: 0, fat_g: 3.8 },
    ])
  })

  it('corrigir o alimento conserta a refeição, sem tocar nela', () => {
    const corrigido = [{ ...alimentos[0]!, kcal: 130 }, alimentos[1]!]
    const antes = registrosDaRefeicao([{ food_id: 'f1', quantity_g: 100 }], alimentos)
    const depois = registrosDaRefeicao([{ food_id: 'f1', quantity_g: 100 }], corrigido)
    expect(antes[0]!.kcal).toBe(128)
    expect(depois[0]!.kcal).toBe(130)
  })

  it('alimento removido do cadastro é ignorado, o resto entra', () => {
    const registros = registrosDaRefeicao(
      [{ food_id: 'sumiu', quantity_g: 100 }, { food_id: 'f2', quantity_g: 100 }],
      alimentos,
    )
    expect(registros.map((r) => r.food_id)).toEqual(['f2'])
  })

  it('quantidade zerada não vira registro', () => {
    expect(registrosDaRefeicao([{ food_id: 'f1', quantity_g: 0 }], alimentos)).toEqual([])
  })

  it('resume itens e calorias para a faixa do modal', () => {
    const resumo = resumoDaRefeicao(
      [{ food_id: 'f1', quantity_g: 150 }, { food_id: 'f2', quantity_g: 150 }],
      alimentos,
    )
    expect(resumo.itens).toBe(2)
    expect(resumo.totais.kcal).toBe(431)
  })

  it('o diário vira itens, somando o alimento repetido', () => {
    expect(
      itensDoDiario([
        { food_id: 'f1', quantity_g: 100 },
        { food_id: 'f2', quantity_g: 150 },
        { food_id: 'f1', quantity_g: 50 },
      ]),
    ).toEqual([
      { food_id: 'f1', quantity_g: 150 },
      { food_id: 'f2', quantity_g: 150 },
    ])
  })
})
