/**
 * Ícones das categorias.
 *
 * O resto do app desenha com Lucide; só as categorias vinham de emoji, e emoji
 * é desenhado pela fonte do sistema — muda de forma entre Windows, Android e
 * iPhone, não acompanha a cor do tema e destoa de tudo que está ao redor.
 *
 * O nome do ícone é o que fica gravado em `Category.icon`, não o componente:
 * o banco guarda texto, e um registro explícito mantém o `lucide-react` sujeito
 * a tree-shaking — importar a biblioteca inteira para resolver um nome em tempo
 * de execução colocaria seis mil ícones no bundle.
 */

import {
  Baby,
  Banknote,
  Beer,
  Bike,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  CircleDollarSign,
  Clapperboard,
  Coffee,
  CreditCard,
  Droplet,
  Dumbbell,
  Flame,
  Fuel,
  Gift,
  GraduationCap,
  Guitar,
  HandCoins,
  Hammer,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Package,
  PawPrint,
  PiggyBank,
  Pill,
  Plane,
  ReceiptText,
  Scissors,
  Shirt,
  ShoppingCart,
  ShowerHead,
  Smartphone,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Tv,
  Undo2,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * O catálogo de ícones oferecidos, em ordem de utilidade para o dia a dia.
 *
 * A chave é o que vai para o banco. Nomes iguais aos do Lucide de propósito:
 * procurar "PawPrint" no site deles devolve exatamente este desenho.
 */
export const CATEGORY_ICONS = {
  House,
  ShoppingCart,
  UtensilsCrossed,
  Coffee,
  Beer,
  Car,
  Fuel,
  Bus,
  Bike,
  Plane,
  Stethoscope,
  Pill,
  HeartPulse,
  Dumbbell,
  GraduationCap,
  BookOpen,
  Laptop,
  Smartphone,
  Wifi,
  Tv,
  Clapperboard,
  Guitar,
  Shirt,
  Scissors,
  ShowerHead,
  Sparkles,
  PawPrint,
  Baby,
  Gift,
  Wrench,
  Hammer,
  Zap,
  Droplet,
  Flame,
  ReceiptText,
  Landmark,
  CreditCard,
  Banknote,
  PiggyBank,
  HandCoins,
  CircleDollarSign,
  Wallet,
  Briefcase,
  TrendingUp,
  Undo2,
  Package,
} satisfies Record<string, LucideIcon>

export type CategoryIconName = keyof typeof CATEGORY_ICONS

/** O que aparece quando o nome gravado não existe (mais) no catálogo. */
export const DEFAULT_ICON: CategoryIconName = 'Package'

/**
 * Emoji para nome de ícone.
 *
 * Quem já usava o app tem emoji gravado em `Category.icon`, e o catálogo
 * inicial era todo em emoji. Sem esta tradução, cada categoria existente
 * apareceria com o ícone genérico e a pessoa teria que reescolher as vinte à
 * mão — um recurso novo não pode cobrar isso de quem já usava.
 */
const DE_EMOJI: Record<string, CategoryIconName> = {
  '🏠': 'House',
  '🛒': 'ShoppingCart',
  '🛵': 'Bike',
  '🍽️': 'UtensilsCrossed',
  '🍽': 'UtensilsCrossed',
  '🚗': 'Car',
  '🩺': 'Stethoscope',
  '🏋️': 'Dumbbell',
  '🏋': 'Dumbbell',
  '🎓': 'GraduationCap',
  '📺': 'Tv',
  '🎬': 'Clapperboard',
  '👕': 'Shirt',
  '🐾': 'PawPrint',
  '🧾': 'ReceiptText',
  '🎁': 'Gift',
  '📦': 'Package',
  '💼': 'Briefcase',
  '💻': 'Laptop',
  '📈': 'TrendingUp',
  '↩️': 'Undo2',
  '↩': 'Undo2',
  '💰': 'CircleDollarSign',
  '✈️': 'Plane',
  '✈': 'Plane',
  '⛽': 'Fuel',
  '📱': 'Smartphone',
  '🔧': 'Wrench',
  '☕': 'Coffee',
  '🍺': 'Beer',
  '💊': 'Pill',
  '🚿': 'ShowerHead',
  '🚭': 'Sparkles',
  '💸': 'Banknote',
  '🏦': 'Landmark',
  '💳': 'CreditCard',
  '🐷': 'PiggyBank',
  '👶': 'Baby',
}

/**
 * Resolve o que está gravado — nome novo, emoji antigo ou lixo — num ícone.
 *
 * A tradução acontece na leitura, não numa migração de banco: o campo continua
 * sendo texto livre, ninguém precisa rodar nada, e uma pasta de trabalho
 * sincronizada de outro computador que ainda tenha emoji continua legível.
 */
export function resolveIconName(stored: string | null | undefined): CategoryIconName {
  if (!stored) return DEFAULT_ICON
  /*
   * `Object.hasOwn` e não `in`: `in` enxerga o protótipo, então um campo
   * gravado como "toString" passaria pela checagem e devolveria a função do
   * `Object` no lugar de um ícone — que o React tentaria renderizar como
   * componente e derrubaria a tela inteira.
   */
  if (Object.hasOwn(CATEGORY_ICONS, stored)) return stored as CategoryIconName
  return Object.hasOwn(DE_EMOJI, stored) ? DE_EMOJI[stored]! : DEFAULT_ICON
}

/** O componente do ícone de uma categoria, pronto para receber `className`. */
export function iconComponent(stored: string | null | undefined): LucideIcon {
  return CATEGORY_ICONS[resolveIconName(stored)]
}

/**
 * Desenha o ícone da categoria na cor dela.
 *
 * A cor vem por `color` e não por classe porque é um valor do banco — Tailwind
 * não tem como gerar uma classe para uma cor que só existe em tempo de execução.
 */
export function CategoryIcon({
  icon,
  color,
  className = 'size-4',
}: {
  icon: string | null | undefined
  color?: string | null
  className?: string
}) {
  const Icon = iconComponent(icon)
  return <Icon className={className} style={color ? { color } : undefined} aria-hidden />
}
