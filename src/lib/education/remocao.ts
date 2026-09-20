/**
 * O que sai junto quando um curso é removido.
 *
 * A tela sempre perguntou "remover e tudo dentro dele?", mas só a linha do
 * curso era apagada. Disciplina, avaliação, aula e prazo continuavam no banco
 * sem dono: invisíveis em tela nenhuma, e ainda assim viajando no backup.
 *
 * Aqui mora a decisão de **o que morre e o que sobrevive**, separada da tela
 * para poder ser testada — apagar em cascata é a operação mais destrutiva do
 * app, e é a última que deveria depender de um clique certo para ser conferida.
 */

export interface ComPrograma {
  id: string
  program_id: string
}

export interface ComDisciplina {
  id: string
  subject_id: string
}

export interface Vinculavel {
  id: string
  program_id: string | null
  subject_id: string | null
}

export interface DadosDoPrograma {
  subjects: ComPrograma[]
  assessments: ComDisciplina[]
  lessons: ComPrograma[]
  /** Anotações: sobrevivem, só perdem o vínculo. */
  notes: Vinculavel[]
  deadlines: Vinculavel[]
}

export interface PlanoDeRemocao {
  subjectIds: string[]
  assessmentIds: string[]
  lessonIds: string[]
  deadlineIds: string[]
  /**
   * Anotações que ficam, com o vínculo a zerar.
   *
   * São o texto que a pessoa escreveu — a coisa menos reproduzível do app.
   * Apagar o caderno de alguém porque o curso acabou seria destruir o motivo
   * de ter feito o curso. Sem curso, elas caem no trilho de estudo livre.
   */
  notesParaDesvincular: string[]
}

/** Quantos registros cada categoria perde — é o que a pergunta mostra. */
export interface ResumoDaRemocao {
  disciplinas: number
  avaliacoes: number
  aulas: number
  prazos: number
  anotacoes: number
}

/**
 * Monta o plano sem executar nada.
 *
 * Separar o "o que vai acontecer" do "faça" é o que permite mostrar os números
 * na confirmação: ninguém deveria apagar 21 disciplinas achando que apaga uma
 * linha.
 */
export function planejarRemocaoDePrograma(
  programId: string,
  dados: DadosDoPrograma,
): PlanoDeRemocao {
  const subjectIds = dados.subjects.filter((s) => s.program_id === programId).map((s) => s.id)
  const doPrograma = new Set(subjectIds)

  return {
    subjectIds,
    assessmentIds: dados.assessments
      .filter((a) => doPrograma.has(a.subject_id))
      .map((a) => a.id),
    lessonIds: dados.lessons.filter((l) => l.program_id === programId).map((l) => l.id),
    // O prazo existe por causa do curso: "Prova 2 de Redes" sem Redes é ruído
    // na agenda, não memória.
    deadlineIds: dados.deadlines
      .filter((d) => d.program_id === programId || (d.subject_id && doPrograma.has(d.subject_id)))
      .map((d) => d.id),
    notesParaDesvincular: dados.notes
      .filter((n) => n.program_id === programId || (n.subject_id && doPrograma.has(n.subject_id)))
      .map((n) => n.id),
  }
}

export function resumirRemocao(plano: PlanoDeRemocao): ResumoDaRemocao {
  return {
    disciplinas: plano.subjectIds.length,
    avaliacoes: plano.assessmentIds.length,
    aulas: plano.lessonIds.length,
    prazos: plano.deadlineIds.length,
    anotacoes: plano.notesParaDesvincular.length,
  }
}

/**
 * A frase da confirmação, já no plural certo.
 *
 * Mostra o que morre e, separado, o que sobrevive — porque "suas anotações
 * continuam" é justamente a informação que decide se a pessoa clica ou desiste.
 */
export function descreverRemocao(resumo: ResumoDaRemocao): string {
  const partes: string[] = []
  const conta = (n: number, um: string, varios: string) => {
    if (n > 0) partes.push(`${n} ${n === 1 ? um : varios}`)
  }

  conta(resumo.disciplinas, 'disciplina', 'disciplinas')
  conta(resumo.aulas, 'aula', 'aulas')
  conta(resumo.avaliacoes, 'avaliação', 'avaliações')
  conta(resumo.prazos, 'compromisso', 'compromissos')

  if (partes.length === 0) return 'Nada mais será apagado junto.'

  const lista =
    partes.length === 1
      ? partes[0]!
      : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]!}`

  return `Isso apaga também ${lista}.`
}

/** A segunda linha: o que fica. Vazia quando não há anotação envolvida. */
export function descreverSobreviventes(resumo: ResumoDaRemocao): string {
  if (resumo.anotacoes === 0) return ''
  const n = resumo.anotacoes
  return n === 1
    ? 'Sua anotação não é apagada — ela passa para Estudos.'
    : `Suas ${n} anotações não são apagadas — elas passam para Estudos.`
}
