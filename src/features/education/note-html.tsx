/**
 * A leitura de uma anotação em texto formatado.
 *
 * O conteúdo saiu do editor da própria pessoa, mas passa pelo DOMPurify assim
 * mesmo: colar um trecho de site traz junto o que vier, e "conteúdo próprio"
 * deixa de ser confiável no instante em que se cola algo de fora.
 *
 * O `style` é liberado — sem ele a cor da letra e a do sublinhado, que são o
 * motivo desta tela existir, sumiriam na leitura.
 */

import DOMPurify from 'dompurify'
import { useMemo, type MouseEvent } from 'react'
import { cn } from '@/lib/utils'

const LIMPEZA = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['style', 'data-nota', 'data-cor', 'data-type', 'data-checked'],
}

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
  const html = useMemo(() => DOMPurify.sanitize(content ?? '', LIMPEZA), [content])

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
