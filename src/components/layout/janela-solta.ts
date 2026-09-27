/**
 * "Esta é a janela principal ou uma janela destacada?"
 *
 * A pergunta é da janela, não da rota. Marcar o endereço funcionava até a
 * pessoa navegar dentro da janela destacada — abrir o Caderno a partir do
 * Financeiro apagava a marca, e a janela voltava a se achar a principal.
 *
 * No desktop quem responde é o Tauri: a janela principal tem o rótulo `main`,
 * e as abertas pelo app começam com `janela`. No navegador, a resposta é ter
 * sido aberta por alguém — `window.opener` só existe em janela filha, e
 * continua existindo depois de navegar.
 *
 * Só duas coisas mudam por causa disso, e as duas para menos: o aviso de
 * atualização não aparece (instalar reinicia o app inteiro, e isso não se
 * oferece pela janela onde alguém está trabalhando) e o botão de destacar some,
 * porque destacar o que já está destacado não leva a lugar nenhum. O módulo em
 * si vem inteiro, com menu e todas as telas — uma janela sem por onde navegar é
 * um beco sem saída.
 */

import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

export function ehJanelaSecundaria(): boolean {
  if (isTauri()) {
    try {
      return getCurrentWindow().label !== 'main'
    } catch {
      // Sem resposta do lado nativo, o seguro é se tratar como principal: no
      // pior caso um aviso a mais, nunca um app sem aviso de atualização.
      return false
    }
  }

  return typeof window !== 'undefined' && window.opener !== null
}
