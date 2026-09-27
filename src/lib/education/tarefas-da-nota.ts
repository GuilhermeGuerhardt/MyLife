/**
 * As tarefas escritas dentro de uma anotação, nos dois formatos.
 *
 * A caixa `- [ ]` do Markdown e a lista de tarefas do editor formatado são a
 * mesma coisa para quem escreveu: algo a fazer, anotado no meio da aula. Só a
 * representação muda. Aqui as duas viram a mesma lista, e marcar funciona
 * igual nas duas — é o que permite à tela de Tarefas mostrar o que está
 * espalhado pelo caderno sem saber em que formato cada anotação foi escrita.
 *
 * A posição é sempre a ordem no documento, nunca o texto: duas tarefas com o
 * mesmo nome são comuns numa lista de revisão, e casar por nome marcaria a
 * errada.
 */

import { formatoDaNota, type FormatoDaNota, type NotaComFormato } from './formato'
import { alternarTarefa, linhasDeTarefa } from './tarefas'

export interface TarefaDaNota {
  /** Posição no documento, base zero. É por ela que se marca. */
  ordinal: number
  texto: string
  feita: boolean
}

/** As tarefas de uma anotação, na ordem em que aparecem. */
export function tarefasDaNota(conteudo: string, formato: FormatoDaNota): TarefaDaNota[] {
  return formato === 'html' ? doHtml(conteudo) : doMarkdown(conteudo)
}

/** O conteúdo com a enésima tarefa trocada, ou `null` se a contagem não bate. */
export function alternarTarefaDaNota(
  conteudo: string,
  formato: FormatoDaNota,
  ordinal: number,
  estavaFeita: boolean,
): string | null {
  return formato === 'html'
    ? alternarNoHtml(conteudo, ordinal, estavaFeita)
    : alternarTarefa(conteudo, ordinal, estavaFeita)
}

/**
 * O conteúdo sem a enésima tarefa, ou `null` quando o texto não bate.
 *
 * A trava aqui é o texto, e não o estado da caixa como na hora de marcar:
 * apagar a linha errada não tem desfazer, e a anotação pode ter sido editada
 * entre a tela mostrar a lista e a pessoa confirmar. Não batendo, nada é
 * escrito.
 *
 * Some só a linha da tarefa. Uma sub-tarefa indentada embaixo dela fica onde
 * está, porque adivinhar que ela devia ir junto é decidir pelo autor o que o
 * texto dele significa.
 */
export function removerTarefaDaNota(
  conteudo: string,
  formato: FormatoDaNota,
  ordinal: number,
  textoEsperado: string,
): string | null {
  return formato === 'html'
    ? removerDoHtml(conteudo, ordinal, textoEsperado)
    : removerDoMarkdown(conteudo, ordinal, textoEsperado)
}

/** Atalho para quem já tem a anotação em mãos. */
export function tarefasDe(nota: NotaComFormato): TarefaDaNota[] {
  return tarefasDaNota(nota.content, formatoDaNota(nota))
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

/** `- [ ] texto` — o que vem depois dos colchetes é o texto da tarefa. */
const TEXTO_MD = /^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s*(.*)$/

function doMarkdown(markdown: string): TarefaDaNota[] {
  const linhas = markdown.split('\n')

  return linhasDeTarefa(markdown).map((tarefa, ordinal) => ({
    ordinal,
    feita: tarefa.marcada,
    texto: (TEXTO_MD.exec(linhas[tarefa.linha] ?? '')?.[1] ?? '').trim(),
  }))
}

function removerDoMarkdown(markdown: string, ordinal: number, esperado: string): string | null {
  const tarefa = linhasDeTarefa(markdown)[ordinal]
  if (!tarefa) return null

  const linhas = markdown.split('\n')
  const atual = (TEXTO_MD.exec(linhas[tarefa.linha] ?? '')?.[1] ?? '').trim()
  if (atual !== esperado.trim()) return null

  linhas.splice(tarefa.linha, 1)
  return linhas.join('\n')
}

// ---------------------------------------------------------------------------
// Texto formatado
// ---------------------------------------------------------------------------

function doHtml(html: string): TarefaDaNota[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  return [...doc.querySelectorAll('input[type="checkbox"]')].map((caixa, ordinal) => {
    const item = caixa.closest('li')
    return {
      ordinal,
      feita: caixa.hasAttribute('checked') || item?.getAttribute('data-checked') === 'true',
      // O texto vive num `div` irmão da caixa; `textContent` do item inteiro
      // pegaria junto o rótulo vazio que desenha o quadradinho.
      texto: (item?.querySelector('div')?.textContent ?? item?.textContent ?? '').trim(),
    }
  })
}

/**
 * Marca a enésima caixa do HTML.
 *
 * O `data-checked` do item acompanha o `checked` da caixa — os dois precisam
 * concordar, ou o editor reabre a tarefa como estava antes.
 */
function alternarNoHtml(html: string, ordinal: number, estavaFeita: boolean): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const caixa = doc.querySelectorAll('input[type="checkbox"]')[ordinal]
  if (!caixa) return null

  const feitaAgora = caixa.hasAttribute('checked')
  // A contagem não bateu com o documento: melhor não fazer nada do que marcar
  // a tarefa errada.
  if (feitaAgora !== estavaFeita) return null

  const alvo = !estavaFeita
  if (alvo) caixa.setAttribute('checked', '')
  else caixa.removeAttribute('checked')
  caixa.closest('li')?.setAttribute('data-checked', String(alvo))

  return doc.body.innerHTML
}

/**
 * Tira o item da lista no HTML.
 *
 * A lista que fica vazia sai junto: um `<ul>` sem nenhum `<li>` não aparece na
 * tela, mas continua no arquivo e reabre o editor com um bloco fantasma que
 * ninguém consegue apagar clicando.
 */
function removerDoHtml(html: string, ordinal: number, esperado: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const caixa = doc.querySelectorAll('input[type="checkbox"]')[ordinal]
  if (!caixa) return null

  const item = caixa.closest('li')
  if (!item) return null

  const atual = (item.querySelector('div')?.textContent ?? item.textContent ?? '').trim()
  if (atual !== esperado.trim()) return null

  const lista = item.parentElement
  item.remove()
  if (lista && lista.children.length === 0) lista.remove()

  return doc.body.innerHTML
}
