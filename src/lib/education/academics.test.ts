import { describe, expect, it } from 'vitest'
import {
  academicIndex,
  attendance,
  availableNext,
  checkPrerequisites,
  gradeSummary,
  neededGrade,
  programProgress,
  type SubjectLike,
} from './academics'

const subject = (over: Partial<SubjectLike> & { id: string }): SubjectLike => ({
  name: over.id,
  hours: 60,
  credits: 4,
  period: 1,
  status: 'pending',
  grade: null,
  absences: 0,
  total_classes: null,
  prerequisites: [],
  ...over,
})

const program = {
  total_hours: 3000,
  complementary_hours_required: 200,
  complementary_hours_done: 50,
}

describe('progresso do curso', () => {
  it('mede progresso por carga horária, não por contagem de disciplinas', () => {
    const subjects = [
      subject({ id: 'a', hours: 80, status: 'done' }),
      subject({ id: 'b', hours: 20, status: 'done' }),
      subject({ id: 'c', hours: 60, status: 'doing' }),
      subject({ id: 'd', hours: 60, status: 'pending' }),
    ]
    const result = programProgress(subjects, { ...program, total_hours: 400 })
    expect(result.hoursDone).toBe(100)
    expect(result.hoursEnrolled).toBe(60)
    // (100 concluídas + 50 complementares) / (400 + 200)
    expect(result.percent).toBe(25)
  })

  it('conta dispensadas como carga cumprida', () => {
    const subjects = [subject({ id: 'a', hours: 60, status: 'exempted' })]
    const result = programProgress(subjects, {
      total_hours: 60,
      complementary_hours_required: 0,
      complementary_hours_done: 0,
    })
    expect(result.hoursDone).toBe(60)
    expect(result.percent).toBe(100)
  })

  it('usa a soma da grade quando ela passa da carga declarada', () => {
    const subjects = [subject({ id: 'a', hours: 500, status: 'done' })]
    const result = programProgress(subjects, {
      total_hours: 100,
      complementary_hours_required: 0,
      complementary_hours_done: 0,
    })
    expect(result.hoursTotal).toBe(500)
    expect(result.gradeHours).toBe(500)
    expect(result.hoursMismatch).toBe(400)
  })

  it('sinaliza grade incompleta sem inflar o progresso', () => {
    const subjects = [subject({ id: 'a', hours: 200, status: 'done' })]
    const result = programProgress(subjects, {
      total_hours: 600,
      complementary_hours_required: 0,
      complementary_hours_done: 0,
    })
    // Só 200 h cadastradas de 600 h declaradas.
    expect(result.gradeHours).toBe(200)
    expect(result.hoursTotal).toBe(600)
    expect(result.hoursMismatch).toBe(-400)
    // O progresso usa o total declarado, não o que já foi cadastrado.
    expect(result.percent).toBe(33.3)
  })

  it('lista reprovadas junto com as pendentes no que falta', () => {
    const subjects = [
      subject({ id: 'a', status: 'failed' }),
      subject({ id: 'b', status: 'done' }),
      subject({ id: 'c', status: 'pending' }),
    ]
    const result = programProgress(subjects, program)
    expect(result.remaining.map((s) => s.id)).toEqual(['a', 'c'])
  })
})

describe('pré-requisitos', () => {
  const subjects = [
    subject({ id: 'calc1', status: 'done' }),
    subject({ id: 'calc2', prerequisites: ['calc1'] }),
    subject({ id: 'calc3', prerequisites: ['calc2'] }),
  ]

  it('libera quando o pré-requisito está concluído', () => {
    expect(checkPrerequisites(subjects[1]!, subjects).unlocked).toBe(true)
  })

  it('bloqueia e informa o que falta', () => {
    const check = checkPrerequisites(subjects[2]!, subjects)
    expect(check.unlocked).toBe(false)
    expect(check.missing.map((s) => s.id)).toEqual(['calc2'])
  })

  it('lista só o que dá para cursar agora, na ordem do período', () => {
    const next = availableNext([
      subject({ id: 'calc1', status: 'done' }),
      subject({ id: 'calc3', period: 3, prerequisites: ['calc2'] }),
      subject({ id: 'calc2', period: 2, prerequisites: ['calc1'] }),
    ])
    expect(next.map((s) => s.id)).toEqual(['calc2'])
  })
})

describe('faltas', () => {
  it('calcula o limite de 25% e quantas ainda restam', () => {
    const result = attendance(80, 12)
    expect(result.maxAbsences).toBe(20)
    expect(result.remaining).toBe(8)
    expect(result.status).toBe('ok')
  })

  it('avisa quando está no limite', () => {
    expect(attendance(80, 19).status).toBe('warning')
  })

  it('marca reprovação por falta', () => {
    const result = attendance(80, 21)
    expect(result.status).toBe('failed')
    expect(result.remaining).toBe(0)
  })

  it('não quebra sem total de aulas cadastrado', () => {
    expect(attendance(0, 3).maxAbsences).toBe(0)
  })
})

describe('notas', () => {
  const assessments = [
    { id: '1', name: 'P1', weight: 40, grade: 7 },
    { id: '2', name: 'Trabalho', weight: 20, grade: 9 },
    { id: '3', name: 'P2', weight: 40, grade: null },
  ]

  it('calcula média parcial só com o que já foi avaliado', () => {
    const summary = gradeSummary(assessments)
    // (7*40 + 9*20) / 60
    expect(summary.partialAverage).toBe(7.67)
    expect(summary.remainingWeight).toBe(40)
  })

  it('diz quanto falta tirar para passar', () => {
    const result = neededGrade(assessments, 6)
    expect(result.status).toBe('possible')
    // (6*100 - 460) / 40
    expect(result.needed).toBe(3.5)
  })

  it('reconhece aprovação já garantida', () => {
    const result = neededGrade(
      [
        { id: '1', name: 'P1', weight: 50, grade: 10 },
        { id: '2', name: 'P2', weight: 50, grade: null },
      ],
      4,
    )
    expect(result.status).toBe('already_passed')
  })

  it('reconhece quando não dá mais para passar', () => {
    const result = neededGrade(
      [
        { id: '1', name: 'P1', weight: 80, grade: 2 },
        { id: '2', name: 'P2', weight: 20, grade: null },
      ],
      6,
    )
    expect(result.status).toBe('impossible')
    expect(result.maxPossible).toBe(3.6)
  })

  it('fecha a média quando não há mais avaliações pendentes', () => {
    const result = neededGrade([{ id: '1', name: 'P1', weight: 100, grade: 8 }], 6)
    expect(result.status).toBe('nothing_left')
    expect(result.maxPossible).toBe(8)
  })

  it('calcula o CR ponderado por créditos, ignorando dispensadas', () => {
    const index = academicIndex([
      subject({ id: 'a', credits: 4, grade: 8, status: 'done' }),
      subject({ id: 'b', credits: 2, grade: 5, status: 'failed' }),
      subject({ id: 'c', credits: 4, grade: null, status: 'exempted' }),
    ])
    // (8*4 + 5*2) / 6
    expect(index).toBe(7)
  })

  it('devolve null quando não há nota lançada', () => {
    expect(academicIndex([subject({ id: 'a' })])).toBeNull()
  })
})
