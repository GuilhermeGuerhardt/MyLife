import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Toggle } from '@/components/ui/misc'
import type { useDashboardLayout } from './use-dashboard-layout'

/**
 * Personalização do dashboard.
 *
 * Reordenar por setas em vez de arrastar: funciona no teclado, funciona no
 * celular e não precisa de biblioteca de drag-and-drop para uma lista de onze
 * itens que se mexe uma vez por mês.
 */
export function CustomizeDashboard({
  open,
  onClose,
  layout,
}: {
  open: boolean
  onClose: () => void
  layout: ReturnType<typeof useDashboardLayout>
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Personalizar dashboard"
      description="Escolha o que aparece na abertura e em que ordem."
      footer={
        <>
          {layout.isCustomized && (
            <Button variant="ghost" className="mr-auto" onClick={() => void layout.reset()}>
              Restaurar padrão
            </Button>
          )}
          <Button onClick={onClose}>Pronto</Button>
        </>
      }
    >
      <ul className="divide-border-base divide-y">
        {layout.items.map((item, index) => (
          <li key={item.def.id} className="flex items-center gap-3 py-2.5">
            <div className="flex flex-col">
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                disabled={index === 0}
                aria-label={`Mover ${item.def.title} para cima`}
                onClick={() => void layout.move(item.def.id, -1)}
              >
                <ChevronUp />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                disabled={index === layout.items.length - 1}
                aria-label={`Mover ${item.def.title} para baixo`}
                onClick={() => void layout.move(item.def.id, 1)}
              >
                <ChevronDown />
              </Button>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-fg text-sm font-medium">{item.def.title}</p>
              <p className="text-fg-subtle text-[11px]">{item.def.description}</p>
            </div>

            <Toggle
              checked={item.visible}
              label={`Mostrar ${item.def.title}`}
              onChange={() => void layout.toggle(item.def.id)}
            />
          </li>
        ))}
      </ul>
    </Modal>
  )
}
