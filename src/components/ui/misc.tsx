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
    neutral: 'bg-surface-2 text-fg-muted border-border-base',
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
    <div className="space-y-1">
      <div className="text-fg-muted flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {label}
      </div>
      <div className={cn('flex items-baseline gap-1 text-2xl font-semibold', toneClass)}>
        {value}
        {unit && <span className="text-fg-subtle text-sm font-medium">{unit}</span>}
      </div>
      {hint && <div className="text-fg-subtle text-xs">{hint}</div>}
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
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors',
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

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-4">
      <h2 className="text-fg text-base font-semibold">{children}</h2>
      {action}
    </div>
  )
}
