/**
 * Remover um curso, de verdade.
 *
 * A tela prometia "e tudo dentro dele" e apagava só a linha do curso — o resto
 * virava registro sem dono, invisível em tela nenhuma e ainda assim carregado
 * no backup. Aqui a promessa passa a ser cumprida.
 *
 * O hook devolve uma função só, usada igual na lista e nas duas telas de
 * detalhe: uma operação destrutiva com três implementações diferentes é uma
 * delas errada esperando a vez.
 */

import {
  useAssessments,
  useCourseLessons,
  useDeadlines,
  useNotes,
  usePrograms,
  useSubjects,
} from '@/data/queries'
import type { Program } from '@/data/types'
import { confirmar } from '@/lib/avisos'
import {
  descreverRemocao,
  descreverSobreviventes,
  planejarRemocaoDePrograma,
  resumirRemocao,
} from '@/lib/education/remocao'

export function useRemoveProgram() {
  const { remove: removePrograma } = usePrograms()
  const { data: subjects, remove: removeDisciplina } = useSubjects()
  const { data: assessments, remove: removeAvaliacao } = useAssessments()
  const { data: lessons, remove: removeAula } = useCourseLessons()
  const { data: deadlines, remove: removePrazo } = useDeadlines()
  const { data: notes, update: atualizarNota } = useNotes()

  /**
   * Pergunta mostrando os números e, confirmado, executa.
   *
   * Devolve `true` quando removeu — a tela de detalhe usa isso para voltar
   * para a lista, já que o curso que ela mostrava deixou de existir.
   */
  return async function removerPrograma(program: Program): Promise<boolean> {
    const plano = planejarRemocaoDePrograma(program.id, {
      subjects,
      assessments,
      lessons,
      notes,
      deadlines,
    })
    const resumo = resumirRemocao(plano)
    const sobreviventes = descreverSobreviventes(resumo)

    const mensagem = [
      `Remover "${program.name}"?`,
      '',
      descreverRemocao(resumo),
      sobreviventes,
      '',
      'Não dá para desfazer.',
    ]
      .filter((linha, i, todas) => linha !== '' || todas[i - 1] !== '')
      .join('\n')

    if (!(await confirmar(mensagem, { confirmar: 'Remover', tom: 'error' }))) return false

    // As filhas primeiro: se algo falhar no meio, o curso continua na tela e a
    // pessoa vê que sobrou coisa, em vez de perder a porta de entrada para o
    // que restou.
    for (const id of plano.assessmentIds) await removeAvaliacao.mutateAsync(id)
    for (const id of plano.subjectIds) await removeDisciplina.mutateAsync(id)
    for (const id of plano.lessonIds) await removeAula.mutateAsync(id)
    for (const id of plano.deadlineIds) await removePrazo.mutateAsync(id)

    // A anotação fica: sem curso, ela passa para o trilho de estudo livre.
    for (const id of plano.notesParaDesvincular) {
      await atualizarNota.mutateAsync({
        id,
        patch: { track: 'free', program_id: null, subject_id: null },
      })
    }

    await removePrograma.mutateAsync(program.id)
    return true
  }
}

/** O curso pelo id, para a tela de detalhe não repetir a busca. */
export function useProgram(id: string | undefined) {
  const { data: programs } = usePrograms()
  return programs.find((p) => p.id === id) ?? null
}
