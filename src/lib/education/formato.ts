/**
 * As duas eras do caderno: Markdown e texto formatado.
 *
 * Toda anotação escrita até aqui é Markdown, e continua sendo — nada é
 * convertido às escondidas. O campo `format` diz em que língua cada uma está,
 * e a ausência dele significa Markdown, que é o que as antigas têm.
 *
 * Converter é escolha de quem escreveu, uma anotação por vez: reescrever o
 * caderno inteiro de uma vez seria mexer no texto de alguém em massa, sem
 * volta, para ganhar formatação que talvez nem se queira ali.
 */

export type FormatoDaNota = 'markdown' | 'html'

export interface NotaComFormato {
  content: string
  format?: FormatoDaNota | null
}

/** Ausente = Markdown. É o que as anotações de antes trazem. */
export function formatoDaNota(nota: NotaComFormato): FormatoDaNota {
  return nota.format === 'html' ? 'html' : 'markdown'
}

/**
 * Texto puro, sem marcação de nenhuma das duas línguas.
 *
 * Serve à busca e à contagem de palavras: sem isto, procurar por "style"
 * traria toda anotação colorida, e o rodapé contaria `<strong>` como palavra.
 */
export function textoPuro(conteudo: string, formato: FormatoDaNota): string {
  if (formato === 'html') {
    return conteudo
      // O conteúdo de script e style não é texto que alguém escreveu.
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // `&amp;` por último: antes dele, `&amp;lt;` viraria `<`.
      .replace(/&amp;/g, '&')
  }

  return conteudo
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^[\]\n]+)\]\]/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/gm, '')
    .replace(/[*_~>]/g, '')
}

export function contarPalavras(conteudo: string, formato: FormatoDaNota): number {
  return textoPuro(conteudo, formato).trim().split(/\s+/).filter(Boolean).length
}

/**
 * Markdown para o HTML que o editor entende, na hora de converter.
 *
 * Deliberadamente modesto: cobre o que o caderno realmente usa — títulos,
 * listas, tarefas, citação, código, negrito, itálico e link. O que escapar vira
 * parágrafo, que é texto preservado, não texto perdido.
 *
 * Os `[[links]]` viram texto simples com a marca `data-nota`: eles continuam
 * legíveis e continuam achando a anotação de destino na leitura.
 */
export function markdownParaHtml(markdown: string): string {
  const linhas = markdown.split('\n')
  const saida: string[] = []
  let lista: 'ul' | 'ol' | 'task' | null = null
  let dentroDeCodigo = false
  let bufferDeCodigo: string[] = []

  const fecharLista = () => {
    if (!lista) return
    saida.push(lista === 'ol' ? '</ol>' : '</ul>')
    lista = null
  }

  const abrirLista = (tipo: 'ul' | 'ol' | 'task') => {
    if (lista === tipo) return
    fecharLista()
    if (tipo === 'ol') saida.push('<ol>')
    else if (tipo === 'task') saida.push('<ul data-type="taskList">')
    else saida.push('<ul>')
    lista = tipo
  }

  for (const linha of linhas) {
    if (/^\s*(```|~~~)/.test(linha)) {
      if (dentroDeCodigo) {
        saida.push(`<pre><code>${escapar(bufferDeCodigo.join('\n'))}</code></pre>`)
        bufferDeCodigo = []
        dentroDeCodigo = false
      } else {
        fecharLista()
        dentroDeCodigo = true
      }
      continue
    }
    if (dentroDeCodigo) {
      bufferDeCodigo.push(linha)
      continue
    }

    if (linha.trim() === '') {
      fecharLista()
      continue
    }

    const titulo = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(linha)
    if (titulo) {
      fecharLista()
      const nivel = Math.min(titulo[1]!.length, 6)
      saida.push(`<h${nivel}>${emLinha(titulo[2]!)}</h${nivel}>`)
      continue
    }

    const tarefa = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.*)$/.exec(linha)
    if (tarefa) {
      abrirLista('task')
      const feita = tarefa[1] !== ' '
      saida.push(
        `<li data-type="taskItem" data-checked="${feita}"><label><input type="checkbox"${feita ? ' checked' : ''}><span></span></label><div><p>${emLinha(tarefa[2]!)}</p></div></li>`,
      )
      continue
    }

    const item = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(linha)
    if (item) {
      abrirLista(/^\d/.test(item[1]!) ? 'ol' : 'ul')
      saida.push(`<li><p>${emLinha(item[2]!)}</p></li>`)
      continue
    }

    const citacao = /^\s*>\s?(.*)$/.exec(linha)
    if (citacao) {
      fecharLista()
      saida.push(`<blockquote><p>${emLinha(citacao[1]!)}</p></blockquote>`)
      continue
    }

    if (/^\s*([-*_])\s*\1\s*\1[\s-*_]*$/.test(linha)) {
      fecharLista()
      saida.push('<hr>')
      continue
    }

    fecharLista()
    saida.push(`<p>${emLinha(linha)}</p>`)
  }

  if (dentroDeCodigo && bufferDeCodigo.length > 0) {
    saida.push(`<pre><code>${escapar(bufferDeCodigo.join('\n'))}</code></pre>`)
  }
  fecharLista()

  return saida.join('\n')
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Negrito, itálico, código, link e `[[link]]`, dentro de uma linha. */
function emLinha(texto: string): string {
  return escapar(texto)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_]+)_/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(
      /\[\[([^[\]\n]+)\]\]/g,
      '<a href="#nota" class="nota-link" data-nota="$1">$1</a>',
    )
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
}
