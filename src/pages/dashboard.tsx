import { Command, LayoutGrid } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/misc'
import { useProfile } from '@/data/queries'
import { CustomizeDashboard } from '@/features/dashboard/customize'
import { useDashboardLayout } from '@/features/dashboard/use-dashboard-layout'
import { longDate } from '@/lib/format'
import { today } from '@/lib/dates'
import { cn } from '@/lib/utils'

/**
 * Bento grid montado a partir do layout salvo. A tela não sabe o que cada
 * widget faz — só onde ele entra na grade.
 */
export function Dashboard({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { profile } = useProfile()
  const layout = useDashboardLayout()
  const [customizing, setCustomizing] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-fg text-xl font-semibold">
            {greeting()}
            {profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-fg-muted mt-1 text-sm first-letter:uppercase">{longDate(today())}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Personalizar dashboard"
            onClick={() => setCustomizing(true)}
          >
            <LayoutGrid />
          </Button>
          <Button variant="secondary" onClick={onOpenPalette}>
            <Command />
            Registrar rápido
          </Button>
        </div>
      </div>

      {layout.visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LayoutGrid className="size-6" />}
            title="Dashboard vazio"
            description="Todos os widgets estão ocultos."
            action={<Button onClick={() => setCustomizing(true)}>Escolher widgets</Button>}
          />
        </Card>
      ) : (
        <div className="grid auto-rows-min gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {layout.visible.map(({ def }) => (
            <div key={def.id} className={cn(def.span === 2 && 'sm:col-span-2')}>
              <def.Component />
            </div>
          ))}
        </div>
      )}

      <CustomizeDashboard
        open={customizing}
        onClose={() => setCustomizing(false)}
        layout={layout}
      />
    </div>
  )
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return 'Boa madrugada'
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}
