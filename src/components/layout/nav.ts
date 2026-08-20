import {
  BookOpen,
  GraduationCap,
  HeartPulse,
  LayoutDashboard,
  Repeat,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Classe de cor do módulo — aplicada no conteúdo ao entrar na rota. */
  accent: string
  children?: Array<{ to: string; label: string }>
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Início', icon: LayoutDashboard, accent: '' },
  {
    to: '/saude',
    label: 'Saúde',
    icon: HeartPulse,
    accent: 'accent-health',
    children: [
      { to: '/saude', label: 'Visão geral' },
      { to: '/saude/atividades', label: 'Atividades' },
      { to: '/saude/plano', label: 'Plano de emagrecimento' },
      { to: '/saude/alimentacao', label: 'Alimentação' },
    ],
  },
  {
    to: '/faculdade',
    label: 'Faculdade',
    icon: GraduationCap,
    accent: 'accent-education',
    children: [
      { to: '/faculdade', label: 'Meus cursos' },
      { to: '/faculdade/caderno', label: 'Caderno' },
    ],
  },
  {
    to: '/cursos',
    label: 'Cursos',
    icon: BookOpen,
    accent: 'accent-courses',
    children: [
      { to: '/cursos', label: 'Minha lista' },
      { to: '/cursos/caderno', label: 'Caderno' },
    ],
  },
  {
    to: '/financeiro',
    label: 'Financeiro',
    icon: Wallet,
    accent: 'accent-finance',
    children: [
      { to: '/financeiro', label: 'Visão geral' },
      { to: '/financeiro/transacoes', label: 'Lançamentos' },
      { to: '/financeiro/contas', label: 'Contas e cartões' },
      { to: '/financeiro/orcamento', label: 'Orçamento e metas' },
      { to: '/financeiro/importar', label: 'Importar planilha' },
    ],
  },
  {
    to: '/rotina',
    label: 'Rotina',
    icon: Repeat,
    accent: 'accent-routine',
    children: [
      { to: '/rotina', label: 'Hábitos' },
      { to: '/rotina/agenda', label: 'Agenda' },
      { to: '/rotina/insights', label: 'Insights' },
    ],
  },
]

export function accentForPath(pathname: string): string {
  const match = NAV.filter((item) => item.to !== '/').find((item) => pathname.startsWith(item.to))
  return match?.accent ?? ''
}
