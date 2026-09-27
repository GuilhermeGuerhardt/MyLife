/**
 * O autocompletar de `[[` dentro do editor formatado.
 *
 * O caderno é uma rede, e a rede se escreve com `[[Título]]`. Isso existia só
 * no editor de Markdown — quem escrevia em texto formatado, que virou o padrão,
 * ficava sem como ligar uma anotação na outra. O link é o mesmo texto nos dois
 * lados; o que faltava aqui era a ajuda para escrevê-lo sem lembrar o título
 * exato, que é o que faz a funcionalidade sobreviver à segunda semana.
 *
 * Sem plugin de ProseMirror e sem dependência nova: o que o editor precisa
 * responder é "o que foi digitado depois do último `[[`?", e isso sai do texto
 * do parágrafo onde o cursor está. A mesma função que o campo de Markdown usa
 * responde aqui.
 */

import type { Editor } from '@tiptap/react'
import { useCallback, useEffect, useState } from 'react'
import { linkEmAberto } from '@/lib/education/links'
import { filtrarSugestoes, temExato, type Sugestao } from './link-autocomplete'

interface Aberto {
  termo: string
  /** Onde o `[[` começa, em posição absoluta do documento. */
  de: number
  /** Onde o cursor está. */
  ate: number
}

export function useWikilinkNoEditor(editor: Editor | null, notas: Sugestao[]) {
  const [aberto, setAberto] = useState<Aberto | null>(null)
  const [indice, setIndice] = useState(0)

  const opcoes = aberto ? filtrarSugestoes(notas, aberto.termo) : []
  // Termo que não casa com nada vira "criar": escrever o nome do conceito agora
  // e preencher depois é o hábito que faz o caderno crescer.
  const criar = aberto !== null && aberto.termo.trim().length > 0 && !temExato(opcoes, aberto.termo)
  const total = opcoes.length + (criar ? 1 : 0)

  useEffect(() => setIndice(0), [aberto?.termo])

  /** Lê o estado do cursor e decide se há um `[[` em aberto. */
  const sincronizar = useCallback(() => {
    if (!editor || editor.isDestroyed) return setAberto(null)

    const { selection } = editor.state
    if (!selection.empty) return setAberto(null)

    const { $from } = selection
    // Só o texto do bloco onde o cursor está: um `[[` deixado aberto num
    // parágrafo anterior não pode capturar o que se escreve três linhas abaixo.
    const antes = $from.parent.textBetween(0, $from.parentOffset, '\n', '\n')
    const achado = linkEmAberto(antes, antes.length)

    setAberto(
      achado && { termo: achado.termo, de: $from.start() + achado.inicio, ate: $from.pos },
    )
  }, [editor])

  useEffect(() => {
    if (!editor) return
    editor.on('selectionUpdate', sincronizar)
    editor.on('update', sincronizar)
    return () => {
      editor.off('selectionUpdate', sincronizar)
      editor.off('update', sincronizar)
    }
  }, [editor, sincronizar])

  const fechar = useCallback(() => setAberto(null), [])

  /** Troca o `[[termo` digitado pelo link inteiro. */
  const escolher = useCallback(
    (titulo: string) => {
      if (!editor || !aberto) return
      editor
        .chain()
        .focus()
        .insertContentAt({ from: aberto.de, to: aberto.ate }, `[[${titulo}]]`)
        .run()
      setAberto(null)
    },
    [editor, aberto],
  )

  /**
   * As teclas da lista. Devolve `true` quando consumiu — o editor não pode
   * receber o Enter que confirmou a escolha nem a seta que moveu a seleção.
   */
  const teclou = useCallback(
    (evento: KeyboardEvent): boolean => {
      if (!aberto || total === 0) return false

      if (evento.key === 'ArrowDown') {
        setIndice((i) => (i + 1) % total)
        return true
      }
      if (evento.key === 'ArrowUp') {
        setIndice((i) => (i - 1 + total) % total)
        return true
      }
      if (evento.key === 'Enter' || evento.key === 'Tab') {
        const escolhido = indice < opcoes.length ? opcoes[indice]!.title : aberto.termo.trim()
        escolher(escolhido)
        return true
      }
      if (evento.key === 'Escape') {
        setAberto(null)
        return true
      }
      return false
    },
    [aberto, total, indice, opcoes, escolher],
  )

  return {
    aberto: aberto !== null,
    termo: aberto?.termo ?? '',
    opcoes,
    criar,
    indice,
    escolher,
    teclou,
    fechar,
  }
}
