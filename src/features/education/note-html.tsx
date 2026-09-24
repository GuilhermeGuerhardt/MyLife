/**
 * A leitura de uma anotação em texto formatado.
 *
 * A limpeza do HTML está em `lib/education/html-limpo`, compartilhada com a
 * exportação em PDF — as duas escrevem a anotação num documento do app, e uma
 * segunda lista de permissões envelheceria diferente desta.
 */

import { useMemo, type MouseEvent } from 'react'
import { htmlLimpoDaNota } from '@/lib/education/html-limpo'
import { cn } from '@/lib/utils'

export function NoteHtml({
  content,
  className,
  onAbrirNota,
  onAlternarTarefa,
}: {
  content: string
  className?: string
  onAbrirNota?: (titulo: string) => void
  /** Marca a enésima tarefa do documento, na ordem em que aparecem. */
  onAlternarTarefa?: (ordinal: number, estavaMarcada: boolean) => void
}) {
  const html = useMemo(() => htmlLimpoDaNota(content), [content])

  const clicou = (evento: MouseEvent<HTMLDivElement>) => {
    const alvo = evento.target as HTMLElement

    const caixa = alvo.closest<HTMLInputElement>('input[type="checkbox"]')
    if (caixa && onAlternarTarefa) {
      // A posição sai da ordem no documento, como no Markdown: duas tarefas
      // com o mesmo texto são comuns, e casar por texto marcaria a errada.
      const todas = [...evento.currentTarget.querySelectorAll('input[type="checkbox"]')]
      const ordinal = todas.indexOf(caixa)
      if (ordinal >= 0) onAlternarTarefa(ordinal, !caixa.checked)
      return
    }

    if (!onAbrirNota) return
    const link = alvo.closest('a[data-nota]')
    const titulo = link?.getAttribute('data-nota')
    if (!titulo) return
    evento.preventDefault()
    onAbrirNota(titulo)
  }

  return (
    <div
      className={cn('prose-notes', className)}
      onClick={clicou}
      // Sanitizado logo acima.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
