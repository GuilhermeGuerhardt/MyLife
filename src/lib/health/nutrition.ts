/** Contas do diário alimentar: somar o que foi comido e ler o rótulo. */

/** O mínimo de um registro de refeição para entrar na soma. */
export interface MacroSource {
  kcal: number
  protein_g: number
  carb_g: number
  fat_g: number
}

export interface MacroTotals {
  kcal: number
  protein: number
  carb: number
  fat: number
}

export const NO_MACROS: MacroTotals = { kcal: 0, protein: 0, carb: 0, fat: 0 }

/** Total de um conjunto de registros — um dia, uma refeição, a semana toda. */
export function sumMacros(logs: MacroSource[]): MacroTotals {
  return logs.reduce(
    (acc, log) => ({
      kcal: acc.kcal + log.kcal,
      protein: acc.protein + log.protein_g,
      carb: acc.carb + log.carb_g,
      fat: acc.fat + log.fat_g,
    }),
    NO_MACROS,
  )
}

/** Calorias implícitas nos macros: 4 kcal por grama de proteína e carboidrato, 9 de gordura. */
export function kcalFromMacros(proteinG: number, carbG: number, fatG: number): number {
  return Math.round(proteinG * 4 + carbG * 4 + fatG * 9)
}

/**
 * Os valores de um alimento aplicados a uma quantidade.
 *
 * A tabela é sempre por 100 g; o registro guarda a própria cópia já convertida,
 * para o histórico não mudar se o alimento for editado depois.
 */
export function scaleMacros(food: MacroSource, quantityG: number): MacroSource {
  const factor = quantityG / 100
  return {
    kcal: Math.round(food.kcal * factor),
    protein_g: Number((food.protein_g * factor).toFixed(1)),
    carb_g: Number((food.carb_g * factor).toFixed(1)),
    fat_g: Number((food.fat_g * factor).toFixed(1)),
  }
}

/** Lê número digitado à brasileira; valor inválido ou negativo vira zero. */
export function decimalInput(value: string): number {
  const parsed = Number(value.replace(',', '.').trim())
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}
