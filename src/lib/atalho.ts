/**
 * Como escrever um atalho de teclado na tela.
 *
 * O Life é um programa de Windows, mas a versão web abre em qualquer lugar — e
 * num Mac "Ctrl+B" está errado: lá é a tecla de comando. A troca é só no
 * rótulo; quem trata a tecla é o editor, que já entende as duas.
 */

const NO_MAC =
  typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.userAgent)

/** `mod+shift+s` vira `Ctrl+Shift+S` — ou `⌘⇧S` no Mac. */
export function atalho(teclas: string): string {
  const partes = teclas.split('+').map((parte) => parte.trim().toLowerCase())

  return partes
    .map((parte) => {
      if (parte === 'mod') return NO_MAC ? '⌘' : 'Ctrl'
      if (parte === 'shift') return NO_MAC ? '⇧' : 'Shift'
      if (parte === 'alt') return NO_MAC ? '⌥' : 'Alt'
      return parte.length === 1 ? parte.toUpperCase() : parte
    })
    .join(NO_MAC ? '' : '+')
}
