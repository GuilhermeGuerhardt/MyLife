import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Os números do topo de uma tela, num painel só.
 *
 * Eram um cartão por número: quatro caixas flutuando lado a lado, com sombra e
 * canto, para dizer quatro coisas do mesmo assunto. Aqui é uma superfície só,
 * dividida por fio — o olho lê a linha inteira de uma vez, e a tela para de
 * parecer um mural de blocos.
 *
 * No celular eles empilham e o fio vira horizontal.
 */
export function PainelDeNumeros({
  children,
  className,
}: {
  /** Um `Stat` por coluna. */
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="divide-border-base grid divide-y sm:auto-cols-fr sm:grid-flow-col sm:divide-x sm:divide-y-0 [&>*]:p-5">
        {children}
      </div>
    </Card>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'positive' | 'negative' | 'warning'
  className?: string
}) {
  const tones = {
    neutral: 'bg-surface-2 text-fg-muted border-transparent',
    accent: 'bg-accent-soft text-accent border-transparent',
    positive: 'bg-positive/10 text-positive border-transparent',
    negative: 'bg-negative/10 text-negative border-transparent',
    warning: 'bg-warning/10 text-warning border-transparent',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Progress({
  value,
  max = 100,
  tone = 'accent',
  className,
}: {
  value: number
  max?: number
  tone?: 'accent' | 'positive' | 'negative' | 'warning'
  className?: string
}) {
  const pct = max > 0 ? Math.min(Math.max((value / max) * 100, 0), 100) : 0
  const tones = {
    accent: 'bg-accent',
    positive: 'bg-positive',
    negative: 'bg-negative',
    warning: 'bg-warning',
  }
  return (
    <div className={cn('bg-surface-2 h-1.5 w-full overflow-hidden rounded-full', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', tones[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/**
 * Um número com rótulo.
 *
 * O número é neutro. Cor aqui é aviso, não enfeite: verde em toda receita e
 * vermelho em toda despesa pintam o óbvio e, de quebra, gastam a cor que
 * deveria saltar quando o saldo fica negativo. Por isso só sobrou `negative`.
 *
 * Também não tem ícone: uma carteirinha ao lado de "Saldo em contas" não diz
 * nada que o rótulo já não diga, e repetida em quatro cartões vira ruído.
 */
export function Stat({
  label,
  value,
  unit,
  hint,
  tone,
}: {
  label: string
  value: ReactNode
  unit?: string
  hint?: ReactNode
  tone?: 'negative' | 'muted'
}) {
  const toneClass = tone === 'negative' ? 'text-negative' : 'text-fg'
  return (
    <div className="space-y-1.5">
      <div className="text-fg-muted text-xs font-medium">{label}</div>
      {/* Entrelinha curta e tracking fechado: o número ganha presença sem
          crescer de corpo. Crescer não cabe — "R$ 3.382,60" já ocupa a largura
          inteira da coluna num monitor estreito. */}
      <div
        className={cn(
          'font-serif flex items-baseline gap-1 text-[22px] leading-none font-semibold',
          toneClass,
        )}
      >
        {value}
        {unit && (
          <span className="text-fg-subtle text-sm font-medium tracking-normal">{unit}</span>
        )}
      </div>
      {hint && <div className="text-fg-subtle text-xs leading-snug">{hint}</div>}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="text-fg-subtle mb-1">{icon}</div>}
      <p className="text-fg text-sm font-medium">{title}</p>
      {description && <p className="text-fg-muted max-w-sm text-xs">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  /** `ariaLabel` é obrigatório quando o rótulo visível é só um ícone. */
  options: Array<{ value: T; label: ReactNode; ariaLabel?: string }>
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div
      className={cn('bg-surface-2 border-border-base inline-flex gap-0.5 rounded-lg border p-0.5', className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          aria-label={option.ariaLabel}
          title={option.ariaLabel}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-[6px] px-3 py-1.5 text-xs font-medium transition-colors',
            value === option.value
              ? 'bg-surface text-fg border-border-base border'
              : 'text-fg-muted hover:text-fg',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  /** Travado em vez de ausente: some o botão, some a explicação do porquê. */
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        checked ? 'bg-accent' : 'bg-border-strong',
      )}
    >
      <span
        className={cn(
          'bg-surface absolute top-0.5 size-4 rounded-full shadow transition-[left]',
          checked ? 'left-4.5' : 'left-0.5',
        )}
      />
    </button>
  )
}

/** Aviso dentro de um cartão: o que está errado, ou o que vai acontecer. */
export function Callout({
  tone,
  icon,
  className,
  children,
}: {
  tone: 'warning' | 'negative'
  icon?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border border-transparent p-3 text-xs',
        tone === 'warning' ? 'bg-warning/10 text-warning' : 'bg-negative/10 text-negative',
        className,
      )}
    >
      {icon && <span className="mt-px shrink-0">{icon}</span>}
      <p>{children}</p>
    </div>
  )
}

/**
 * Divisor de assunto dentro de uma tela.
 *
 * O traço embaixo do texto é da cor do módulo e tem a largura do título, não da
 * tela: divide sem cortar a página em faixas, que era o que uma régua de ponta
 * a ponta fazia entre dois grupos de cartões.
 */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="text-fg border-border-strong border-b pb-1.5 text-base font-semibold">
        {children}
      </h2>
      {action}
    </div>
  )
}
