/**
 * Ligações entre anotações, no formato `[[Título]]`.
 *
 * A pasta diz a que curso uma anotação pertence — um pai só, uma hierarquia.
 * O link diz o que ela *puxa*: quantos quiser, atravessando faculdade, curso e
 * estudo livre. É a relação que nenhuma árvore consegue expressar, e a razão de
 * um caderno virar rede em vez de gaveta.
 *
 * A ligação é pelo **título**, não pelo id: o Markdown exportado no backup
 * continua legível fora do app. O preço é renomear quebrar quem apontava —
 * daí `renomearNosTextos`, que reescreve as referências junto.
 */

/**
 * `[[` ... `]]` numa linha só. Título vazio não conta.
 *
 * Nenhum colchete no meio: sem isso, um `[[` que a pessoa esqueceu de fechar
 * engoliria o texto inteiro até o próximo `]]`, transformando um parágrafo em
 * um link gigante. Título de anotação não leva colchete, então não se perde nada.
 */
const LINK = /\[\[([^[\]\n]+)\]\]/g

/**
 * Compara títulos ignorando acento, caixa e espaço sobrando.
 *
 * Quem escreve `[[arquitetura hexagonal]]` no meio de uma frase quer a
 * anotação "Arquitetura Hexagonal" — exigir a grafia exata transformaria o
 * link numa pegadinha.
 */
export function chaveTitulo(titulo: string): string {
  return titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/**
 * Trechos que não são texto: blocos cercados e código em linha.
 *
 * Sem isso, um `[[x]]` dentro de um exemplo de código viraria link — e o
 * exemplo deixaria de mostrar o que pretendia.
 */
const CODIGO = /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g

/** Substitui cada trecho de código por espaços, preservando as posições. */
function semCodigo(texto: string): string {
  return texto.replace(CODIGO, (trecho) => ' '.repeat(trecho.length))
}

/** Os títulos citados no texto, na ordem, sem repetir. */
export function linksDoTexto(conteudo: string): string[] {
  const vistos = new Map<string, string>()
  for (const [, titulo] of semCodigo(conteudo).matchAll(LINK)) {
    const limpo = (titulo ?? '').trim()
    if (!limpo) continue
    const chave = chaveTitulo(limpo)
    if (!vistos.has(chave)) vistos.set(chave, limpo)
  }
  return [...vistos.values()]
}

export interface NotaLigavel {
  id: string
  title: string
  content: string
}

/** Índice de título para anotação, para resolver um link em tempo de render. */
export function indicePorTitulo<T extends NotaLigavel>(notas: T[]): Map<string, T> {
  const indice = new Map<string, T>()
  for (const nota of notas) {
    const chave = chaveTitulo(nota.title)
    // A primeira vence: dois títulos iguais são um acidente, e trocar o alvo
    // conforme a ordem de carregamento seria pior que escolher um.
    if (chave && !indice.has(chave)) indice.set(chave, nota)
  }
  return indice
}

export interface Retrolink<T> {
  nota: T
  /** A frase em volta da citação, para dar contexto sem abrir a anotação. */
  trecho: string
}

/** Quantos caracteres de cada lado da citação entram no trecho. */
const FOLGA = 60

/**
 * Quem aponta para esta anotação.
 *
 * Varre o conteúdo de todas as outras — barato porque o app já carrega a
 * coleção inteira em memória, e é o que permite chegar numa anotação e
 * descobrir que o projeto de Rust e uma aula da faculdade já a citaram.
 */
export function retrolinks<T extends NotaLigavel>(alvo: NotaLigavel, notas: T[]): Array<Retrolink<T>> {
  const chave = chaveTitulo(alvo.title)
  if (!chave) return []

  const achados: Array<Retrolink<T>> = []
  for (const nota of notas) {
    if (nota.id === alvo.id) continue
    const texto = semCodigo(nota.content)
    for (const achado of texto.matchAll(LINK)) {
      if (chaveTitulo(achado[1] ?? '') !== chave) continue
      achados.push({ nota, trecho: trechoEmVolta(nota.content, achado.index ?? 0, achado[0].length) })
      break // Uma entrada por anotação: dez citações na mesma não são dez fontes.
    }
  }
  return achados
}

/** A frase em volta da citação, com reticências onde foi cortada. */
function trechoEmVolta(conteudo: string, inicio: number, tamanho: number): string {
  const de = Math.max(0, inicio - FOLGA)
  const ate = Math.min(conteudo.length, inicio + tamanho + FOLGA)
  const bruto = conteudo
    .slice(de, ate)
    .replace(LINK, '$1')
    // O corte pode partir um link ao meio e deixar só metade dos colchetes.
    .replace(/\[\[|\]\]/g, '')
    .replace(/[#*_>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return `${de > 0 ? '…' : ''}${bruto}${ate < conteudo.length ? '…' : ''}`
}

/**
 * Troca o título dentro dos `[[ ]]` de um texto.
 *
 * Chamado ao renomear uma anotação, em todas as que a citavam: sem isso, o
 * link vira órfão e a rede se desfaz em silêncio, que é a pior forma de perder
 * informação — ninguém percebe.
 */
export function renomearNosTextos(conteudo: string, de: string, para: string): string {
  const chave = chaveTitulo(de)
  return conteudo.replace(LINK, (inteiro, titulo: string) =>
    chaveTitulo(titulo) === chave ? `[[${para}]]` : inteiro,
  )
}

/** As anotações cujo texto muda ao renomear — só elas precisam ser gravadas. */
export function afetadasPorRenomear<T extends NotaLigavel>(
  notas: T[],
  de: string,
  para: string,
): Array<{ nota: T; conteudo: string }> {
  if (chaveTitulo(de) === chaveTitulo(para)) return []
  const mudadas: Array<{ nota: T; conteudo: string }> = []
  for (const nota of notas) {
    const novo = renomearNosTextos(nota.content, de, para)
    if (novo !== nota.content) mudadas.push({ nota, conteudo: novo })
  }
  return mudadas
}

/**
 * O que está sendo digitado depois de um `[[` aberto, para o autocompletar.
 *
 * Devolve `null` quando o cursor não está dentro de um link em aberto — o que
 * inclui o caso de o `]]` já ter sido fechado antes dele.
 */
export function linkEmAberto(
  texto: string,
  cursor: number,
): { termo: string; inicio: number } | null {
  const antes = texto.slice(0, cursor)
  const abertura = antes.lastIndexOf('[[')
  if (abertura === -1) return null

  const termo = antes.slice(abertura + 2)
  // Fechou, quebrou a linha ou abriu outro: não é mais o mesmo link.
  if (termo.includes(']') || termo.includes('\n') || termo.includes('[')) return null

  return { termo, inicio: abertura }
}
