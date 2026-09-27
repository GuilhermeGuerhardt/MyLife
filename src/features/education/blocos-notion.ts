/**
 * Dois blocos que o Notion tem e faltavam aqui: o alternável e o destaque.
 *
 * **Alternável** é um título que esconde o que vem embaixo. Serve para o que
 * ocupa espaço e raramente se olha: a demonstração inteira de um teorema, a
 * lista de comandos, a explicação longa de um conceito. Sem ele, ou a anotação
 * fica gigante ou o detalhe é jogado fora.
 *
 * **Destaque** é o parágrafo que não pode passar batido — o aviso, a pegadinha
 * da prova, o "não esquecer". Uma cor de fundo faz o olho voltar nele.
 *
 * Os dois saem em HTML comum: `<details>/<summary>` e um `<blockquote>` com
 * classe. Nada de estrutura inventada — o `.docx`, o PDF e o `.txt` continuam
 * sabendo o que fazer com eles, e o arquivo exportado abre em qualquer lugar.
 */

import { Node, mergeAttributes } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

export const ALTERNAVEL = 'alternavel'
export const ALTERNAVEL_TITULO = 'alternavelTitulo'
export const DESTAQUE = 'destaque'

/**
 * O título do bloco alternável.
 *
 * Só texto: um título que aceitasse parágrafos e listas deixaria de ser título.
 */
export const AlternavelTitulo = Node.create({
  name: ALTERNAVEL_TITULO,
  content: 'inline*',
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'summary' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['summary', HTMLAttributes, 0]
  },

  addKeyboardShortcuts() {
    return {
      // Enter no título desce para o conteúdo. O comportamento padrão seria
      // tentar partir o título em dois — e um bloco com dois títulos não
      // existe, então a tecla simplesmente não fazia nada.
      Enter: () => {
        const { state, view } = this.editor
        const { $from } = state.selection

        // O atalho de um nó vale no documento inteiro, não só dentro dele.
        // Sem esta linha, todo Enter da anotação caía aqui: em vez de quebrar a
        // linha, o cursor pulava para o bloco seguinte. Só não acontecia no
        // último bloco do documento, onde a conta de destino estourava e a
        // tecla voltava ao comportamento normal.
        if ($from.parent.type.name !== this.name) return false

        const destino = $from.after() + 1
        if (destino > state.doc.content.size) return false

        view.dispatch(
          state.tr.setSelection(TextSelection.create(state.doc, destino)).scrollIntoView(),
        )
        return true
      },
    }
  },
})

export const Alternavel = Node.create({
  name: ALTERNAVEL,
  group: 'block',
  content: `${ALTERNAVEL_TITULO} block+`,
  defining: true,

  /**
   * Aberto ou fechado é parte da anotação, não do desenho da tela.
   *
   * Era só um atributo do HTML antes, e não funcionava: o clique fechava o
   * bloco, o ProseMirror redesenhava o nó no instante seguinte — qualquer tecla
   * digitada basta — e ele reabria sozinho. Guardado no documento, o estado
   * sobrevive à digitação, ao salvamento e à leitura.
   */
  addAttributes() {
    return {
      aberto: {
        default: true,
        parseHTML: (el) => el.hasAttribute('open'),
        renderHTML: (attrs) => (attrs.aberto ? { open: 'open' } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'details' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes(HTMLAttributes), 0]
  },

  addKeyboardShortcuts() {
    return {
      // Na vizinhança dos outros blocos: título é Mod-Alt-1..6, bloco de código
      // é Mod-Alt-C. `t` de alternável em inglês, que é onde a tecla nasceu.
      'Mod-Alt-t': () => this.editor.commands.insertContent(alternavelVazio()),
    }
  },

  /**
   * No editor, `<details>` não serve.
   *
   * O triângulo nativo do navegador abre e fecha por conta própria, por fora do
   * documento, e o ProseMirror desfaz isso no redesenho seguinte. Aqui a seta é
   * um botão de verdade, fora do conteúdo editável, e o clique dele é uma
   * alteração do documento como qualquer outra — inclusive desfazível.
   *
   * Clicar no título continua sendo clicar no título: coloca o cursor para
   * escrever, que é o que se espera de um texto.
   */
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const raiz = document.createElement('div')
      raiz.classList.add('alternavel')

      const seta = document.createElement('button')
      seta.type = 'button'
      seta.className = 'alternavel-seta'
      seta.contentEditable = 'false'
      seta.textContent = '▶'

      const corpo = document.createElement('div')
      corpo.className = 'alternavel-corpo'

      const desenhar = (aberto: boolean) => {
        raiz.dataset.aberto = String(aberto)
        seta.setAttribute('aria-expanded', String(aberto))
        seta.setAttribute('aria-label', aberto ? 'Recolher' : 'Abrir')
      }

      desenhar(Boolean(node.attrs.aberto))

      seta.addEventListener('mousedown', (evento) => {
        // Sem isto o clique tira o foco do editor antes de a alteração sair.
        evento.preventDefault()
      })

      seta.addEventListener('click', () => {
        const posicao = typeof getPos === 'function' ? getPos() : null
        if (posicao === null || posicao === undefined) return

        editor.view.dispatch(
          editor.view.state.tr.setNodeAttribute(posicao, 'aberto', !node.attrs.aberto),
        )
      })

      raiz.append(seta, corpo)

      return {
        dom: raiz,
        contentDOM: corpo,
        update(novo) {
          if (novo.type.name !== ALTERNAVEL) return false
          node = novo
          desenhar(Boolean(novo.attrs.aberto))
          return true
        },
        // A seta é nossa, não do documento: uma mudança nela não pode ser lida
        // como alguém tendo editado o texto.
        ignoreMutation: (mutacao) => !corpo.contains(mutacao.target),
      }
    }
  },
})

/** O parágrafo em destaque: mesma estrutura de uma citação, outra intenção. */
export const Destaque = Node.create({
  name: DESTAQUE,
  group: 'block',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'blockquote[data-destaque]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['blockquote', mergeAttributes(HTMLAttributes, { 'data-destaque': 'sim' }), 0]
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-d': () => this.editor.commands.insertContent(destaqueVazio()),
    }
  },
})

/** O conteúdo de um bloco alternável recém-criado. */
export function alternavelVazio(titulo = 'Clique na seta para recolher') {
  return {
    type: ALTERNAVEL,
    content: [
      { type: ALTERNAVEL_TITULO, content: [{ type: 'text', text: titulo }] },
      { type: 'paragraph' },
    ],
  }
}

export function destaqueVazio() {
  return { type: DESTAQUE, content: [{ type: 'paragraph' }] }
}
