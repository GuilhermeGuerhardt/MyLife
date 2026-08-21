/**
 * Categorias iniciais do financeiro.
 *
 * As `keywords` alimentam o palpite de categoria no registro rápido
 * ("gastei 35 no mercado" cai em Mercado) e, mais adiante, na importação de
 * extrato OFX. São propositalmente termos que aparecem em descrição de fatura.
 */

import type { CategoryIconName } from '@/features/finance/category-icons'
import type { BaseRow, Category } from './types'

type SeedCategory = Omit<Category, keyof BaseRow>

export const CATEGORY_CATALOG: SeedCategory[] = [
  // Despesas
  c('Moradia', '#f97316', 'House', ['aluguel', 'condominio', 'iptu', 'luz', 'energia', 'agua', 'gas', 'internet']),
  c('Mercado', '#22c55e', 'ShoppingCart', ['mercado', 'supermercado', 'atacadao', 'assai', 'carrefour', 'pao de acucar', 'hortifruti']),
  c('Delivery', '#ef4444', 'Bike', ['ifood', 'rappi', 'delivery', 'uber eats', 'lanche']),
  c('Restaurante', '#f43f5e', 'UtensilsCrossed', ['restaurante', 'bar', 'padaria', 'cafe', 'almoco', 'jantar', 'pizzaria']),
  c('Transporte', '#3b82f6', 'Car', ['uber', '99', 'combustivel', 'gasolina', 'posto', 'estacionamento', 'onibus', 'metro', 'pedagio']),
  c('Saúde', '#14b8a6', 'Stethoscope', ['farmacia', 'drogaria', 'medico', 'consulta', 'exame', 'plano de saude', 'dentista']),
  c('Academia', '#10b981', 'Dumbbell', ['academia', 'gym', 'personal', 'crossfit', 'suplemento', 'whey']),
  c('Educação', '#6366f1', 'GraduationCap', ['faculdade', 'mensalidade', 'curso', 'udemy', 'alura', 'livro', 'material']),
  c('Assinaturas', '#a855f7', 'Tv', ['netflix', 'spotify', 'amazon', 'disney', 'youtube', 'assinatura', 'icloud', 'github']),
  c('Lazer', '#ec4899', 'Clapperboard', ['cinema', 'show', 'viagem', 'hotel', 'passagem', 'jogo', 'steam']),
  c('Vestuário', '#8b5cf6', 'Shirt', ['roupa', 'tenis', 'calcado', 'shopping', 'loja']),
  c('Pets', '#84cc16', 'PawPrint', ['pet', 'racao', 'veterinario', 'petshop']),
  c('Impostos e taxas', '#64748b', 'ReceiptText', ['imposto', 'taxa', 'tarifa', 'anuidade', 'juros', 'multa']),
  c('Presentes', '#f59e0b', 'Gift', ['presente', 'aniversario']),
  c('Outros', '#71717a', 'Package', []),

  // Receitas
  c('Salário', '#22c55e', 'Briefcase', ['salario', 'pagamento', 'folha'], 'income'),
  c('Freelance', '#06b6d4', 'Laptop', ['freela', 'freelance', 'projeto', 'servico'], 'income'),
  c('Rendimentos', '#eab308', 'TrendingUp', ['rendimento', 'dividendo', 'juros', 'cdb', 'tesouro'], 'income'),
  c('Reembolso', '#94a3b8', 'Undo2', ['reembolso', 'estorno', 'devolucao'], 'income'),
  c('Outras receitas', '#71717a', 'CircleDollarSign', [], 'income'),
]

function c(
  name: string,
  color: string,
  /** Nome do ícone Lucide — ver `features/finance/category-icons.tsx`. */
  icon: CategoryIconName,
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
