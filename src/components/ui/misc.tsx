import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

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
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
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

export function Stat({
  label,
  value,
  unit,
  hint,
  tone,
  icon,
}: {
  label: string
  value: ReactNode
  unit?: string
  hint?: ReactNode
  tone?: 'positive' | 'negative' | 'muted'
  icon?: ReactNode
}) {
  const toneClass =
    tone === 'positive' ? 'text-positive' : tone === 'negative' ? 'text-negative' : 'text-fg'
  return (
    <div className="space-y-1.5">
      <div className="text-fg-muted flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {label}
      </div>
      {/* Entrelinha curta e tracking fechado: o número ganha presença sem
          crescer de corpo. Crescer não cabe — "R$ 3.382,60" já ocupa a largura
          inteira da coluna num monitor estreito. */}
      <div
        className={cn(
          'flex items-baseline gap-1 text-2xl leading-none font-semibold tracking-[-0.02em]',
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
              ? 'bg-surface text-fg shadow-[var(--shadow-card)]'
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
      <h2 className="text-fg border-accent border-b-2 pb-1.5 text-base font-semibold tracking-[-0.01em]">
        {children}
      </h2>
      {action}
    </div>
  )
}
