import { Card, CardContent } from '@/components/ui/card'
import { Progress, Stat } from '@/components/ui/misc'
import type { ProgramProgress } from '@/lib/education/academics'
import { decimal, integer, percent } from '@/lib/format'

/**
 * Os quatro números do curso: quanto andou, quanto falta, o CR e a previsão.
 *
 * A previsão sai do ritmo já cumprido, não de uma meta: um semestre puxado não
 * vira promessa de formatura antecipada.
 */
export function NumerosDoCurso({
  progresso,
  coeficiente,
  semestresRestantes,
  horasPorSemestre,
}: {
  progresso: ProgramProgress
  coeficiente: number | null
  semestresRestantes: number | null
  horasPorSemestre: number
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent>
          <Stat
            label="Progresso"
            value={percent(progresso.percent, 1)}
            hint={`${integer(progresso.hoursDone)} de ${integer(progresso.hoursTotal)} h`}
          />
          <Progress className="mt-3" value={progresso.percent} />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stat
            label="Falta cursar"
            value={progresso.remaining.length}
            unit={progresso.remaining.length === 1 ? 'disciplina' : 'disciplinas'}
            hint={`${integer(progresso.hoursRemaining)} h restantes`}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stat
            label="Coeficiente de rendimento"
            value={coeficiente !== null ? decimal(coeficiente, 2) : '—'}
            hint={coeficiente !== null ? 'Ponderado por créditos' : 'Sem notas lançadas'}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stat
            label="Previsão"
            value={semestresRestantes ? `${semestresRestantes}` : '—'}
            unit={
              semestresRestantes
                ? semestresRestantes === 1
                  ? 'semestre'
                  : 'semestres'
                : undefined
            }
            hint={
              semestresRestantes
                ? `No ritmo de ${integer(horasPorSemestre)} h por semestre`
                : 'Conclua disciplinas para estimar'
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
