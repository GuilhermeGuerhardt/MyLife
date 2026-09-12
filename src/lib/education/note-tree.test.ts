import { describe, expect, it } from 'vitest'
import {
  allFolderKeys,
  allTags,
  buildNoteTree,
  countTreeNotes,
  filterNotes,
  GENERAL_LABEL,
  type NamedLike,
  type NoteLike,
  type SearchableNote,
  type SubjectLike,
} from './note-tree'

const programs: NamedLike[] = [
  { id: 'p1', name: 'Engenharia de Software' },
  { id: 'p2', name: 'Análise e Desenvolvimento' },
]

const subjects: SubjectLike[] = [
  { id: 's1', name: 'Cálculo II', program_id: 'p1' },
  { id: 's2', name: 'Estrutura de Dados', program_id: 'p1' },
  { id: 's3', name: 'Banco de Dados', program_id: 'p2' },
]

function note(over: Partial<NoteLike> & { id: string }): NoteLike {
  return {
    title: 'Anotação',
    program_id: null,
    subject_id: null,
    pinned: false,
    ...over,
  }
}

describe('árvore do caderno', () => {
  it('agrupa por curso e disciplina', () => {
    const tree = buildNoteTree(
      [
        note({ id: 'n1', title: 'Derivadas', program_id: 'p1', subject_id: 's1' }),
        note({ id: 'n2', title: 'Árvores', program_id: 'p1', subject_id: 's2' }),
        note({ id: 'n3', title: 'Normalização', program_id: 'p2', subject_id: 's3' }),
      ],
      programs,
      subjects,
    )

    expect(tree.map((f) => f.label)).toEqual([
      'Análise e Desenvolvimento',
      'Engenharia de Software',
    ])
    const eng = tree.find((f) => f.label === 'Engenharia de Software')!
    expect(eng.children.map((c) => c.label)).toEqual(['Cálculo II', 'Estrutura de Dados'])
    expect(eng.count).toBe(2)
  })

  it('anotação com curso mas sem disciplina fica solta na pasta do curso', () => {
    const tree = buildNoteTree(
      [note({ id: 'n1', title: 'Calendário', program_id: 'p1' })],
      programs,
      subjects,
    )
    const eng = tree[0]!
    expect(eng.notes.map((n) => n.id)).toEqual(['n1'])
    expect(eng.children).toHaveLength(0)
    expect(eng.count).toBe(1)
  })

  it('anotação sem curso vai para Geral, sempre por último', () => {
    const tree = buildNoteTree(
      [
        note({ id: 'n1', title: 'Ideias' }),
        note({ id: 'n2', title: 'Derivadas', program_id: 'p1', subject_id: 's1' }),
      ],
      programs,
      subjects,
    )
    expect(tree.at(-1)!.label).toBe(GENERAL_LABEL)
    expect(tree.at(-1)!.notes.map((n) => n.id)).toEqual(['n1'])
  })

  it('não cria pasta vazia', () => {
    const tree = buildNoteTree(
      [note({ id: 'n1', program_id: 'p1', subject_id: 's1' })],
      programs,
      subjects,
    )
    // p2 e as outras disciplinas não têm anotação: não viram pasta.
    expect(tree).toHaveLength(1)
    expect(tree[0]!.children).toHaveLength(1)
  })

  it('ordena fixadas primeiro e depois por título', () => {
    const tree = buildNoteTree(
      [
        note({ id: 'n1', title: 'Zebra', program_id: 'p1', subject_id: 's1' }),
        note({ id: 'n2', title: 'Abelha', program_id: 'p1', subject_id: 's1' }),
        note({ id: 'n3', title: 'Macaco', program_id: 'p1', subject_id: 's1', pinned: true }),
      ],
      programs,
      subjects,
    )
    expect(tree[0]!.children[0]!.notes.map((n) => n.title)).toEqual([
      'Macaco',
      'Abelha',
      'Zebra',
    ])
  })

  it('conta a pasta do curso somando as subpastas e as soltas', () => {
    const tree = buildNoteTree(
      [
        note({ id: 'n1', program_id: 'p1', subject_id: 's1' }),
        note({ id: 'n2', program_id: 'p1', subject_id: 's2' }),
        note({ id: 'n3', program_id: 'p1' }),
      ],
      programs,
      subjects,
    )
    expect(tree[0]!.count).toBe(3)
    expect(tree[0]!.notes).toHaveLength(1)
  })
})

describe('referências quebradas não somem com a anotação', () => {
  it('curso apagado joga a anotação em Geral', () => {
    const tree = buildNoteTree(
      [note({ id: 'n1', title: 'Órfã', program_id: 'apagado', subject_id: 's1' })],
      programs,
      subjects,
    )
    expect(tree.map((f) => f.label)).toEqual([GENERAL_LABEL])
    expect(tree[0]!.notes.map((n) => n.id)).toEqual(['n1'])
  })

  it('disciplina apagada deixa a anotação solta no curso', () => {
    const tree = buildNoteTree(
      [note({ id: 'n1', program_id: 'p1', subject_id: 'apagada' })],
      programs,
      subjects,
    )
    expect(tree[0]!.label).toBe('Engenharia de Software')
    expect(tree[0]!.notes.map((n) => n.id)).toEqual(['n1'])
    expect(tree[0]!.children).toHaveLength(0)
  })

  it('disciplina de outro curso não sequestra a anotação', () => {
    // s3 é de p2; a anotação diz p1. Fica solta em p1, não vaza para p2.
    const tree = buildNoteTree(
      [note({ id: 'n1', program_id: 'p1', subject_id: 's3' })],
      programs,
      subjects,
    )
    expect(tree).toHaveLength(1)
    expect(tree[0]!.label).toBe('Engenharia de Software')
    expect(tree[0]!.notes.map((n) => n.id)).toEqual(['n1'])
  })

  it('toda anotação aparece em algum lugar da árvore', () => {
    const notes = [
      note({ id: 'n1', program_id: 'p1', subject_id: 's1' }),
      note({ id: 'n2', program_id: 'p1' }),
      note({ id: 'n3' }),
      note({ id: 'n4', program_id: 'sumiu' }),
      note({ id: 'n5', program_id: 'p2', subject_id: 'sumiu' }),
      note({ id: 'n6', program_id: 'p1', subject_id: 's3' }),
    ]
    expect(countTreeNotes(buildNoteTree(notes, programs, subjects))).toBe(notes.length)
  })
})

describe('chaves das pastas', () => {
  it('lista todas, inclusive as subpastas', () => {
    const tree = buildNoteTree(
      [
        note({ id: 'n1', program_id: 'p1', subject_id: 's1' }),
        note({ id: 'n2' }),
      ],
      programs,
      subjects,
    )
    expect(allFolderKeys(tree)).toEqual([
      'program:p1',
      'program:p1/subject:s1',
      'geral',
    ])
  })

  it('a chave da disciplina inclui o curso, para não colidir', () => {
    const tree = buildNoteTree(
      [note({ id: 'n1', program_id: 'p1', subject_id: 's1' })],
      programs,
      subjects,
    )
    expect(tree[0]!.children[0]!.key).toBe('program:p1/subject:s1')
  })

  it('árvore vazia não tem chave nem contagem', () => {
    expect(allFolderKeys([])).toEqual([])
    expect(countTreeNotes([])).toBe(0)
  })
})

function searchable(over: Partial<SearchableNote> & { id: string }): SearchableNote {
  return {
    title: 'Anotação',
    content: '',
    tags: [],
    program_id: null,
    subject_id: null,
    pinned: false,
    created_at: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

describe('filtro da lista', () => {
  const notas = [
    searchable({
      id: 'n1',
      title: 'Derivadas',
      content: 'regra da cadeia',
      tags: ['prova'],
      program_id: 'p1',
      created_at: '2026-01-01T00:00:00.000Z',
    }),
    searchable({
      id: 'n2',
      title: 'Árvores AVL',
      content: 'rotação',
      tags: ['revisão'],
      program_id: 'p1',
      created_at: '2026-02-01T00:00:00.000Z',
    }),
    searchable({
      id: 'n3',
      title: 'Normalização',
      content: 'terceira forma normal',
      program_id: 'p2',
      created_at: '2026-03-01T00:00:00.000Z',
    }),
  ]

  const sem = { search: '', programId: '', tag: null }

  it('sem filtro, a mais recente primeiro', () => {
    expect(filterNotes(notas, sem).map((n) => n.id)).toEqual(['n3', 'n2', 'n1'])
  })

  it('fixadas sobem, mesmo sendo antigas', () => {
    const fixada = notas.map((n) => (n.id === 'n1' ? { ...n, pinned: true } : n))
    expect(filterNotes(fixada, sem).map((n) => n.id)).toEqual(['n1', 'n3', 'n2'])
  })

  it('usa updated_at quando existe', () => {
    const editada = notas.map((n) =>
      n.id === 'n1' ? { ...n, updated_at: '2026-04-01T00:00:00.000Z' } : n,
    )
    expect(filterNotes(editada, sem)[0]!.id).toBe('n1')
  })

  it('a busca ignora acento e caixa, e varre conteúdo e etiqueta', () => {
    expect(filterNotes(notas, { ...sem, search: 'ARVORES' }).map((n) => n.id)).toEqual(['n2'])
    expect(filterNotes(notas, { ...sem, search: 'cadeia' }).map((n) => n.id)).toEqual(['n1'])
    expect(filterNotes(notas, { ...sem, search: 'revisao' }).map((n) => n.id)).toEqual(['n2'])
  })

  it('curso e etiqueta filtram, e combinam com a busca', () => {
    expect(filterNotes(notas, { ...sem, programId: 'p1' }).map((n) => n.id)).toEqual(['n2', 'n1'])
    expect(filterNotes(notas, { ...sem, tag: 'prova' }).map((n) => n.id)).toEqual(['n1'])
    expect(filterNotes(notas, { search: 'derivadas', programId: 'p2', tag: null })).toEqual([])
  })

  it('reúne as etiquetas usadas, sem repetir e em ordem', () => {
    expect(allTags(notas)).toEqual(['prova', 'revisão'])
    expect(allTags([])).toEqual([])
  })
})
