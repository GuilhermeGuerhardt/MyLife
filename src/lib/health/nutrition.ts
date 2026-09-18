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

// ---------------------------------------------------------------------------
// Refeições salvas
// ---------------------------------------------------------------------------

/** O alimento como a refeição salva precisa dele: identidade, nome e macros. */
export interface AlimentoLigavel extends MacroSource {
  id: string
  name: string
}

export interface ItemSalvo {
  food_id: string
  quantity_g: number
}

/** Um registro pronto para gravar — o mesmo formato de quem adiciona na mão. */
export interface RegistroDeRefeicao extends MacroSource {
  food_id: string
  food_name: string
  quantity_g: number
}

/**
 * Expande uma refeição salva nos registros que ela vira.
 *
 * A refeição guarda alimento e quantidade, nunca macros: a conta é refeita
 * agora, com os valores atuais do cadastro. Corrigir a caloria de um alimento
 * conserta todas as refeições que o usam, em vez de deixar cópias erradas
 * espalhadas pelo histórico.
 *
 * Alimento que já não existe é ignorado em silêncio — ele foi removido da
 * lista depois que a refeição foi salva, e derrubar o registro inteiro por
 * causa de um item seria pior do que registrar o resto.
 */
export function registrosDaRefeicao(
  itens: ItemSalvo[],
  alimentos: AlimentoLigavel[],
): RegistroDeRefeicao[] {
  const porId = new Map(alimentos.map((a) => [a.id, a]))
  const registros: RegistroDeRefeicao[] = []

  for (const item of itens) {
    const alimento = porId.get(item.food_id)
    if (!alimento || item.quantity_g <= 0) continue
    registros.push({
      food_id: alimento.id,
      food_name: alimento.name,
      quantity_g: item.quantity_g,
      ...scaleMacros(alimento, item.quantity_g),
    })
  }

  return registros
}

/** O que a refeição salva soma hoje — para a faixa mostrar "3 itens · 680 kcal". */
export function resumoDaRefeicao(
  itens: ItemSalvo[],
  alimentos: AlimentoLigavel[],
): { itens: number; totais: MacroTotals } {
  const registros = registrosDaRefeicao(itens, alimentos)
  return { itens: registros.length, totais: sumMacros(registros) }
}

/**
 * Converte o que já está no diário em itens de refeição salva.
 *
 * É o caminho que evita uma tela de composição: você monta o almoço uma vez do
 * jeito normal e salva o que ficou.
 */
export function itensDoDiario(logs: Array<{ food_id: string; quantity_g: number }>): ItemSalvo[] {
  const somado = new Map<string, number>()
  for (const log of logs) {
    // O mesmo alimento duas vezes no prato vira uma linha com a soma: ninguém
    // quer "arroz 100 g" e "arroz 50 g" separados na refeição salva.
    somado.set(log.food_id, (somado.get(log.food_id) ?? 0) + log.quantity_g)
  }
  return [...somado].map(([food_id, quantity_g]) => ({ food_id, quantity_g }))
}
