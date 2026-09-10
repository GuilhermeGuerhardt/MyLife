import { Check } from 'lucide-react'
import { ThemeSwatch, useTheme } from '@/components/theme-toggle'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { THEMES } from '@/lib/theme'
import { cn } from '@/lib/utils'

/**
 * Seletor de tema com amostra de cada opção.
 *
 * A escolha vale para o aparelho, não para o perfil: quem abre o mesmo banco
 * no desktop e no navegador costuma querer claro num e escuro no outro.
 */
export function ThemeCard() {
  const [theme, setTheme] = useTheme()

  return (
    <Card>
      <CardHeader
        title="Tema"
        description="Vale para este aparelho e é lembrado na próxima abertura."
      />
      <CardContent className="grid gap-2 pt-3 sm:grid-cols-2">
        {THEMES.map((option) => {
          const active = option.id === theme
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => setTheme(option.id)}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                active
                  ? 'border-accent bg-accent-soft'
                  : 'border-border-base hover:border-border-strong hover:bg-surface-2',
              )}
            >
              <ThemeSwatch swatch={option.swatch} className="size-9 rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="text-fg flex items-center gap-1.5 text-sm font-medium">
                  {option.label}
                  {active && <Check className="text-accent size-3.5" />}
                </span>
                <span className="text-fg-subtle mt-0.5 block text-[11px] leading-snug">
                  {option.description}
                </span>
              </span>
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}
