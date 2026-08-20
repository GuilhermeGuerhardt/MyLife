import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './button'

/**
 * Modal simples com portal. No mobile ele vira uma folha ancorada embaixo —
 * é onde o polegar alcança, e é lá que os registros rápidos acontecem.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-surface border-border-base animate-[var(--animate-in)] relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="text-fg text-sm font-semibold">{title}</h2>
            {description && <p className="text-fg-muted mt-0.5 text-xs">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
            <X />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
