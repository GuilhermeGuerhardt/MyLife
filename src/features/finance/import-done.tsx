import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/misc'
import type { ImportResult } from './use-import'

/** O que entrou, depois de gravado. */
export function ImportDone({
  result,
  onAgain,
  onSeeAll,
}: {
  result: ImportResult
  onAgain: () => void
  onSeeAll: () => void
}) {
  const created = [
    result.accountsCreated > 0 &&
      `${result.accountsCreated} ${result.accountsCreated === 1 ? 'conta criada' : 'contas criadas'}`,
    result.categoriesCreated > 0 &&
      `${result.categoriesCreated} ${result.categoriesCreated === 1 ? 'categoria criada' : 'categorias criadas'}`,
  ].filter(Boolean)

  const etiqueta = 'Os lançamentos ficaram com a etiqueta "importado".'

  return (
    <Card>
      <CardContent>
        <EmptyState
          icon={<Check className="size-5" />}
          title={`${result.transactions} ${result.transactions === 1 ? 'lançamento importado' : 'lançamentos importados'}`}
          description={created.length > 0 ? `${created.join(' e ')}. ${etiqueta}` : etiqueta}
          action={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onAgain}>
                Importar outro
              </Button>
              <Button onClick={onSeeAll}>Ver lançamentos</Button>
            </div>
          }
        />
      </CardContent>
    </Card>
  )
}
