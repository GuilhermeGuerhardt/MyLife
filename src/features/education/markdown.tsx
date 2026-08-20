import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'

marked.setOptions({ breaks: true, gfm: true })

/**
 * Renderiza o Markdown do caderno.
 *
 * O conteúdo é do próprio usuário, mas passa pelo DOMPurify assim mesmo: basta
 * colar um trecho de um site com `<img onerror=...>` para o "conteúdo próprio"
 * deixar de ser confiável.
 */
export function Markdown({ content, className }: { content: string; className?: string }) {
  const html = useMemo(() => {
    const parsed = marked.parse(content ?? '', { async: false })
    return DOMPurify.sanitize(parsed, { USE_PROFILES: { html: true } })
  }, [content])

  return (
    <div
      className={cn('prose-notes', className)}
      // Sanitizado logo acima.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
