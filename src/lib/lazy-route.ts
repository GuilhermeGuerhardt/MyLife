/**
 * Rotas em lazy que sobrevivem a uma versão nova.
 *
 * O problema que isto resolve não aparece em desenvolvimento e é desagradável
 * em produção. Depois de um build novo, os chunks mudam de nome — o hash faz
 * parte da URL. Uma aba aberta desde antes continua executando o bundle antigo
 * na memória, e ele pede chunks que não existem mais em disco: a casca do app
 * segue funcionando (já está carregada) e **toda página interna dá branco**,
 * porque é o `import()` dela que falha.
 *
 * O service worker não salva: ele até se atualiza sozinho, mas a página que já
 * está rodando não recarrega por conta própria. Sem alguém para perceber a
 * falha e recarregar, o app fica quebrado até a pessoa apertar F5 — e nada na
 * tela sugere que era isso.
 *
 * A recuperação é em degraus, do mais barato para o mais invasivo, e cada
 * degrau só acontece se o anterior não resolveu.
 */

import { lazy, type ComponentType } from 'react'

/** Quantas tentativas de recuperação já foram gastas nesta aba. */
const STAGE_KEY = 'life:recuperacao-chunk'

/**
 * Falhou de novo dentro desta janela? Então a recuperação não funcionou.
 *
 * Sem esta trava, um chunk que simplesmente não existe mais colocaria o app num
 * laço de recarregamento — cada carga falha, recarrega, falha. Tela piscando
 * para sempre é pior do que uma mensagem de erro.
 */
const JANELA_MS = 20_000

interface Estado {
  degrau: number
  em: number
}

function lerEstado(): Estado {
  try {
    const cru = sessionStorage.getItem(STAGE_KEY)
    if (!cru) return { degrau: 0, em: 0 }
    const estado = JSON.parse(cru) as Estado
    // Passou da janela: a falha de agora não tem relação com a de antes.
    return Date.now() - estado.em > JANELA_MS ? { degrau: 0, em: 0 } : estado
  } catch {
    return { degrau: 0, em: 0 }
  }
}

function gravarEstado(degrau: number): void {
  try {
    sessionStorage.setItem(STAGE_KEY, JSON.stringify({ degrau, em: Date.now() }))
  } catch {
    // Navegação privada pode recusar o sessionStorage. Sem ele não há memória
    // entre tentativas, o que no pior caso significa um recarregamento a mais.
  }
}

function limparEstado(): void {
  try {
    sessionStorage.removeItem(STAGE_KEY)
  } catch {
    // Idem: não poder limpar não é motivo para derrubar a rota que acabou de
    // carregar com sucesso.
  }
}

/**
 * Descarta o service worker e tudo que ele guardou.
 *
 * Só no segundo degrau. Um recarregamento simples resolve o caso comum, em que
 * o worker novo já assumiu e só faltava a página reler o `index.html`. Quando
 * nem isso adianta, o cache é a única explicação que sobra.
 */
async function descartarCache(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registros = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registros.map((registro) => registro.unregister()))
    }
    if ('caches' in window) {
      const nomes = await caches.keys()
      await Promise.all(nomes.map((nome) => caches.delete(nome)))
    }
  } catch {
    // Falhar aqui não muda o plano: recarregar assim mesmo é a melhor aposta.
  }
}

/** Promessa que nunca resolve — a página está sendo trocada, não há o que esperar. */
function aguardandoRecarga<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

/**
 * Como `React.lazy`, mas se recuperando de chunk que sumiu.
 *
 * Degrau 1 recarrega a página. Degrau 2 limpa service worker e caches antes de
 * recarregar. Depois disso o erro sobe para o `RouteBoundary`, que mostra uma
 * mensagem em vez de deixar a tela vazia.
 */
/*
 * A assinatura é a mesma de `React.lazy`, `ComponentType<any>` inclusive.
 * Trocar por um genérico nas props parece mais rigoroso e quebra a inferência
 * no site de chamada: `import(...).then(m => ({ default: m.Página }))` passa a
 * inferir `never` para as props e nenhuma rota compila.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyRoute<T extends ComponentType<any>>(
  carregar: () => Promise<{ default: T }>,
) {
  return lazy(async (): Promise<{ default: T }> => {
    try {
      const modulo = await carregar()
      // Chegou aqui: o que quer que estivesse errado, passou.
      limparEstado()
      return modulo
    } catch (erro) {
      const { degrau } = lerEstado()

      if (degrau === 0) {
        gravarEstado(1)
        window.location.reload()
        return aguardandoRecarga<{ default: T }>()
      }

      if (degrau === 1) {
        gravarEstado(2)
        await descartarCache()
        window.location.reload()
        return aguardandoRecarga<{ default: T }>()
      }

      throw erro
    }
  })
}
