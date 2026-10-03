import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { addMonths, competenceLabel, toCompetence, type Competence } from '@/lib/finance/billing'
import { today } from '@/lib/utils'

/**
 * A navegação de mês das telas do financeiro.
 *
 * O atalho de volta só aparece fora do mês corrente: quem está no mês de hoje
 * não precisa de um botão para continuar onde está.
 */
export function MonthNav({
  competence,
  onChange,
}: {
  competence: Competence
  onChange: (competence: Competence) => void
}) {
  const isCurrent = competence === toCompetence(today())

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(addMonths(competence, -1))}
        aria-label="Mês anterior"
      >
        <ChevronLeft />
      </Button>
      <div className="min-w-36 text-center">
        <p className="text-fg text-sm font-medium">{competenceLabel(competence)}</p>
        {!isCurrent && (
          <button
            type="button"
            onClick={() => onChange(toCompetence(today()))}
            className="text-fg-subtle hover:text-fg text-xs transition-colors"
          >
            voltar para o mês atual
          </button>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(addMonths(competence, 1))}
        aria-label="Próximo mês"
      >
        <ChevronRight />
      </Button>
    </div>
  )
}
