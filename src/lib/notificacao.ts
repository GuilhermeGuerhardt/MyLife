/**
 * Avisos do sistema operacional: o balão no canto do Windows.
 *
 * No programa de desktop, pelo plugin de notificação do Tauri. No navegador,
 * pela API `Notification`, que funciona no Chrome e no Edge com a aba aberta.
 * Quem chama não precisa saber qual dos dois está por baixo.
 *
 * O plugin entra por `import()`: no navegador ele não existe, e importá-lo no
 * topo quebraria o app aberto ali.
 */

import { isTauri } from '@tauri-apps/api/core'

export type PermissaoDeAviso = 'concedida' | 'negada' | 'pendente' | 'indisponivel'

export async function permissaoDeAviso(): Promise<PermissaoDeAviso> {
  if (isTauri()) {
    try {
      const { isPermissionGranted } = await import('@tauri-apps/plugin-notification')
      return (await isPermissionGranted()) ? 'concedida' : 'pendente'
    } catch {
      return 'indisponivel'
    }
  }

  if (typeof Notification === 'undefined') return 'indisponivel'
  if (Notification.permission === 'granted') return 'concedida'
  if (Notification.permission === 'denied') return 'negada'
  return 'pendente'
}

/**
 * Pede a permissão. No navegador precisa vir de um clique: pedido feito sem
 * gesto da pessoa é recusado em silêncio.
 */
export async function pedirPermissaoDeAviso(): Promise<PermissaoDeAviso> {
  if (isTauri()) {
    try {
      const { requestPermission } = await import('@tauri-apps/plugin-notification')
      return (await requestPermission()) === 'granted' ? 'concedida' : 'negada'
    } catch {
      return 'indisponivel'
    }
  }

  if (typeof Notification === 'undefined') return 'indisponivel'
  const resposta = await Notification.requestPermission()
  return resposta === 'granted' ? 'concedida' : resposta === 'denied' ? 'negada' : 'pendente'
}

/**
 * Mostra um aviso. `aoClicar` só funciona no navegador: no Windows o plugin não
 * devolve o clique para a janela, e o aviso serve como lembrete.
 *
 * Nunca lança. Aviso que falhou não pode derrubar quem pediu, e não há o que a
 * tela fazer com o erro.
 */
export async function notificar(
  titulo: string,
  corpo: string,
  aoClicar?: () => void,
): Promise<void> {
  try {
    if (isTauri()) {
      const { sendNotification } = await import('@tauri-apps/plugin-notification')
      sendNotification({ title: titulo, body: corpo })
      return
    }

    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const aviso = new Notification(titulo, { body: corpo, icon: '/pwa-192.png' })
    if (aoClicar) {
      aviso.onclick = () => {
        window.focus()
        aoClicar()
        aviso.close()
      }
    }
  } catch {
    // Sem aviso desta vez: o próximo ciclo tenta de novo o que ainda valer.
  }
}
