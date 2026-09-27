import type { Node as NoDoDocumento } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/react'
import { useEffect } from 'react'
import { larguraIdeal, temCelulaMesclada } from '@/lib/education/coluna-da-tabela'

/**
 * Clique duplo na divisória ajusta a coluna ao conteúdo, como na planilha.
 *
 * A divisória é a alça que o ProseMirror desenha ao encostar o mouse na borda
 * da célula, e o clique duplo nela não fazia nada. Arrastar continua sendo o
 * ajuste fino; o clique duplo é o "cabe tudo, e nem um pixel a mais".
 */

/** A tabela que contém a posição dada, com a posição dela no documento. */
function tabelaEm(editor: Editor, posicao: number): { node: NoDoDocumento; pos: number } | null {
  const $pos = editor.state.doc.resolve(posicao)
  for (let nivel = $pos.depth; nivel > 0; nivel--) {
    const node = $pos.node(nivel)
    if (node.type.name === 'table') return { node, pos: $pos.before(nivel) }
  }
  return null
}

/** Quanto o texto de cada célula da coluna ocupa, com o recheio dos dois lados. */
function medirCelulas(tabela: HTMLTableElement, coluna: number): number[] {
  const regua = document.createElement('span')
  regua.style.position = 'absolute'
  regua.style.top = '-9999px'
  regua.style.visibility = 'hidden'
  // `pre` para a régua não quebrar linha sozinha: a largura que sai é a da
  // maior linha do conteúdo, que é o que precisa caber.
  regua.style.whiteSpace = 'pre'
  document.body.append(regua)

  const larguras: number[] = []
  try {
    for (const linha of tabela.rows) {
      const celula = linha.cells[coluna]
      if (!celula) continue
      const estilo = getComputedStyle(celula)
      // O cabeçalho é mais gordo que o corpo: medir cada célula com a fonte
      // dela evita a coluna que corta justamente o título.
      regua.style.font = `${estilo.fontStyle} ${estilo.fontWeight} ${estilo.fontSize} / ${estilo.lineHeight} ${estilo.fontFamily}`
      regua.textContent = celula.innerText
      const recheio = Number.parseFloat(estilo.paddingLeft) + Number.parseFloat(estilo.paddingRight)
      larguras.push(regua.getBoundingClientRect().width + recheio + 2)
    }
  } finally {
    regua.remove()
  }

  return larguras
}

/** Grava a largura em todas as células da coluna, que é onde ela mora. */
function gravarLargura(
  editor: Editor,
  tabela: NoDoDocumento,
  tabelaPos: number,
  coluna: number,
  largura: number,
): void {
  const { tr } = editor.state
  let posicao = tabelaPos + 1

  for (let l = 0; l < tabela.childCount; l++) {
    const linha = tabela.child(l)
    let celula = posicao + 1
    for (let c = 0; c < linha.childCount; c++) {
      const no = linha.child(c)
      // Trocar atributo não muda o tamanho do nó, então as posições seguintes
      // continuam valendo sem remapear.
      if (c === coluna) tr.setNodeMarkup(celula, undefined, { ...no.attrs, colwidth: [largura] })
      celula += no.nodeSize
    }
    posicao += linha.nodeSize
  }

  editor.view.dispatch(tr)
}

/** Folga em volta da alça, em pixels: ela tem 4 de largura e mira do mouse erra. */
const FOLGA = 6

/**
 * Se o clique caiu em cima da divisória, e não em outro canto do documento.
 *
 * Quem confere a altura é a tabela, não a alça: o ProseMirror desenha a alça na
 * célula da primeira linha, e exigir o clique dentro dela fazia o ajuste
 * funcionar no cabeçalho e ignorar o clique em qualquer linha abaixo. Na
 * horizontal é que ela vale, porque é ali que a divisória está.
 */
function pertoDaAlca(evento: MouseEvent, alca: Element, tabela: Element): boolean {
  const caixa = alca.getBoundingClientRect()
  const limite = tabela.getBoundingClientRect()
  return (
    evento.clientX >= caixa.left - FOLGA &&
    evento.clientX <= caixa.right + FOLGA &&
    evento.clientY >= limite.top &&
    evento.clientY <= limite.bottom
  )
}

/** Janela entre os dois cliques, em milissegundos. */
const INTERVALO = 450

/** Liga o ouvinte num editor já montado e devolve como desligá-lo. */
function ouvirCliques(editor: Editor): () => void {
  const area = editor.view.dom
  let anterior = 0

  const aoPressionar = (evento: Event) => {
    if (!(evento instanceof MouseEvent)) return

    // A alça que o ProseMirror desenha na borda não recebe clique — ela é
    // `pointer-events: none`, e quem responde ao mouse é a célula debaixo.
    // Então o alvo do evento não diz se o clique foi na divisória: quem diz é a
    // alça existir, o que só acontece com o ponteiro encostado na borda. E ela
    // também diz qual é a coluna.
    const alca = area.querySelector('.column-resize-handle')
    const celula = alca?.closest('td, th')
    const tabelaDom = celula?.closest('table')
    if (!alca || !celula || !tabelaDom || !pertoDaAlca(evento, alca, tabelaDom)) {
      anterior = 0
      return
    }

    const dobro = evento.timeStamp - anterior < INTERVALO
    // Zerar no par evita que um terceiro clique conte como um segundo ajuste.
    anterior = dobro ? 0 : evento.timeStamp
    if (!dobro) return

    // Segurar o segundo clique impede o ProseMirror de começar outro arrasto:
    // ele gravaria a largura de antes ao soltar o botão, por cima do ajuste.
    // De quebra, some a palavra que o navegador marcaria sozinha.
    evento.preventDefault()
    evento.stopPropagation()

    // Numa tabela com célula mesclada a coluna não é mais a posição da célula
    // na linha, e o ajuste cairia na coluna errada. Não fazer nada é o menos
    // pior: o arrasto continua disponível para ajustar na mão.
    if (temCelulaMesclada(tabelaDom)) return

    const tabela = tabelaEm(editor, editor.view.posAtDOM(tabelaDom, 0))
    if (!tabela) return

    // A divisória mora na célula da esquerda, e é essa coluna que o Excel
    // ajusta quando se dá o clique duplo na linha entre duas colunas.
    const coluna = (celula as HTMLTableCellElement).cellIndex
    gravarLargura(
      editor,
      tabela.node,
      tabela.pos,
      coluna,
      larguraIdeal(medirCelulas(tabelaDom, coluna)),
    )
  }

  /*
    O par de cliques é contado aqui, em vez de se esperar o `dblclick`.

    O primeiro clique faz o ProseMirror gravar a largura atual da coluna, e com
    isso o editor troca a célula no DOM. O alvo do primeiro clique deixa de
    existir antes do segundo, e aí o navegador simplesmente não dispara o
    `dblclick` — nem no documento. Era isso que fazia o ajuste responder num
    clique e no seguinte não, sem padrão aparente.

    Ouvir o documento inteiro só é seguro porque quem decide não é o alvo do
    evento: é a alça existir dentro deste editor e o clique cair em cima dela.
  */
  document.addEventListener('mousedown', aoPressionar, true)
  return () => document.removeEventListener('mousedown', aoPressionar, true)
}

export function useAjusteAoConteudo(editor: Editor | null): void {
  useEffect(() => {
    if (!editor) return

    /*
      `editor.view` não é um campo: é um acesso que **lança** enquanto o editor
      não terminou de montar. O objeto existir não garante a vista pronta — e
      com o editor descendo sob demanda, o efeito passou a rodar antes disso e
      derrubava a tela do Caderno inteira.

      Por isso o ouvinte espera o evento `create` quando chega cedo demais.
    */
    let desligar: (() => void) | undefined
    const ligar = () => {
      if (!editor.isDestroyed) desligar = ouvirCliques(editor)
    }

    if (editor.isInitialized) ligar()
    else editor.on('create', ligar)

    return () => {
      editor.off('create', ligar)
      desligar?.()
    }
  }, [editor])
}
