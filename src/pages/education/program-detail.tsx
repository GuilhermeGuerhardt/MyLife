/**
 * O curso da faculdade, por dentro.
 *
 * Três leituras do mesmo curso — o que falta, a grade inteira e o semestre que
 * está correndo — e esta tela escolhe entre elas. Cada aba mora em
 * `features/education/program`; aqui ficam os dados, o cabeçalho e os
 * formulários.
 */

import { ArrowLeft, NotebookPen, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge, EmptyState, Segmented } from '@/components/ui/misc'
import { PageHeader } from '@/components/ui/page-header'
import { useInstitutions, useNotes, usePrograms, useSubjects } from '@/data/queries'
import { DEGREE_LABELS, type Subject } from '@/data/types'
import { CertificateThumb } from '@/features/education/certificate'
import { BotaoEstudar } from '@/features/education/cronometro/botao-estudar'
import { TempoDeEstudo } from '@/features/education/cronometro/tempo-de-estudo'
import { GradeCurricular } from '@/features/education/program/grade-curricular'
import { NumerosDoCurso } from '@/features/education/program/numeros-do-curso'
import { SemestreAtual } from '@/features/education/program/semestre-atual'
import { VisaoGeralDoCurso } from '@/features/education/program/visao-geral-do-curso'
import { ProgramForm } from '@/features/education/program-form'
import { SubjectForm } from '@/features/education/subject-form'
import { useRemoveProgram } from '@/features/education/use-remove-program'
import {
  academicIndex,
  availableNext,
  estimateRemainingTerms,
  programProgress,
  type SubjectLike,
} from '@/lib/education/academics'
import { ehImagem } from '@/lib/education/certificate'

type Tab = 'overview' | 'curriculum' | 'term' | 'study'

export function ProgramDetail() {
  const { programId } = useParams<{ programId: string }>()
  const { data: programs, update: updateProgram } = usePrograms()
  const { data: allSubjects, create, update, remove } = useSubjects()
  const { data: institutions, create: createInstitution } = useInstitutions()
  const { data: notes } = useNotes()
  const navigate = useNavigate()
  const removerPrograma = useRemoveProgram()

  const [tab, setTab] = useState<Tab>('overview')
  const [editing, setEditing] = useState(false)
  const [subjectForm, setSubjectForm] = useState<{ subject?: Subject; period?: number } | null>(null)

  const program = programs.find((p) => p.id === programId)
  const subjects = useMemo(
    () => allSubjects.filter((s) => s.program_id === programId),
    [allSubjects, programId],
  )

  const progress = useMemo(
    () => (program ? programProgress(subjects as SubjectLike[], program) : null),
    [subjects, program],
  )

  if (!program || !progress) {
    return (
      <Card>
        <EmptyState
          title="Curso não encontrado"
          description="Ele pode ter sido removido."
          action={
            <Link to="/faculdade">
              <Button size="sm">Voltar</Button>
            </Link>
          }
        />
      </Card>
    )
  }

  const institution = institutions.find((i) => i.id === program.institution_id)
  const doing = subjects.filter((s) => s.status === 'doing')
  const programNotes = notes.filter((n) => n.program_id === program.id)

  // Ritmo médio: carga cumprida dividida pelos semestres já cursados.
  const termsDone = Math.max((program.current_term ?? 1) - 1, 1)
  const hoursPerTerm = progress.hoursDone > 0 ? progress.hoursDone / termsDone : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/faculdade"
            className="text-fg-subtle hover:text-fg mb-2 inline-flex items-center gap-1.5 text-xs transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Faculdade
          </Link>
          <PageHeader
            title={program.name}
            description={
              <>
                {institution?.name ?? 'Sem instituição'} · {DEGREE_LABELS[program.degree]}
                {program.current_term ? ` · ${program.current_term}º semestre` : ''}
              </>
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <BotaoEstudar
            alvo={{ program_id: program.id, subject_id: null, rotulo: program.name }}
            size="md"
          />
          {ehImagem(program.certificate_url) && (
            <CertificateThumb
              imagem={program.certificate_url}
              pdf={program.certificate_pdf}
              title={program.name}
              className="size-11"
            />
          )}
          <Link to="/faculdade/caderno">
            <Button variant="secondary">
              <NotebookPen />
              Caderno
              {programNotes.length > 0 && <Badge>{programNotes.length}</Badge>}
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditing(true)}
            aria-label="Editar curso"
          >
            <Pencil />
          </Button>
          {/* Também aqui, e não só na lista: quem decide largar um curso
              costuma estar olhando para ele, não para a lista de todos. */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              void removerPrograma(program).then((removeu) => {
                if (removeu) navigate('/faculdade')
              })
            }}
            aria-label="Remover curso"
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <NumerosDoCurso
        progresso={progress}
        coeficiente={academicIndex(subjects as SubjectLike[])}
        semestresRestantes={estimateRemainingTerms(progress.hoursRemaining, hoursPerTerm)}
        horasPorSemestre={hoursPerTerm}
      />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'overview', label: 'Visão geral' },
          { value: 'curriculum', label: `Grade (${subjects.length})` },
          { value: 'term', label: `Semestre atual (${doing.length})` },
          { value: 'study', label: 'Estudo' },
        ]}
      />

      {tab === 'overview' && (
        <VisaoGeralDoCurso
          program={program}
          subjects={subjects}
          progresso={progress}
          liberadas={availableNext(subjects as SubjectLike[])}
          onSomarHorasComplementares={(horas) =>
            updateProgram.mutate({
              id: program.id,
              patch: { complementary_hours_done: program.complementary_hours_done + horas },
            })
          }
        />
      )}

      {tab === 'curriculum' && (
        <GradeCurricular
          subjects={subjects}
          onNova={(periodo) => setSubjectForm(periodo ? { period: periodo } : {})}
          onEditar={(subject) => setSubjectForm({ subject })}
          onRemover={(id) => remove.mutate(id)}
          onTrocarSituacao={(id, status) => update.mutate({ id, patch: { status } })}
        />
      )}

      {tab === 'term' && (
        <SemestreAtual
          cursando={doing}
          notaDeAprovacao={program.passing_grade}
          onAbrirGrade={() => setTab('curriculum')}
        />
      )}

      {tab === 'study' && <TempoDeEstudo programId={program.id} disciplinas={subjects} />}

      {editing && (
        <ProgramForm
          track="academic"
          institutions={institutions.filter((i) => i.track === 'academic')}
          initial={program}
          onClose={() => setEditing(false)}
          onCreateInstitution={(name) =>
            createInstitution.mutateAsync({ name, track: 'academic', link: null })
          }
          onSave={async (values) => {
            await updateProgram.mutateAsync({ id: program.id, patch: values })
            setEditing(false)
          }}
        />
      )}

      {subjectForm && (
        <SubjectForm
          programId={program.id}
          siblings={subjects}
          initial={subjectForm.subject}
          defaultPeriod={subjectForm.period}
          onClose={() => setSubjectForm(null)}
          onSave={async (values) => {
            if (subjectForm.subject) {
              await update.mutateAsync({ id: subjectForm.subject.id, patch: values })
            } else {
              await create.mutateAsync(values)
            }
            setSubjectForm(null)
          }}
        />
      )}
    </div>
  )
}
