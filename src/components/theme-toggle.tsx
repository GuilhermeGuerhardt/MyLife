import { Check, Moon, Palette, Sun } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  applyTheme,
  currentTheme,
  subscribeTheme,
  themeInfo,
  THEMES,
  type ThemeId,
} from '@/lib/theme'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'

/** Tema escolhido, compartilhado entre o cabeçalho e a tela de perfil. */
export function useTheme(): [ThemeId, (id: ThemeId) => void] {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => 'dark' as ThemeId)
  return [theme, applyTheme]
}

/**
 * Botão do cabeçalho: abre a lista de temas.
 *
 * Era um interruptor claro/escuro. Com seis temas, alternar em ciclo obrigaria
 * a passar por todos para chegar no desejado — a lista mostra tudo de uma vez
 * e continua cabendo no mesmo espaço.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useTheme()
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const info = themeInfo(theme)

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={container}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Tema: ${info.label}. Trocar`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {info.scheme === 'dark' ? <Moon /> : <Sun />}
      </Button>

      {open && (
        <div
          role="menu"
          className="bg-surface border-border-base animate-[var(--animate-in)] absolute right-0 z-50 mt-1.5 w-60 overflow-hidden rounded-xl border p-1 shadow-lg"
        >
          <p className="text-fg-subtle flex items-center gap-1.5 px-2.5 pt-1.5 pb-1 text-[11px] font-medium">
            <Palette className="size-3" />
            Tema
          </p>
          {THEMES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={option.id === theme}
              onClick={() => {
                setTheme(option.id)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                option.id === theme ? 'bg-surface-2' : 'hover:bg-surface-2',
              )}
            >
              <ThemeSwatch swatch={option.swatch} />
              <span className="text-fg flex-1 text-xs font-medium">{option.label}</span>
              {option.id === theme && <Check className="text-accent size-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
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
