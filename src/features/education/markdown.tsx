import DOMPurify from 'dompurify'
import { Marked, type Tokens } from 'marked'
import { useMemo, type MouseEvent } from 'react'
import { chaveTitulo } from '@/lib/education/links'
import { cn } from '@/lib/utils'

const OPCOES = { breaks: true, gfm: true } as const

/** Marca o `<a>` que veio de um `[[link]]`, para o clique ser interceptado. */
const ATRIBUTO = 'data-nota'

interface TokenLink extends Tokens.Generic {
  type: 'wikilink'
  titulo: string
}

function escapar(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * A extensão que ensina o `marked` a ler `[[Título]]`.
 *
 * Extensão, e não uma troca de texto antes de converter: só assim o `marked`
 * consome primeiro o código em linha e os blocos cercados, e um `[[exemplo]]`
 * dentro de código continua sendo o exemplo que ele queria mostrar.
 */
function extensaoWikilink(existe: (titulo: string) => boolean) {
  return {
    name: 'wikilink',
    level: 'inline' as const,
    start(src: string) {
      return src.indexOf('[[')
    },
    tokenizer(src: string): TokenLink | undefined {
      // Sem colchete no meio, igual ao `LINK` de `lib/education/links`: um
      // `[[` esquecido não pode transformar o parágrafo inteiro num link.
      const achado = /^\[\[([^[\]\n]+)\]\]/.exec(src)
      if (!achado) return undefined
      const titulo = (achado[1] ?? '').trim()
      if (!titulo) return undefined
      return { type: 'wikilink', raw: achado[0], titulo }
    },
    renderer(token: Tokens.Generic) {
      const titulo = (token as TokenLink).titulo
      // A anotação que ainda não existe também vira link: é clicando nela que
      // ela nasce, e esse é o hábito que faz o caderno crescer sozinho.
      const classe = existe(titulo) ? 'nota-link' : 'nota-link nota-link-vazio'
      return `<a href="#nota" class="${classe}" ${ATRIBUTO}="${escapar(titulo)}">${escapar(titulo)}</a>`
    },
  }
}

/**
 * Renderiza o Markdown do caderno.
 *
 * O conteúdo é do próprio usuário, mas passa pelo DOMPurify assim mesmo: basta
 * colar um trecho de um site com `<img onerror=...>` para o "conteúdo próprio"
 * deixar de ser confiável.
 */
export function Markdown({
  content,
  className,
  /** Títulos que existem — define se o link sai cheio ou tracejado. */
  existeNota,
  /** Clique num `[[link]]`. Sem isso, os links viram texto comum. */
  onAbrirNota,
}: {
  content: string
  className?: string
  existeNota?: (titulo: string) => boolean
  onAbrirNota?: (titulo: string) => void
}) {
  const ligado = Boolean(onAbrirNota)

  const html = useMemo(() => {
    const marked = new Marked(OPCOES)
    if (ligado) marked.use({ extensions: [extensaoWikilink(existeNota ?? (() => false))] })
    const parsed = marked.parse(content ?? '', { async: false })
    return DOMPurify.sanitize(parsed, { USE_PROFILES: { html: true } })
  }, [content, ligado, existeNota])

  /**
   * Um ouvinte no container em vez de um por link: o HTML é injetado, então
   * não há onde pendurar `onClick` em cada `<a>`.
   */
  const clicou = (evento: MouseEvent<HTMLDivElement>) => {
    if (!onAbrirNota) return
    const alvo = (evento.target as HTMLElement).closest(`a[${ATRIBUTO}]`)
    const titulo = alvo?.getAttribute(ATRIBUTO)
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

export { chaveTitulo }
