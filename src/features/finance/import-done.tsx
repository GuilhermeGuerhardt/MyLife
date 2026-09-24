import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/misc'
import { descreverResultado, type ImportResult } from '@/lib/finance/import-result'

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
  // O mesmo texto que o cartão do canto mostra para quem saiu da tela.
  const recibo = descreverResultado(result)

  return (
    <Card>
      <CardContent>
        <EmptyState
          icon={<Check className="size-5" />}
          title={recibo.titulo}
          description={recibo.detalhe}
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
