/**
 * A anotação como blocos, entre o HTML e o arquivo que sai.
 *
 * Exportar para `.txt` e para `.docx` é a mesma leitura do texto feita duas
 * vezes — um lê para jogar fora a formatação, o outro para traduzi-la. Ter um
 * modelo no meio evita duas varreduras de HTML que envelheceriam separadas, e
 * é o que permite testar a conversão sem abrir o Word.
 *
 * Deliberadamente pobre: título, parágrafo, item, tarefa, citação e código.
 * É o que o Caderno escreve. Tabela e imagem ficariam aqui como um bloco que
 * nada sabe montar, e um modelo que promete o que ninguém entrega é pior que
 * um modelo curto.
 */

export type TipoDeBloco =
  | 'titulo'
  | 'paragrafo'
  | 'item'
  | 'item-numerado'
  | 'tarefa'
  | 'citacao'
  | 'codigo'
  | 'linha'

export interface Marcas {
  negrito?: boolean
  italico?: boolean
  sublinhado?: boolean
  riscado?: boolean
  codigo?: boolean
  /** Cor da letra, como veio do editor. */
  cor?: string
  /** Cor do marca-texto. */
  fundo?: string
  /** Cor do sublinhado, quando há. */
  corDoSublinhado?: string
}

export interface Trecho {
  texto: string
  marcas: Marcas
}

export interface Bloco {
  tipo: TipoDeBloco
  /** 1 a 6, só em `titulo`. */
  nivel?: number
  /** Só em `tarefa`. */
  feita?: boolean
  /** Recuo de sublista, a partir de zero. */
  recuo?: number
  trechos: Trecho[]
}

/** Só o texto, sem marca nenhuma — o que vai para o `.txt`. */
export function textoDoBloco(bloco: Bloco): string {
  return bloco.trechos.map((t) => t.texto).join('')
}

/**
 * Lê o HTML da anotação e devolve os blocos.
 *
 * Usa o parser do próprio navegador em vez de expressão regular: HTML aninhado
 * não é linguagem regular, e o editor produz listas dentro de listas o tempo
 * todo. Um parser de verdade já está ali, de graça.
 */
export function blocosDoHtml(html: string): Bloco[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocos: Bloco[] = []
  percorrer(doc.body, blocos, {}, 0)
  return blocos.filter((b) => b.tipo === 'linha' || textoDoBloco(b).trim() !== '')
}

const TITULOS: Record<string, number> = { H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6 }

function percorrer(no: Node, blocos: Bloco[], marcas: Marcas, recuo: number): void {
  for (const filho of Array.from(no.childNodes)) {
    if (filho.nodeType === Node.TEXT_NODE) {
      const texto = filho.textContent ?? ''
      if (texto.trim() === '') continue
      // Texto solto fora de bloco: vira parágrafo, para não sumir.
      anexar(blocos, { tipo: 'paragrafo', recuo, trechos: [] }, { texto, marcas })
      continue
    }
    if (filho.nodeType !== Node.ELEMENT_NODE) continue

    const el = filho as HTMLElement
    const tag = el.tagName

    if (tag === 'BR') {
      anexar(blocos, { tipo: 'paragrafo', recuo, trechos: [] }, { texto: '\n', marcas })
      continue
    }
    if (tag === 'HR') {
      blocos.push({ tipo: 'linha', trechos: [] })
      continue
    }

    if (TITULOS[tag]) {
      blocos.push({ tipo: 'titulo', nivel: TITULOS[tag], recuo, trechos: [] })
      percorrer(el, blocos, marcas, recuo)
      continue
    }

    if (tag === 'P') {
      // O TipTap põe um <p> dentro de cada item e dentro da citação; ali o
      // parágrafo não é um bloco novo, é o texto do bloco que já foi aberto.
      // Abrir um aqui deixaria o item vazio e o texto sem o recuo ou o `>`.
      const dentroDeOutroBloco = el.closest('li, blockquote') !== null
      if (!dentroDeOutroBloco) blocos.push({ tipo: 'paragrafo', recuo, trechos: [] })
      percorrer(el, blocos, marcas, recuo)
      continue
    }

    if (tag === 'BLOCKQUOTE') {
      blocos.push({ tipo: 'citacao', recuo, trechos: [] })
      percorrer(el, blocos, marcas, recuo)
      continue
    }

    if (tag === 'PRE') {
      blocos.push({ tipo: 'codigo', recuo, trechos: [{ texto: el.textContent ?? '', marcas: {} }] })
      continue
    }

    if (tag === 'UL' || tag === 'OL') {
      // Sublista recua; a lista de fora não. A conta é "estou dentro de um
      // item?" — `closest` devolve `null` quando não acha, e comparar isso com
      // `undefined` daria verdadeiro sempre, recuando até a primeira lista.
      const ehSublista = el.closest('li') !== null
      percorrer(el, blocos, marcas, ehSublista ? recuo + 1 : recuo)
      continue
    }

    if (tag === 'LI') {
      const caixa = el.querySelector('input[type="checkbox"]')
      if (caixa) {
        blocos.push({
          tipo: 'tarefa',
          feita: caixa.hasAttribute('checked') || el.getAttribute('data-checked') === 'true',
          recuo,
          trechos: [],
        })
      } else {
        const numerada = el.parentElement?.tagName === 'OL'
        blocos.push({ tipo: numerada ? 'item-numerado' : 'item', recuo, trechos: [] })
      }
      percorrer(el, blocos, marcas, recuo)
      continue
    }

    // `label` e `span` vazio do TipTap desenham a caixa; o texto vem no `div`.
    if (tag === 'LABEL' || tag === 'INPUT') continue

    percorrer(el, blocos, comMarcas(el, marcas), recuo)
  }
}

/**
 * Acrescenta o trecho ao bloco aberto, abrindo um novo se não houver.
 *
 * Linha divisória e bloco de código não recebem texto solto: um já está
 * fechado por natureza e o outro guarda o conteúdo inteiro de uma vez.
 */
function anexar(blocos: Bloco[], novo: Bloco, trecho: Trecho): void {
  const ultimo = blocos[blocos.length - 1]
  const aberto = ultimo && ultimo.tipo !== 'linha' && ultimo.tipo !== 'codigo'

  if (!aberto) blocos.push(novo)
  blocos[blocos.length - 1]!.trechos.push(trecho)
}

/** As marcas que este elemento acrescenta às que já vinham de fora. */
function comMarcas(el: HTMLElement, herdadas: Marcas): Marcas {
  const tag = el.tagName
  const marcas: Marcas = { ...herdadas }

  if (tag === 'STRONG' || tag === 'B') marcas.negrito = true
  if (tag === 'EM' || tag === 'I') marcas.italico = true
  if (tag === 'U') {
    marcas.sublinhado = true
    const cor = el.getAttribute('data-cor') || el.style.textDecorationColor
    if (cor) marcas.corDoSublinhado = cor
  }
  if (tag === 'S' || tag === 'DEL' || tag === 'STRIKE') marcas.riscado = true
  if (tag === 'CODE') marcas.codigo = true
  if (tag === 'MARK') {
    marcas.fundo = el.getAttribute('data-color') || el.style.backgroundColor || '#fde68a'
  }
  if (el.style.color) marcas.cor = el.style.color

  return marcas
}

/**
 * Os blocos como texto puro, para o `.txt`.
 *
 * Marca a tarefa com `[x]` e mantém o recuo: o arquivo precisa continuar
 * legível, não virar um bolo de linhas sem hierarquia.
 */
export function blocosParaTexto(blocos: Bloco[]): string {
  const linhas: string[] = []

  for (const bloco of blocos) {
    const recuo = '  '.repeat(bloco.recuo ?? 0)
    const texto = textoDoBloco(bloco)

    switch (bloco.tipo) {
      case 'titulo':
        linhas.push('', texto.toUpperCase(), '')
        break
      case 'item':
        linhas.push(`${recuo}- ${texto}`)
        break
      case 'item-numerado':
        linhas.push(`${recuo}1. ${texto}`)
        break
      case 'tarefa':
        linhas.push(`${recuo}[${bloco.feita ? 'x' : ' '}] ${texto}`)
        break
      case 'citacao':
        linhas.push(`${recuo}> ${texto}`)
        break
      case 'codigo':
        linhas.push('', texto, '')
        break
      case 'linha':
        linhas.push('', '---', '')
        break
      default:
        linhas.push(texto)
    }
  }

  // Três linhas em branco seguidas viram uma: os separadores acima somam.
  return linhas.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

/** O Markdown como texto puro, para o `.txt` de uma anotação em Markdown. */
export function markdownParaTexto(markdown: string): string {
  return (
    markdown
      .replace(/```[\s\S]*?```/g, (bloco) => bloco.replace(/```\w*\n?/g, ''))
      .replace(/`([^`]*)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[\[([^[\]\n]+)\]\]/g, '$1')
      .replace(/^\s{0,3}(#{1,6})\s+(.*)$/gm, (_l, _h, t: string) => `\n${t.toUpperCase()}\n`)
      .replace(/^(\s*)([-*+])\s+/gm, '$1- ')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1$2')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
  )
}

/** Nome de arquivo seguro, a partir do título da anotação. */
export function nomeDeArquivo(titulo: string): string {
  const limpo = titulo
    .normalize('NFD')
    // Marcas de acentuação, que o `normalize` acabou de separar da letra.
    .replace(/\p{M}/gu, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  return limpo || 'anotacao'
}
