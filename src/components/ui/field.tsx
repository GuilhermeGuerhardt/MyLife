import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const control =
  'bg-surface-2 border-border-base text-fg placeholder:text-fg-subtle h-9.5 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus:border-accent disabled:opacity-50'

export function Field({
  label,
  hint,
  error,
  suffix,
  children,
  className,
}: {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  suffix?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      {label && <span className="text-fg-muted block text-xs font-medium">{label}</span>}
      <div className="relative">
        {children}
        {suffix && (
          <span className="text-fg-subtle pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
            {suffix}
          </span>
        )}
      </div>
      {error ? (
        <span className="text-negative block text-xs">{error}</span>
      ) : (
        hint && <span className="text-fg-subtle block text-xs">{hint}</span>
      )}
    </label>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, 'cursor-pointer pr-8', className)} {...props}>
      {children}
    </select>
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'h-auto min-h-20 py-2', className)} {...props} />
}
