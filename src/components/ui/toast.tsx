/**
 * Avisos discretos no canto inferior direito.
 *
 * Diferente do `confirmar()` de `lib/avisos.ts`, que interrompe com uma janela
 * nativa: aqui nada bloqueia. O aviso aparece, o app continua usável por baixo,
 * e o que for passageiro some sozinho — é o comportamento das notificações do
 * VS Code, e o que faz um aviso de atualização não parecer uma cobrança.
 */

import { X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type ToastTone = 'neutral' | 'accent'

export interface ToastProps {
  tone?: ToastTone
  icon?: ReactNode
  title: string
  description?: ReactNode
  /** Ações à direita do rodapé. Tendo ação, o aviso não some sozinho. */
  actions?: ReactNode
  /** Milissegundos até sumir. `null` = fica até fecharem. */
  duration?: number | null
  onClose: () => void
}

export function Toast({
  tone = 'neutral',
  icon,
  title,
  description,
  actions,
  duration = 4000,
  onClose,
}: ToastProps) {
  // Monta invisível e sobe no quadro seguinte: sem isso a transição não tem
  // estado inicial para partir e o aviso simplesmente pisca na tela.
  const [visivel, setVisivel] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisivel(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (duration === null) return
    const id = setTimeout(onClose, duration)
    return () => clearTimeout(id)
  }, [duration, onClose])

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'border-border-base bg-surface pointer-events-auto w-80 rounded-xl border p-3 shadow-lg',
        'transition-all duration-200 ease-out',
        visivel ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        tone === 'accent' && 'border-accent/40',
      )}
    >
      <div className="flex items-start gap-2.5">
        {icon && (
          <span className={cn('mt-0.5 shrink-0', tone === 'accent' ? 'text-accent' : 'text-fg-subtle')}>
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-fg text-sm font-medium">{title}</p>
          {description && (
            <div className="text-fg-muted mt-0.5 text-xs leading-relaxed">{description}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar aviso"
          className="text-fg-subtle hover:text-fg -mt-0.5 -mr-0.5 shrink-0 transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {actions && <div className="mt-2.5 flex justify-end gap-2">{actions}</div>}
    </div>
  )
}

/** O canto onde os avisos se empilham. Não captura cliques fora dos cartões. */
export function ToastArea({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2">
      {children}
    </div>
  )
}
