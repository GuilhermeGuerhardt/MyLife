import { describe, expect, it } from 'vitest'
import {
  descreverRemocao,
  descreverSobreviventes,
  planejarRemocaoDePrograma,
  resumirRemocao,
  type DadosDoPrograma,
} from './remocao'

/** Dois cursos lado a lado: o que importa é o vizinho não ser tocado. */
const dados: DadosDoPrograma = {
  subjects: [
    { id: 's1', program_id: 'p1' },
    { id: 's2', program_id: 'p1' },
    { id: 's9', program_id: 'p2' },
  ],
  assessments: [
    { id: 'a1', subject_id: 's1' },
    { id: 'a2', subject_id: 's1' },
    { id: 'a9', subject_id: 's9' },
  ],
  lessons: [
    { id: 'l1', program_id: 'p1' },
    { id: 'l9', program_id: 'p2' },
  ],
  notes: [
    { id: 'n1', program_id: 'p1', subject_id: null },
    { id: 'n2', program_id: 'p1', subject_id: 's1' },
    { id: 'n3', program_id: null, subject_id: null },
    { id: 'n9', program_id: 'p2', subject_id: null },
  ],
  deadlines: [
    { id: 'd1', program_id: 'p1', subject_id: null },
    { id: 'd2', program_id: null, subject_id: 's2' },
    { id: 'd9', program_id: 'p2', subject_id: null },
  ],
}

describe('plano de remoção', () => {
  const plano = planejarRemocaoDePrograma('p1', dados)

  it('leva as disciplinas do curso', () => {
    expect(plano.subjectIds).toEqual(['s1', 's2'])
  })

  it('leva as avaliações pelas disciplinas, não pelo curso', () => {
    expect(plano.assessmentIds).toEqual(['a1', 'a2'])
  })

  it('leva as aulas', () => {
    expect(plano.lessonIds).toEqual(['l1'])
  })

  it('leva o prazo ligado ao curso e o ligado só à disciplina', () => {
    expect(plano.deadlineIds).toEqual(['d1', 'd2'])
  })

  it('não apaga anotação nenhuma — só desvincula', () => {
    expect(plano.notesParaDesvincular).toEqual(['n1', 'n2'])
  })

  it('não toca no curso vizinho', () => {
    const tudo = [
      ...plano.subjectIds,
      ...plano.assessmentIds,
      ...plano.lessonIds,
      ...plano.deadlineIds,
      ...plano.notesParaDesvincular,
    ]
    expect(tudo.filter((id) => id.endsWith('9'))).toEqual([])
  })

  it('curso sem nada dentro não leva nada', () => {
    const vazio = planejarRemocaoDePrograma('inexistente', dados)
    expect(resumirRemocao(vazio)).toEqual({
      disciplinas: 0,
      avaliacoes: 0,
      aulas: 0,
      prazos: 0,
      anotacoes: 0,
    })
  })
})

describe('frase da confirmação', () => {
  it('lista tudo com "e" antes do último', () => {
    expect(
      descreverRemocao({ disciplinas: 2, avaliacoes: 3, aulas: 1, prazos: 4, anotacoes: 0 }),
    ).toBe('Isso apaga também 2 disciplinas, 1 aula, 3 avaliações e 4 compromissos.')
  })

  it('um item só não leva vírgula nem "e"', () => {
    expect(
      descreverRemocao({ disciplinas: 1, avaliacoes: 0, aulas: 0, prazos: 0, anotacoes: 0 }),
    ).toBe('Isso apaga também 1 disciplina.')
  })

  it('curso vazio diz que nada mais sai', () => {
    expect(
      descreverRemocao({ disciplinas: 0, avaliacoes: 0, aulas: 0, prazos: 0, anotacoes: 0 }),
    ).toBe('Nada mais será apagado junto.')
  })

  it('avisa que a anotação sobrevive, no plural certo', () => {
    const base = { disciplinas: 0, avaliacoes: 0, aulas: 0, prazos: 0 }
    expect(descreverSobreviventes({ ...base, anotacoes: 1 })).toContain('Sua anotação não é apagada')
    expect(descreverSobreviventes({ ...base, anotacoes: 4 })).toContain('Suas 4 anotações')
  })

  it('sem anotação, não há segunda linha', () => {
    expect(
      descreverSobreviventes({ disciplinas: 2, avaliacoes: 0, aulas: 0, prazos: 0, anotacoes: 0 }),
    ).toBe('')
  })
})
