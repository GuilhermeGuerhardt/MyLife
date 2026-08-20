import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-[background-color,border-color,color,opacity] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg hover:opacity-90',
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
    VariantProps<typeof button> {
  children?: ReactNode
}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size }), className)} {...props} />
}
