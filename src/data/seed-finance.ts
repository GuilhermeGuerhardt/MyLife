/**
 * Categorias iniciais do financeiro.
 *
 * As `keywords` alimentam o palpite de categoria no registro rápido
 * ("gastei 35 no mercado" cai em Mercado) e, mais adiante, na importação de
 * extrato OFX. São propositalmente termos que aparecem em descrição de fatura.
 */

import type { BaseRow, Category } from './types'

type SeedCategory = Omit<Category, keyof BaseRow>

export const CATEGORY_CATALOG: SeedCategory[] = [
  // Despesas
  c('Moradia', '#f97316', '🏠', ['aluguel', 'condominio', 'iptu', 'luz', 'energia', 'agua', 'gas', 'internet']),
  c('Mercado', '#22c55e', '🛒', ['mercado', 'supermercado', 'atacadao', 'assai', 'carrefour', 'pao de acucar', 'hortifruti']),
  c('Delivery', '#ef4444', '🛵', ['ifood', 'rappi', 'delivery', 'uber eats', 'lanche']),
  c('Restaurante', '#f43f5e', '🍽️', ['restaurante', 'bar', 'padaria', 'cafe', 'almoco', 'jantar', 'pizzaria']),
  c('Transporte', '#3b82f6', '🚗', ['uber', '99', 'combustivel', 'gasolina', 'posto', 'estacionamento', 'onibus', 'metro', 'pedagio']),
  c('Saúde', '#14b8a6', '🩺', ['farmacia', 'drogaria', 'medico', 'consulta', 'exame', 'plano de saude', 'dentista']),
  c('Academia', '#10b981', '🏋️', ['academia', 'gym', 'personal', 'crossfit', 'suplemento', 'whey']),
  c('Educação', '#6366f1', '🎓', ['faculdade', 'mensalidade', 'curso', 'udemy', 'alura', 'livro', 'material']),
  c('Assinaturas', '#a855f7', '📺', ['netflix', 'spotify', 'amazon', 'disney', 'youtube', 'assinatura', 'icloud', 'github']),
  c('Lazer', '#ec4899', '🎬', ['cinema', 'show', 'viagem', 'hotel', 'passagem', 'jogo', 'steam']),
  c('Vestuário', '#8b5cf6', '👕', ['roupa', 'tenis', 'calcado', 'shopping', 'loja']),
  c('Pets', '#84cc16', '🐾', ['pet', 'racao', 'veterinario', 'petshop']),
  c('Impostos e taxas', '#64748b', '🧾', ['imposto', 'taxa', 'tarifa', 'anuidade', 'juros', 'multa']),
  c('Presentes', '#f59e0b', '🎁', ['presente', 'aniversario']),
  c('Outros', '#71717a', '📦', []),

  // Receitas
  c('Salário', '#22c55e', '💼', ['salario', 'pagamento', 'folha'], 'income'),
  c('Freelance', '#06b6d4', '💻', ['freela', 'freelance', 'projeto', 'servico'], 'income'),
  c('Rendimentos', '#eab308', '📈', ['rendimento', 'dividendo', 'juros', 'cdb', 'tesouro'], 'income'),
  c('Reembolso', '#94a3b8', '↩️', ['reembolso', 'estorno', 'devolucao'], 'income'),
  c('Outras receitas', '#71717a', '💰', [], 'income'),
]

function c(
  name: string,
  color: string,
  icon: string,
  keywords: string[],
  kind: 'income' | 'expense' = 'expense',
): SeedCategory {
  return { name, kind, color, icon, keywords }
}

/**
 * Descobre a categoria pela descrição.
 *
 * Compara a descrição normalizada com as palavras-chave de cada categoria e
 * fica com a correspondência mais longa — "pao de acucar" deve ganhar de "pao"
 * se as duas existirem.
 */
export function guessCategory(
  description: string,
  categories: Category[],
  kind: 'income' | 'expense' = 'expense',
): Category | null {
  const text = normalizeText(description)
  if (!text) return null

  let best: { category: Category; score: number } | null = null

  for (const category of categories) {
    if (category.kind !== kind) continue
    for (const keyword of category.keywords) {
      const normalized = normalizeText(keyword)
      if (normalized && text.includes(normalized)) {
        const score = normalized.length
        if (!best || score > best.score) best = { category, score }
      }
    }
  }

  return best?.category ?? null
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
}
