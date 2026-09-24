/**
 * Sublinhado que carrega cor.
 *
 * O do TipTap é liga-desliga: vira um `<u>` e pronto. Aqui ele guarda um
 * `text-decoration-color`, que é o que permite sublinhar em vermelho o que
 * precisa de atenção e em verde o que já foi conferido — a razão de o
 * sublinhado ter sido pedido com cor em vez de sozinho.
 *
 * Estende o original em vez de reescrever: atalho, comandos e colagem
 * continuam vindo de lá, e só o atributo é novo.
 */

import { Underline } from '@tiptap/extension-underline'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sublinhadoColorido: {
      /** Sublinha na cor pedida. `null` sublinha sem cor própria. */
      setUnderlineColor: (cor: string | null) => ReturnType
    }
  }
}

export const SublinhadoColorido = Underline.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      color: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.style.textDecorationColor || element.getAttribute('data-cor'),
        renderHTML: (attributes: Record<string, unknown>) => {
          const cor = attributes.color
          if (typeof cor !== 'string' || !cor) return {}
          // O `data-cor` acompanha o estilo: o DOMPurify da leitura pode
          // limpar o `style`, e é por ele que a cor volta.
          return {
            style: `text-decoration-color: ${cor}`,
            'data-cor': cor,
          }
        },
      },
    }
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setUnderlineColor:
        (cor: string | null) =>
        ({ chain }) =>
          // Liga o sublinhado junto: pedir a cor sem ter sublinhado é pedir
          // sublinhado colorido, não pintar um traço que não existe.
          chain().setUnderline().updateAttributes(this.name, { color: cor }).run(),
    }
  },
})
