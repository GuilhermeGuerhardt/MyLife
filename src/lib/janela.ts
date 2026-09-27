/**
 * Abrir um pedaço do Life numa janela separada.
 *
 * Serve a duas coisas que só uma janela de verdade resolve: escrever com o
 * texto grande enquanto a janela principal mostra outra coisa, e arrastar essa
 * janela para o segundo monitor.
 *
 * No desktop é uma `WebviewWindow` do Tauri — janela do sistema operacional,
 * com barra de título, botão de fechar e arrastável entre telas. A API entra
 * por `import()` porque no navegador ela não existe e não pode nem ser
 * carregada.
 *
 * No navegador sobra `window.open`, que abre uma aba ou uma janela conforme a
 * configuração de quem está usando — menos controle, mesmo endereço.
 */

import { isTauri } from '@tauri-apps/api/core'
import { DESTINO } from './destino-da-janela'

export interface Janela {
  /** Caminho dentro do app, como `/janela/nota/abc`. */
  rota: string
  /** Vira o título da barra da janela no desktop. */
  titulo: string
  largura?: number
  altura?: number
}

/**
 * O rótulo identifica a janela para o Tauri: pedir de novo a mesma traz a que
 * já está aberta para a frente em vez de abrir uma segunda igual.
 */
function rotulo(rota: string): string {
  return `janela${rota.replace(/[^a-zA-Z0-9]+/g, '-')}`.slice(0, 60)
}

export async function abrirJanela({ rota, titulo, largura = 900, altura = 760 }: Janela): Promise<void> {
  if (!isTauri()) {
    window.open(rota, rotulo(rota), `popup=yes,width=${largura},height=${altura}`)
    return
  }

  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')

  const aberta = await WebviewWindow.getByLabel(rotulo(rota))
  if (aberta) {
    await aberta.unminimize()
    await aberta.setFocus()
    return
  }

  const janela = new WebviewWindow(rotulo(rota), {
    // Sempre `index.html`, com o destino no endereço. Apontar direto para
    // `/janela/nota/abc` funcionaria no modo de desenvolvimento, onde o Vite
    // devolve o index para qualquer caminho, e quebraria no app instalado, onde
    // o caminho é procurado entre os arquivos empacotados e não existe. Quem lê
    // o `ir` é `destino-da-janela`, antes de o roteador começar.
    url: `index.html?${DESTINO}=${encodeURIComponent(rota)}`,
    title: titulo,
    width: largura,
    height: altura,
    minWidth: 420,
    minHeight: 360,
    resizable: true,
    center: true,
  })

  // Falhar ao abrir não pode derrubar a tela que pediu: o botão simplesmente
  // não faz nada visível, e a janela principal continua inteira.
  janela.once('tauri://error', () => undefined)
}
