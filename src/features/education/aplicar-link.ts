import type { Editor } from '@tiptap/react'

/**
 * Pede o endereço e aplica no trecho selecionado.
 *
 * Mora sozinha porque tem dois donos: o botão da barra e o `Ctrl+K` do editor.
 * Guardada em qualquer um dos dois, o outro teria de importar de volta.
 */
export function aplicarLink(editor: Editor) {
  const atual = editor.getAttributes('link').href as string | undefined
  const url = window.prompt('Endereço do link', atual ?? 'https://')
  if (url === null) return
  if (url.trim() === '') {
    editor.chain().focus().unsetLink().run()
    return
  }
  editor.chain().focus().setLink({ href: url.trim() }).run()
}
