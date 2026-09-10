/**
 * Catálogo de temas.
 *
 * O tema vive em dois atributos do `<html>`: `data-theme` guarda a escolha
 * (`dracula`, `nord`, ...) e `data-scheme` diz se ela é clara ou escura. A
 * separação evita repetir cada regra "quando estiver no escuro" uma vez por
 * tema — os acentos de módulo e o `color-scheme` do navegador olham só para
 * `data-scheme`.
 *
 * As cores de cada tema estão no `index.css`; aqui ficam o rótulo, a amostra
 * exibida no seletor e a cor da barra do sistema.
 */

export type ThemeId = 'light' | 'dark' | 'dim' | 'dracula' | 'nord' | 'solar'

export type ColorScheme = 'light' | 'dark'

export interface ThemeInfo {
  id: ThemeId
  label: string
  description: string
  scheme: ColorScheme
  /** Cor da barra do sistema no celular — igual ao fundo do tema. */
  color: string
  /** Fundo, superfície e destaque: as três cores da miniatura do seletor. */
  swatch: [string, string, string]
}

export const THEMES: ThemeInfo[] = [
  {
    id: 'dark',
    label: 'Escuro',
    description: 'O padrão do Life: cinza-azulado profundo.',
    scheme: 'dark',
    color: '#1a1a1d',
    swatch: ['#1a1a1d', '#2a2a2f', '#7aa2f7'],
  },
  {
    id: 'dim',
    label: 'Escuro suave',
    description: 'Menos contraste que o escuro, para ambiente iluminado.',
    scheme: 'dark',
    color: '#33353d',
    swatch: ['#33353d', '#41444d', '#8fb4fa'],
  },
  {
    id: 'light',
    label: 'Claro',
    description: 'Branco limpo, para telas com muita luz por perto.',
    scheme: 'light',
    color: '#fafafa',
    swatch: ['#fafafa', '#ffffff', '#3b74d4'],
  },
  {
    id: 'dracula',
    label: 'Drácula',
    description: 'Roxo e rosa sobre grafite — o clássico dos editores.',
    scheme: 'dark',
    color: '#282a36',
    swatch: ['#282a36', '#343747', '#bd93f9'],
  },
  {
    id: 'nord',
    label: 'Nord',
    description: 'Azul-gelo nórdico, contraste baixo e frio.',
    scheme: 'dark',
    color: '#2e3440',
    swatch: ['#2e3440', '#3b4252', '#88c0d0'],
  },
  {
    id: 'solar',
    label: 'Sépia',
    description: 'Fundo bege de papel, à base do Solarized claro.',
    scheme: 'light',
    color: '#fdf6e3',
    swatch: ['#fdf6e3', '#fffbf0', '#268bd2'],
  },
]

export const DEFAULT_THEME: ThemeId = 'dark'

export const THEME_KEY = 'life:theme'

const BY_ID = new Map(THEMES.map((theme) => [theme.id, theme]))

export function themeInfo(id: ThemeId): ThemeInfo {
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_THEME)!
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && BY_ID.has(value as ThemeId)
}

/**
 * O que está guardado no navegador.
 *
 * Aceita `'light'` e `'dark'` porque foram os únicos valores gravados até a
 * versão 0.2.2 — quem já usava o app não perde a escolha ao atualizar.
 */
export function readTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (isThemeId(stored)) return stored
  } catch {
    // Navegador com armazenamento bloqueado: vale o padrão.
  }
  return DEFAULT_THEME
}

const listeners = new Set<() => void>()

/** Aplica no documento, grava a escolha e avisa quem estiver ouvindo. */
export function applyTheme(id: ThemeId): void {
  const theme = themeInfo(id)
  const root = document.documentElement

  root.dataset.theme = theme.id
  root.dataset.scheme = theme.scheme

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.color)

  try {
    localStorage.setItem(THEME_KEY, theme.id)
  } catch {
    // Sem armazenamento a escolha vale só nesta sessão.
  }

  for (const listener of listeners) listener()
}

export function currentTheme(): ThemeId {
  const attribute = document.documentElement.dataset.theme
  return isThemeId(attribute) ? attribute : DEFAULT_THEME
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
