/**
 * O quadro de tarefas: os dados e o que se pode fazer com eles.
 *
 * A tela só desenha. Aqui ficam as duas fontes que o quadro junta — a tarefa
 * escrita na própria tela e a caixinha escrita no meio de uma anotação — e as
 * quatro ações que mexem nelas, cada uma com a sua trava.
 *
 * Mora fora da página porque é a parte que erra: escrever no texto de uma
 * anotação alheia por posição, decidir se o arrasto muda alguma coisa, esconder
 * sem apagar. A página, sem isso, é cabeçalho e duas colunas.
 */

import { useMemo, useState } from 'react'
import { useHiddenTasks, useNotes, useTasks } from '@/data/queries'
import { today } from '@/lib/dates'
import { formatoDaNota } from '@/lib/education/formato'
import {
  alternarTarefaDaNota,
  removerTarefaDaNota,
  tarefasDe,
} from '@/lib/education/tarefas-da-nota'
import {
  montarLista,
  mudaDeColuna,
  resumir,
  semAsOcultas,
  separarEmColunas,
  type ColunaDeTarefa,
  type ItemDeTarefa,
} from '@/lib/routine/tarefas'

export function useQuadroDeTarefas() {
  const { data: tasks, create, update, remove } = useTasks()
  const { data: notes, update: updateNote } = useNotes()
  const { data: ocultas, create: ocultar } = useHiddenTasks()

  /** Cartão do caderno esperando a resposta de "excluir de onde?". */
  const [excluindo, setExcluindo] = useState<ItemDeTarefa | null>(null)

  const hoje = today()

  const lista = useMemo(
    () =>
      montarLista(
        tasks,
        notes.map((nota) => ({ id: nota.id, title: nota.title, tarefas: tarefasDe(nota) })),
      ),
    [tasks, notes],
  )

  const noQuadro = semAsOcultas(lista, ocultas)

  /**
   * Marcar, venha de onde vier.
   *
   * Na tarefa do caderno, o que muda é o texto da anotação, e por posição,
   * nunca por nome. Divergindo a contagem, nada é escrito: a anotação pode ter
   * sido editada entre ver a lista e clicar nela, e marcar a tarefa errada em
   * silêncio é pior do que o clique não funcionar.
   */
  function alternar(item: ItemDeTarefa) {
    if (item.origem.tipo === 'propria') {
      update.mutate({ id: item.origem.id, patch: { done: !item.feita } })
      return
    }

    const nota = notes.find((n) => n.id === item.origem.id)
    if (!nota) return

    const conteudo = alternarTarefaDaNota(
      nota.content,
      formatoDaNota(nota),
      item.origem.ordinal,
      item.feita,
    )
    if (conteudo !== null) updateNote.mutate({ id: nota.id, patch: { content: conteudo } })
  }

  /**
   * Tira do quadro, sem tocar na anotação.
   *
   * Só vale para a tarefa que veio do caderno. A escrita na própria tela existe
   * só no quadro, então para ela não há dois lugares de onde excluir.
   */
  function tirarDoQuadro(item: ItemDeTarefa) {
    if (item.origem.tipo !== 'nota') return
    ocultar.mutate({ nota: item.origem.id, texto: item.titulo })
    setExcluindo(null)
  }

  /**
   * Apaga a caixinha de dentro da anotação, e com ela o cartão.
   *
   * A trava é o texto: a anotação pode ter sido editada entre a tela listar a
   * tarefa e a pessoa confirmar aqui, e apagar a linha errada de um caderno não
   * tem desfazer. Não batendo, nada é escrito e o aviso fica.
   */
  function apagarDosDoisLugares(item: ItemDeTarefa) {
    if (item.origem.tipo !== 'nota') return
    const nota = notes.find((n) => n.id === item.origem.id)
    if (!nota) return

    const conteudo = removerTarefaDaNota(
      nota.content,
      formatoDaNota(nota),
      item.origem.ordinal,
      item.titulo,
    )
    if (conteudo === null) return

    updateNote.mutate({ id: nota.id, patch: { content: conteudo } })
    setExcluindo(null)
  }

  return {
    hoje,
    resumo: resumir(noQuadro, hoje),
    quadro: separarEmColunas(noQuadro),
    excluindo,
    pedirExclusao: setExcluindo,
    cancelarExclusao: () => setExcluindo(null),

    criar: (titulo: string, prazo: string) =>
      create.mutate({ title: titulo, done: false, date: prazo || null, notes: null }),
    remover: (id: string) => remove.mutate(id),
    alternar,
    tirarDoQuadro,
    apagarDosDoisLugares,

    /** O cartão só muda de estado quando muda mesmo de coluna. */
    soltar: (chave: string, coluna: ColunaDeTarefa) => {
      const item = noQuadro.find((candidato) => candidato.chave === chave)
      if (item && mudaDeColuna(item, coluna)) alternar(item)
    },
  }
}
