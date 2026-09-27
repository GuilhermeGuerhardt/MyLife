/**
 * Duas janelas do Life olhando o mesmo banco.
 *
 * Cada janela é um navegador inteiro à parte: tem o próprio cache de consultas
 * e não faz ideia de que a outra existe. O banco é um só, então escrever numa
 * janela já grava para as duas — o que falta é a outra ficar sabendo. Sem isso,
 * a anotação escrita na janela destacada só aparece na principal depois de
 * fechar e abrir.
 *
 * O recado é um aviso de uma palavra: o nome da tabela que mudou. Quem recebe
 * decide o que fazer — na prática, relê aquela tabela.
 *
 * São dois mensageiros porque são dois mundos: no desktop, os eventos do Tauri,
 * que atravessam janelas nativas; no navegador, o `BroadcastChannel`, que
 * atravessa abas da mesma origem.
 */

import { isTauri } from '@tauri-apps/api/core'

const EVENTO = 'life:tabela-mudou'

let canal: BroadcastChannel | null = null

function canalDoNavegador(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  canal ??= new BroadcastChannel(EVENTO)
  return canal
}

/** Conta às outras janelas que esta tabela mudou. */
export function avisarMudanca(tabela: string): void {
  if (isTauri()) {
    // Sem `await`: quem acabou de gravar não espera o recado sair para seguir.
    // Falhar aqui não pode desfazer uma gravação que já aconteceu.
    void import('@tauri-apps/api/event')
      .then(({ emit }) => emit(EVENTO, tabela))
      .catch(() => undefined)
    return
  }

  try {
    canalDoNavegador()?.postMessage(tabela)
  } catch {
    // Sem canal, cada janela vive por conta. É pior, não é quebrado.
  }
}

/** Escuta o que as outras janelas mudaram. Devolve como parar de escutar. */
export function ouvirMudancas(aoMudar: (tabela: string) => void): () => void {
  if (isTauri()) {
    let parar: (() => void) | null = null
    let cancelado = false

    void import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen<string>(EVENTO, (evento) => aoMudar(evento.payload)),
      )
      .then((desfazer) => {
        // O componente pode ter desmontado enquanto a escuta era montada.
        if (cancelado) desfazer()
        else parar = desfazer
      })
      .catch(() => undefined)

    return () => {
      cancelado = true
      parar?.()
    }
  }

  const aberto = canalDoNavegador()
  if (!aberto) return () => undefined

  const ouvinte = (evento: MessageEvent<string>) => aoMudar(evento.data)
  aberto.addEventListener('message', ouvinte)
  return () => aberto.removeEventListener('message', ouvinte)
}
