import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge, Progress } from '@/components/ui/misc'
import type { Program, Subject } from '@/data/types'
import { ProgramSchedule } from '@/features/education/program-schedule'
import {
  checkPrerequisites,
  type ProgramProgress,
  type SubjectLike,
} from '@/lib/education/academics'
import { integer, percent } from '@/lib/format'

/**
 * A aba de visão geral: o que falta, o que já dá para cursar e os avisos.
 *
 * "O que falta" vem ordenado por período e diz, em cada linha, se a disciplina
 * está liberada — é a pergunta que se faz na hora da matrícula, e tê-la aqui
 * evita abrir a grade inteira para conferir pré-requisito a pré-requisito.
 */
export function VisaoGeralDoCurso({
  program,
  subjects,
  progresso,
  liberadas,
  onSomarHorasComplementares,
}: {
  program: Program
  subjects: Subject[]
  progresso: ProgramProgress
  /** Só o que a lista usa: quem vem de `availableNext` não é uma `Subject` inteira. */
  liberadas: Array<{ id: string; name: string }>
  onSomarHorasComplementares: (horas: number) => void
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="O que falta" description="Pendentes e reprovadas, na ordem do período" />
        <CardContent className="pt-2">
          {progresso.remaining.length === 0 ? (
            <p className="text-positive text-sm">Nenhuma disciplina pendente — grade concluída.</p>
          ) : (
            <div className="divide-border-base -my-2 divide-y">
              {progresso.remaining
                .slice()
                .sort((a, b) => (a.period ?? 99) - (b.period ?? 99))
                .map((subject) => {
                  const check = checkPrerequisites(subject, subjects as SubjectLike[])
                  return (
                    <div key={subject.id} className="flex items-center gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-fg truncate text-sm">{subject.name}</p>
                        <p className="text-fg-subtle text-xs">
                          {subject.period ? `${subject.period}º período · ` : ''}
                          {subject.hours} h
                          {!check.unlocked &&
                            ` · falta ${check.missing.map((m) => m.name).join(', ')}`}
                        </p>
                      </div>
                      {check.unlocked ? (
                        <Badge tone="accent">Liberada</Badge>
                      ) : (
                        <Badge>
                          <Lock className="size-3" />
                          Bloqueada
                        </Badge>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <ProgramSchedule
          programId={program.id}
          description="Provas, entregas e eventos deste curso e das suas disciplinas — os mesmos itens da agenda."
        />

        <Card>
          <CardHeader title="Pode cursar agora" description="Pré-requisitos já cumpridos" />
          <CardContent className="pt-2">
            {liberadas.length === 0 ? (
              <p className="text-fg-muted text-sm">
                Nada liberado — conclua os pré-requisitos pendentes.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {liberadas.slice(0, 12).map((subject) => (
                  <span
                    key={subject.id}
                    className="bg-surface-2 border-border-base text-fg-muted rounded-md border px-2 py-1 text-xs"
                  >
                    {subject.name}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {program.complementary_hours_required > 0 && (
          <Card>
            <CardHeader title="Horas complementares" />
            <CardContent className="space-y-2 pt-2">
              <div className="text-fg-muted flex justify-between text-xs">
                <span>
                  {integer(program.complementary_hours_done)} de{' '}
                  {integer(program.complementary_hours_required)} h
                </span>
                <span className="text-fg font-medium">
                  {percent(progresso.complementaryPercent, 0)}
                </span>
              </div>
              <Progress value={progresso.complementaryPercent} />
              <div className="flex gap-2 pt-1">
                {[10, 20, 50].map((horas) => (
                  <Button
                    key={horas}
                    variant="secondary"
                    size="sm"
                    onClick={() => onSomarHorasComplementares(horas)}
                  >
                    +{horas} h
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {progresso.hoursMismatch !== 0 && (
          <Card
            className={progresso.hoursMismatch > 0 ? 'border-warning/40 bg-warning/5' : undefined}
          >
            <CardContent className="py-4">
              <p className="text-fg-muted text-xs leading-relaxed">
                {progresso.hoursMismatch < 0 ? (
                  <>
                    A grade cadastrada soma {integer(progresso.gradeHours)} h das{' '}
                    {integer(program.total_hours)} h do curso — faltam{' '}
                    {integer(Math.abs(progresso.hoursMismatch))} h de disciplinas para cadastrar. O
                    progresso já considera a carga total declarada, então não fica inflado.
                  </>
                ) : (
                  <>
                    A grade cadastrada soma {integer(progresso.gradeHours)} h, acima das{' '}
                    {integer(program.total_hours)} h declaradas no curso. O progresso está usando a
                    soma da grade — vale conferir a carga total no cadastro.
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
