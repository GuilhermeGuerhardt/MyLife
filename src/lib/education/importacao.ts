/**
 * Trazer um arquivo de fora para dentro do caderno.
 *
 * A extensão decide a língua da anotação, e é a única coisa que decide: `.md`
 * entra como Markdown, porque quem escreveu Markdown quer continuar escrevendo
 * Markdown; todo o resto entra no editor formatado, que é onde `.docx`, `.pdf`
 * e `.txt` conseguem virar algo editável sem inventar marcação.
 *
 * Aqui mora só a parte que não depende de biblioteca nem de arquivo aberto —
 * é o que dá para testar sem um `.docx` de verdade no disco.
 */

import type { FormatoDaNota } from './formato'

export type ExtensaoAceita = 'md' | 'txt' | 'docx' | 'pdf'

export const IMPORTACAO_ACCEPT = '.md,.markdown,.txt,.docx,.pdf'

/**
 * Teto do arquivo importado.
 *
 * A anotação vira uma linha JSON como qualquer outra — no SQLite, no
 * `localStorage` ou no arquivo da pasta. Um `.docx` de 30 MB entraria inteiro
 * no banco e levaria junto o backup e a sincronização.
 */
export const IMPORTACAO_MAX_BYTES = 2_000_000

export class ImportacaoInvalida extends Error {}

const EXTENSOES: Record<string, ExtensaoAceita> = {
  md: 'md',
  markdown: 'md',
  txt: 'txt',
  text: 'txt',
  docx: 'docx',
  pdf: 'pdf',
}

/** A extensão do nome, ou `null` quando é um arquivo que não sabemos ler. */
export function extensaoDoArquivo(nome: string): ExtensaoAceita | null {
  const ponto = nome.lastIndexOf('.')
  if (ponto < 0) return null
  return EXTENSOES[nome.slice(ponto + 1).toLowerCase()] ?? null
}

/** `.md` continua Markdown; o resto vira texto formatado. */
export function formatoDeDestino(extensao: ExtensaoAceita): FormatoDaNota {
  return extensao === 'md' ? 'markdown' : 'html'
}

/**
 * O título da anotação, a partir do nome do arquivo.
 *
 * Desfaz o que a exportação faz — hífen e sublinhado voltam a ser espaço —,
 * para o arquivo que saiu daqui voltar com o nome que tinha.
 */
export function tituloDoArquivo(nome: string): string {
  // A mesma conta de `extensaoDoArquivo`, para as duas nunca discordarem sobre
  // onde a extensão começa.
  const ponto = nome.lastIndexOf('.')
  const semExtensao = ponto < 0 ? nome : nome.slice(0, ponto)
  return semExtensao.replace(/[-_]+/g, ' ').trim() || 'Anotação importada'
}

/**
 * Texto puro como HTML.
 *
 * Uma linha, um parágrafo, e nada de adivinhação: um `.txt` não tem marcação,
 * e tentar reconhecer lista ou título ali acertaria às vezes e estragaria o
 * resto. O que veio no arquivo é o que aparece na anotação.
 */
export function textoParaHtml(texto: string): string {
  const linhas = texto
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha !== '')

  if (linhas.length === 0) return ''
  return linhas.map((linha) => `<p>${escapar(linha)}</p>`).join('')
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * O HTML que veio do Word, pronto para virar anotação.
 *
 * As imagens caem fora: o Word as entrega embutidas em base64, e uma foto de
 * 3 MB dentro da linha da anotação é justamente o que o teto acima evita. O
 * resto da limpeza — script, style, atributo estranho — é do DOMPurify na
 * leitura; repetir a lista aqui daria duas listas para envelhecerem separadas.
 */
export function limparHtmlImportado(html: string): string {
  return html
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .trim()
}
