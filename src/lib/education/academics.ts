/**
 * Cálculos acadêmicos.
 *
 * Funções puras, sem React nem banco: progresso do curso, pré-requisitos,
 * limite de faltas, média ponderada e simulador de nota.
 */

export type SubjectStatus = 'pending' | 'doing' | 'done' | 'exempted' | 'failed'

export const SUBJECT_STATUS_LABELS: Record<SubjectStatus, string> = {
  pending: 'Pendente',
  doing: 'Cursando',
  done: 'Concluída',
  exempted: 'Dispensada',
  failed: 'Reprovada',
}

/** Disciplina dispensada conta carga horária, mas não entra na média. */
export const COMPLETED_STATUSES: SubjectStatus[] = ['done', 'exempted']

export interface SubjectLike {
  id: string
  name: string
  hours: number
  credits: number
  period: number | null
  status: SubjectStatus
  grade: number | null
  absences: number
  total_classes: number | null
  prerequisites: string[]
}

export interface ProgramLike {
  total_hours: number
  complementary_hours_required: number
  complementary_hours_done: number
}

export interface ProgramProgress {
  hoursDone: number
  hoursEnrolled: number
  hoursRemaining: number
  hoursTotal: number
  percent: number
  counts: Record<SubjectStatus, number>
  /** Disciplinas que ainda faltam cursar (pendentes + reprovadas). */
  remaining: SubjectLike[]
  complementaryPercent: number
  /** Soma da carga horária das disciplinas efetivamente cadastradas. */
  gradeHours: number
  /**
   * Diferença entre a grade cadastrada e a carga declarada no curso.
   * Negativo = faltam disciplinas para cadastrar; positivo = a grade passou
   * do que o curso declara.
   */
  hoursMismatch: number
}

/**
 * Progresso do curso pela carga horária, não pela contagem de disciplinas —
 * uma matéria de 80 h não vale o mesmo que uma de 30 h.
 *
 * A carga total considerada é a declarada no curso quando ela existe; se a
 * grade cadastrada somar mais que isso, vale a soma da grade (o declarado
 * estava desatualizado).
 */
export function programProgress(subjects: SubjectLike[], program: ProgramLike): ProgramProgress {
  const counts: Record<SubjectStatus, number> = {
    pending: 0,
    doing: 0,
    done: 0,
    exempted: 0,
    failed: 0,
  }

  let hoursDone = 0
  let hoursEnrolled = 0
  let gradeHours = 0

  for (const subject of subjects) {
    counts[subject.status]++
    gradeHours += subject.hours
    if (COMPLETED_STATUSES.includes(subject.status)) hoursDone += subject.hours
    if (subject.status === 'doing') hoursEnrolled += subject.hours
  }

  const declared = program.total_hours || 0
  const hoursTotal = Math.max(declared, gradeHours)
  const complementaryDone = Math.min(
    program.complementary_hours_done,
    program.complementary_hours_required,
  )

  const totalWithComplementary = hoursTotal + program.complementary_hours_required
  const doneWithComplementary = hoursDone + complementaryDone

  return {
    hoursDone,
    hoursEnrolled,
    hoursRemaining: Math.max(hoursTotal - hoursDone, 0),
    hoursTotal,
    percent:
      totalWithComplementary > 0
        ? round((doneWithComplementary / totalWithComplementary) * 100, 1)
        : 0,
    counts,
    remaining: subjects.filter((s) => s.status === 'pending' || s.status === 'failed'),
    complementaryPercent:
      program.complementary_hours_required > 0
        ? round((complementaryDone / program.complementary_hours_required) * 100, 1)
        : 100,
    gradeHours,
    hoursMismatch: declared > 0 ? gradeHours - declared : 0,
  }
}

export interface PrerequisiteCheck {
  unlocked: boolean
  missing: SubjectLike[]
}

/** Uma disciplina está liberada quando todos os pré-requisitos foram concluídos. */
export function checkPrerequisites(
  subject: SubjectLike,
  allSubjects: SubjectLike[],
): PrerequisiteCheck {
  if (!subject.prerequisites.length) return { unlocked: true, missing: [] }

  const byId = new Map(allSubjects.map((s) => [s.id, s]))
  const missing = subject.prerequisites
    .map((id) => byId.get(id))
    .filter((s): s is SubjectLike => Boolean(s) && !COMPLETED_STATUSES.includes(s!.status))

  return { unlocked: missing.length === 0, missing }
}

/** Disciplinas pendentes cujos pré-requisitos já foram cumpridos. */
export function availableNext(subjects: SubjectLike[]): SubjectLike[] {
  return subjects
    .filter((s) => s.status === 'pending' || s.status === 'failed')
    .filter((s) => checkPrerequisites(s, subjects).unlocked)
    .sort((a, b) => (a.period ?? 99) - (b.period ?? 99))
}

export interface Attendance {
  /** Máximo de faltas permitido (25% da carga de aulas). */
  maxAbsences: number
  used: number
  remaining: number
  percent: number
  status: 'ok' | 'warning' | 'failed'
}

/**
 * Frequência mínima de 75% — a regra da LDB seguida pela maioria das
 * instituições. Devolve quantas aulas ainda dá para perder.
 */
export function attendance(totalClasses: number, absences: number, minAttendance = 0.75): Attendance {
  if (!totalClasses || totalClasses <= 0) {
    return { maxAbsences: 0, used: absences, remaining: 0, percent: 0, status: 'ok' }
  }
  const maxAbsences = Math.floor(totalClasses * (1 - minAttendance))
  const remaining = maxAbsences - absences
  const percent = round((absences / totalClasses) * 100, 1)

  return {
    maxAbsences,
    used: absences,
    remaining: Math.max(remaining, 0),
    percent,
    status: remaining < 0 ? 'failed' : remaining <= 1 ? 'warning' : 'ok',
  }
}

export interface AssessmentLike {
  id: string
  name: string
  weight: number
  grade: number | null
}

export interface GradeSummary {
  /** Média considerando só o que já foi avaliado. */
  partialAverage: number | null
  /** Nota acumulada no curso da disciplina inteira (o que ainda não saiu vale 0). */
  earnedPoints: number
  gradedWeight: number
  remainingWeight: number
  totalWeight: number
}

export function gradeSummary(assessments: AssessmentLike[]): GradeSummary {
  let earnedPoints = 0
  let gradedWeight = 0
  let totalWeight = 0

  for (const item of assessments) {
    totalWeight += item.weight
    if (item.grade !== null) {
      earnedPoints += item.grade * item.weight
      gradedWeight += item.weight
    }
  }

  return {
    partialAverage: gradedWeight > 0 ? round(earnedPoints / gradedWeight, 2) : null,
    earnedPoints,
    gradedWeight,
    remainingWeight: totalWeight - gradedWeight,
    totalWeight,
  }
}

export type NeededGradeStatus =
  | 'already_passed'
  | 'possible'
  | 'impossible'
  | 'nothing_left'
  | 'no_assessments'

export interface NeededGrade {
  status: NeededGradeStatus
  /** Nota média necessária nas avaliações que faltam. */
  needed: number
  maxPossible: number
  message: string
}

/**
 * Quanto falta tirar para passar.
 *
 * Responde as duas perguntas que importam antes de uma prova final: "quanto eu
 * preciso?" e "ainda dá?".
 */
export function neededGrade(
  assessments: AssessmentLike[],
  passingGrade = 6,
  maxGrade = 10,
): NeededGrade {
  const summary = gradeSummary(assessments)

  if (summary.totalWeight === 0) {
    return {
      status: 'no_assessments',
      needed: 0,
      maxPossible: 0,
      message: 'Cadastre as avaliações e seus pesos para simular a nota.',
    }
  }

  const target = passingGrade * summary.totalWeight
  const maxPossible = round(
    (summary.earnedPoints + maxGrade * summary.remainingWeight) / summary.totalWeight,
    2,
  )

  if (summary.remainingWeight === 0) {
    const final = round(summary.earnedPoints / summary.totalWeight, 2)
    return {
      status: 'nothing_left',
      needed: 0,
      maxPossible: final,
      message:
        final >= passingGrade
          ? `Todas as avaliações lançadas. Média final: ${fmt(final)} — aprovado.`
          : `Todas as avaliações lançadas. Média final: ${fmt(final)} — abaixo de ${fmt(passingGrade)}.`,
    }
  }

  const needed = round((target - summary.earnedPoints) / summary.remainingWeight, 2)

  if (needed <= 0) {
    return {
      status: 'already_passed',
      needed: 0,
      maxPossible,
      message: `Você já garantiu a aprovação: mesmo zerando o que falta, a média fica em ${fmt(round(summary.earnedPoints / summary.totalWeight, 2))}.`,
    }
  }

  if (needed > maxGrade) {
    return {
      status: 'impossible',
      needed,
      maxPossible,
      message: `Não dá mais para chegar em ${fmt(passingGrade)}: mesmo tirando ${fmt(maxGrade)} no que falta, a média máxima é ${fmt(maxPossible)}.`,
    }
  }

  return {
    status: 'possible',
    needed,
    maxPossible,
    message: `Precisa de ${fmt(needed)} no que falta (peso ${fmtWeight(summary.remainingWeight)}) para fechar em ${fmt(passingGrade)}.`,
  }
}

/**
 * Coeficiente de rendimento: média das notas ponderada pelos créditos.
 * Dispensadas ficam de fora — têm carga horária, mas não têm nota.
 */
export function academicIndex(subjects: SubjectLike[]): number | null {
  let points = 0
  let credits = 0

  for (const subject of subjects) {
    if (subject.grade === null) continue
    if (subject.status !== 'done' && subject.status !== 'failed') continue
    const weight = subject.credits || 1
    points += subject.grade * weight
    credits += weight
  }

  return credits > 0 ? round(points / credits, 2) : null
}

/** Previsão de conclusão pelo ritmo de carga horária por semestre. */
export function estimateRemainingTerms(
  hoursRemaining: number,
  hoursPerTerm: number,
): number | null {
  if (hoursPerTerm <= 0) return null
  return Math.ceil(hoursRemaining / hoursPerTerm)
}

/** Notas sempre com uma casa: "6,0" lê como nota, "6" lê como contagem. */
function fmt(value: number): string {
  return value.toFixed(1).replace('.', ',')
}

/** Pesos costumam ser inteiros — não faz sentido exibir "40,0". */
function fmtWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',')
}

export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
