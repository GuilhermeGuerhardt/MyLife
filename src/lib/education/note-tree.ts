/**
 * Árvore de pastas do caderno.
 *
 * As pastas não existem no banco: são derivadas do curso e da disciplina que a
 * anotação já guarda. Trocar o curso no editor move a anotação de pasta sozinho,
 * e nenhuma estrutura precisa ser mantida em paralelo — que é a parte que
 * costuma apodrecer em organização por pastas.
 */

import { normalize } from '@/lib/quick-add/parser'

export interface NoteLike {
  id: string
  title: string
  program_id: string | null
  subject_id: string | null
  pinned: boolean
}

export interface NamedLike {
  id: string
  name: string
}

export interface SubjectLike extends NamedLike {
  program_id: string
}

export interface TreeFolder {
  /** Chave estável — é por ela que se lembra o que está aberto. */
  key: string
  label: string
  /** Anotações soltas nesta pasta, fora das subpastas. */
  notes: NoteLike[]
  children: TreeFolder[]
  /** Total da pasta incluindo as subpastas. */
  count: number
}

/** Pasta das anotações sem curso — o mesmo rótulo que o editor usa. */
export const GENERAL_KEY = 'geral'
export const GENERAL_LABEL = 'Geral'

export function programKey(programId: string): string {
  return `program:${programId}`
}

export function subjectKey(programId: string, subjectId: string): string {
  return `program:${programId}/subject:${subjectId}`
}

/** Fixadas no topo; depois em ordem alfabética, que é como se procura em pasta. */
function sortNotes(notes: NoteLike[]): NoteLike[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return (a.title || 'Sem título').localeCompare(b.title || 'Sem título', 'pt-BR')
  })
}

/**
 * Monta a árvore a partir das anotações.
 *
 * Só entram pastas com conteúdo: uma disciplina em que nunca se anotou nada
 * viraria uma linha vazia para percorrer.
 *
 * Referência quebrada não engole anotação. Se o curso foi apagado e o
 * `program_id` aponta para o nada, a anotação cai em "Geral" em vez de sumir da
 * árvore; se a disciplina não resolve — ou pertence a outro curso —, ela fica
 * solta na pasta do curso. Uma anotação invisível é pior que uma malposicionada.
 */
export function buildNoteTree(
  notes: NoteLike[],
  programs: NamedLike[],
  subjects: SubjectLike[],
): TreeFolder[] {
  const programById = new Map(programs.map((p) => [p.id, p]))
  const subjectById = new Map(subjects.map((s) => [s.id, s]))

  const general: NoteLike[] = []
  /** programId -> { soltas, porDisciplina } */
  const byProgram = new Map<string, { loose: NoteLike[]; bySubject: Map<string, NoteLike[]> }>()

  for (const note of notes) {
    const program = note.program_id ? programById.get(note.program_id) : undefined
    if (!program) {
      general.push(note)
      continue
    }

    let bucket = byProgram.get(program.id)
    if (!bucket) {
      bucket = { loose: [], bySubject: new Map() }
      byProgram.set(program.id, bucket)
    }

    const subject = note.subject_id ? subjectById.get(note.subject_id) : undefined
    if (!subject || subject.program_id !== program.id) {
      bucket.loose.push(note)
      continue
    }

    const list = bucket.bySubject.get(subject.id)
    if (list) list.push(note)
    else bucket.bySubject.set(subject.id, [note])
  }

  const folders: TreeFolder[] = []

  for (const [programId, bucket] of byProgram) {
    const program = programById.get(programId)!

    const children: TreeFolder[] = []
    for (const [subjectId, list] of bucket.bySubject) {
      const subject = subjectById.get(subjectId)!
      children.push({
        key: subjectKey(programId, subjectId),
        label: subject.name,
        notes: sortNotes(list),
        children: [],
        count: list.length,
      })
    }
    children.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))

    folders.push({
      key: programKey(programId),
      label: program.name,
      notes: sortNotes(bucket.loose),
      children,
      count: bucket.loose.length + children.reduce((sum, child) => sum + child.count, 0),
    })
  }

  folders.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))

  // "Geral" fica por último: é o que sobrou, não um curso.
  if (general.length > 0) {
    folders.push({
      key: GENERAL_KEY,
      label: GENERAL_LABEL,
      notes: sortNotes(general),
      children: [],
      count: general.length,
    })
  }

  return folders
}

/** Todas as chaves da árvore — usada para abrir tudo de uma vez. */
export function allFolderKeys(folders: TreeFolder[]): string[] {
  return folders.flatMap((folder) => [folder.key, ...allFolderKeys(folder.children)])
}

/** Quantas anotações a árvore contém no total. */
export function countTreeNotes(folders: TreeFolder[]): number {
  return folders.reduce((sum, folder) => sum + folder.count, 0)
}

/** O que a busca do caderno precisa ler de uma anotação. */
export interface SearchableNote extends NoteLike {
  content: string
  tags: string[]
  created_at: string
  updated_at?: string | null
}

export interface NoteFilters {
  /** Termo livre: varre título, conteúdo e etiquetas. */
  search: string
  /** Vazio = todos os cursos. */
  programId: string
  /** Nulo = todas as etiquetas. */
  tag: string | null
}

/**
 * Aplica os filtros da lista e ordena: fixadas no topo, depois da mais recente
 * para a mais antiga — que é a ordem em que se procura o que se escreveu.
 */
export function filterNotes<T extends SearchableNote>(notes: T[], filters: NoteFilters): T[] {
  const term = normalize(filters.search)
  return notes
    .filter((note) => !filters.programId || note.program_id === filters.programId)
    .filter((note) => !filters.tag || note.tags.includes(filters.tag))
    .filter(
      (note) =>
        !term ||
        normalize(note.title).includes(term) ||
        normalize(note.content).includes(term) ||
        note.tags.some((tag) => normalize(tag).includes(term)),
    )
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at)
    })
}

/** Todas as etiquetas usadas, em ordem alfabética. */
export function allTags(notes: SearchableNote[]): string[] {
  return [...new Set(notes.flatMap((note) => note.tags))].sort((a, b) => a.localeCompare(b))
}

/** A anotação com o trilho, para a árvore poder agrupar por ele. */
export interface TrackedNote extends SearchableNote {
  track: 'academic' | 'course' | 'free'
}

export const TRACK_FOLDER_PREFIX = 'track:'

export function trackKey(track: string): string {
  return `${TRACK_FOLDER_PREFIX}${track}`
}

/**
 * A árvore do caderno reunido: um nível a mais no topo, com Faculdade, Cursos
 * e Estudos, e a árvore de cada trilho pendurada abaixo.
 *
 * Existe porque os dois cadernos viraram um. O curso desceu um degrau, e o
 * estudo livre — que não tem curso nenhum — ganhou onde morar em vez de cair
 * numa pasta "Geral" dividida com as sobras da faculdade.
 */
export function buildTrackTree(
  notes: TrackedNote[],
  programs: NamedLike[],
  subjects: SubjectLike[],
  ordem: Array<{ track: string; label: string }>,
): TreeFolder[] {
  const folders: TreeFolder[] = []

  for (const { track, label } of ordem) {
    const doTrack = notes.filter((note) => note.track === track)
    if (doTrack.length === 0) continue

    // Estudo livre não tem curso: uma pasta "Geral" dentro de "Estudos" seria
    // um degrau sem informação nenhuma. As anotações ficam direto no trilho.
    const children = track === 'free' ? [] : buildNoteTree(doTrack, programs, subjects)
    const soltas = track === 'free' ? doTrack : []

    folders.push({
      key: trackKey(track),
      label,
      notes: soltas,
      children,
      count: doTrack.length,
    })
  }

  return folders
}
