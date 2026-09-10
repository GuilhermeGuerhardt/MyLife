import { useSyncExternalStore } from 'react'
import { applyTheme, currentTheme, subscribeTheme, type ThemeId } from '@/lib/theme'
import { cn } from '@/lib/utils'

/**
 * Tema escolhido, com a troca.
 *
 * A escolha vive no documento e no `localStorage`, não no estado do React —
 * ela é aplicada antes do primeiro paint, muito antes de qualquer componente
 * montar. Este hook só a lê de lá e avisa quem estiver na tela quando muda.
 */
export function useTheme(): [ThemeId, (id: ThemeId) => void] {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => 'dark' as ThemeId)
  return [theme, applyTheme]
}

/** Miniatura do tema: fundo, superfície e destaque, nessa ordem. */
export function ThemeSwatch({
  swatch,
  className,
}: {
  swatch: readonly [string, string, string]
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'border-border-base flex size-6 shrink-0 overflow-hidden rounded-md border',
        className,
      )}
    >
      <span className="w-1/2" style={{ background: swatch[0] }} />
      <span className="flex w-1/2 flex-col">
        <span className="h-1/2" style={{ background: swatch[1] }} />
        <span className="h-1/2" style={{ background: swatch[2] }} />
      </span>
    </span>
  )
}
