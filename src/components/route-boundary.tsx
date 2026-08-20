/**
 * O que aparece quando uma rota não carrega.
 *
 * Existe para que o pior caso seja uma mensagem com um botão, e não a tela
 * branca — que é indistinguível de "o app morreu" e não sugere nenhuma saída.
 * `lazyRoute` já tentou recarregar e já tentou limpar o cache; se o erro chegou
 * até aqui, as duas falharam e só resta contar isso à pessoa.
 *
 * Precisa ser classe: `componentDidCatch` não tem equivalente em hook.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  erro: Error | null
}

export class RouteBoundary extends Component<Props, State> {
  state: State = { erro: null }

  static getDerivedStateFromError(erro: Error): State {
    return { erro }
  }

  componentDidCatch(erro: Error, info: ErrorInfo): void {
    // Sem servidor para receber log, o console é o único lugar onde o rastro
    // sobrevive para alguém colar num relato depois.
    console.error('[life] rota falhou:', erro, info.componentStack)
  }

  private limparTudo = async (): Promise<void> => {
    try {
      if ('serviceWorker' in navigator) {
        const registros = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registros.map((registro) => registro.unregister()))
      }
      if ('caches' in window) {
        const nomes = await caches.keys()
        await Promise.all(nomes.map((nome) => caches.delete(nome)))
      }
    } finally {
      // Nenhum dado do app mora em cache — eles ficam no localStorage, na pasta
      // de trabalho ou no Supabase. Limpar aqui não perde nada.
      window.location.href = '/'
    }
  }

  render(): ReactNode {
    const { erro } = this.state
    if (!erro) return this.props.children

    return (
      <div className="flex min-h-[60dvh] items-center justify-center p-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-fg text-lg font-semibold">Esta página não carregou</h1>
          <p className="text-fg-muted text-sm">
            Normalmente é uma versão antiga do app presa no navegador — acontece logo depois de
            uma atualização. Limpar o cache resolve, e nenhum dado seu é perdido nisso.
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Tentar de novo
            </Button>
            <Button onClick={this.limparTudo}>Limpar cache e recarregar</Button>
          </div>
          <p className="text-fg-subtle text-xs">{erro.message}</p>
        </div>
      </div>
    )
  }
}
