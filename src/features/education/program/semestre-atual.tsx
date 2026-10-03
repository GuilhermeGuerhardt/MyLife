import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/misc'
import type { Subject } from '@/data/types'
import { TermSubject } from '@/features/education/term-subject'

/** As disciplinas marcadas como "Cursando", com faltas e notas de cada uma. */
export function SemestreAtual({
  cursando,
  notaDeAprovacao,
  onAbrirGrade,
}: {
  cursando: Subject[]
  notaDeAprovacao: number
  onAbrirGrade: () => void
}) {
  return (
    <div className="space-y-4">
      {cursando.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma disciplina em curso"
            description='Marque como "Cursando" na grade as disciplinas deste semestre para acompanhar faltas e notas.'
            action={
              <Button size="sm" onClick={onAbrirGrade}>
                Abrir grade
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cursando.map((subject) => (
            <TermSubject key={subject.id} subject={subject} passingGrade={notaDeAprovacao} />
          ))}
        </div>
      )}
    </div>
  )
}
