import { Check, Moon, Sun } from 'lucide-react'
import { Fragment } from 'react'
import { ThemeSwatch, useTheme } from '@/components/theme'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { THEMES, type ColorScheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const GRUPOS: Array<{ scheme: ColorScheme; label: string; icon: typeof Moon }> = [
  { scheme: 'dark', label: 'Escuros', icon: Moon },
  { scheme: 'light', label: 'Claros', icon: Sun },
]

/**
 * Seletor de tema, escuros de um lado e claros do outro.
 *
 * Misturados na ordem do catálogo, achar "outro claro" obrigava a ler as oito
 * descrições — e a escolha quase sempre começa por "quero um claro", não por um
 * nome.
 *
 * As duas colunas são uma grade só, preenchida coluna a coluna, e não duas
 * pilhas lado a lado. Empilhadas, cada cartão tinha a altura do próprio texto e
 * as linhas não se correspondiam; numa grade, os dois cartões de cada linha
 * dividem a mesma altura e as colunas terminam juntas. A descrição é limitada a
 * duas linhas pelo mesmo motivo: uma frase mais longa desalinharia tudo.
 *
 * A escolha vale para o aparelho, não para o perfil: quem abre o mesmo banco no
 * desktop e no navegador costuma querer claro num e escuro no outro.
 */
export function ThemeCard() {
  const [theme, setTheme] = useTheme()

  return (
    <Card>
      <CardHeader
        title="Tema"
        description="Vale para este aparelho e é lembrado na próxima abertura."
      />
      <CardContent
        className={cn(
          'grid gap-x-4 gap-y-2 pt-3',
          // Cinco linhas — o cabeçalho e os quatro temas — preenchidas por
          // coluna. Em tela estreita a grade some e tudo empilha na ordem.
          'sm:grid-flow-col sm:grid-rows-[auto_auto_auto_auto_auto]',
        )}
      >
        {GRUPOS.map((grupo, indice) => (
          <Fragment key={grupo.scheme}>
            <p
              className={cn(
                'text-fg-muted flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase',
                // Empilhado, o segundo grupo precisa respirar; lado a lado, não.
                indice > 0 && 'mt-3 sm:mt-0',
              )}
            >
              <grupo.icon className="size-3" />
              {grupo.label}
            </p>

            {THEMES.filter((option) => option.scheme === grupo.scheme).map((option) => {
              const active = option.id === theme
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTheme(option.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors',
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
                    <span className="text-fg-subtle mt-0.5 line-clamp-2 text-[11px] leading-snug">
                      {option.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </Fragment>
        ))}
      </CardContent>
    </Card>
  )
}
