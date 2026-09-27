import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium whitespace-nowrap transition-[background-color,border-color,color,opacity,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // O fio de luz no topo é o mesmo do cartão: dá ao botão cheio o
        // volume que uma cor chapada não tem.
        primary:
          'bg-accent text-accent-fg shadow-[inset_0_1px_0_0_oklch(1_0_0/0.18)] hover:opacity-90',
        secondary: 'bg-surface-2 text-fg border border-border-base hover:border-border-strong',
        ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg',
        outline: 'border border-border-strong text-fg hover:bg-surface-2',
        danger: 'bg-negative text-white hover:opacity-90',
      },
      size: {
        sm: 'h-8 px-3 text-xs [&_svg]:size-3.5',
        md: 'h-9.5 px-4 text-sm [&_svg]:size-4',
        lg: 'h-11 px-5 text-sm [&_svg]:size-4',
        icon: 'size-9 [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  children?: ReactNode
}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonStyles({ variant, size }), className)} {...props} />
}
