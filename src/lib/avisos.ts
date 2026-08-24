/**
 * Confirmações do app.
 *
 * No programa de desktop eles saem como janela nativa do Windows, pelo plugin
 * de diálogo do Tauri. O `confirm()` do navegador continua existindo como
 * reserva para quando o Life roda no browser — e só para isso: dentro da
 * WebView2 ele aparece como caixa do webview, com o endereço interno no título,
 * que é o que faz um programa instalado parecer uma página aberta.
 *
 * A permissão `dialog:allow-confirm` já estava concedida em
 * `src-tauri/capabilities/default.json`.
 */

import { isTauri } from '@tauri-apps/api/core'

/** Título das janelas — é o nome que aparece na barra do diálogo nativo. */
const TITULO = 'Life'

export type TomAviso = 'info' | 'warning' | 'error'

export interface OpcoesConfirmacao {
  /** Texto do botão que segue adiante. */
  confirmar?: string
  /** Texto do botão que desiste. */
  cancelar?: string
  tom?: TomAviso
  titulo?: string
}

/**
 * Pergunta e devolve a resposta.
 *
 * Assíncrona mesmo no navegador: o `window.confirm` responde na hora, mas
 * padronizar a assinatura evita que o dia da troca de um caminho pelo outro
 * exija reescrever quem chama.
 */
export async function confirmar(
  mensagem: string,
  opcoes: OpcoesConfirmacao = {},
): Promise<boolean> {
  if (isTauri()) {
    try {
      const { confirm } = await import('@tauri-apps/plugin-dialog')
      return await confirm(mensagem, {
        title: opcoes.titulo ?? TITULO,
        kind: opcoes.tom ?? 'warning',
        okLabel: opcoes.confirmar,
        cancelLabel: opcoes.cancelar,
      })
    } catch {
      // Plugin indisponível não pode virar exclusão sem pergunta: cai para o
      // diálogo do webview, que ao menos pergunta.
    }
  }

  return window.confirm(mensagem)
}
