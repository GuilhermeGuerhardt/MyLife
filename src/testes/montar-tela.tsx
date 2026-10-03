import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'

/**
 * Monta uma tela como o app monta: com o cache de dados e o roteador em volta.
 *
 * Existe porque os testes de função pura não pegam a classe de erro que mais
 * aparece aqui — prop que falta, componente que lê `undefined`, tela que quebra
 * com a lista vazia. Nada disso aparece em `tsc` nem em teste de cálculo, e
 * aparece na cara de quem abre o app.
 *
 * O armazenamento é o `localStorage` do ambiente de teste: fora do Tauri, é o
 * destino que o próprio app escolhe, então o caminho exercitado é o de verdade.
 */
export function montarTela(tela: ReactElement, rota = '/'): RenderResult {
  const client = new QueryClient({
    defaultOptions: {
      // Em teste, repetir uma consulta que falhou só adia o erro.
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[rota]}>{tela}</MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Guarda linhas direto no armazenamento, como se já estivessem gravadas. */
export function semear(tabela: string, linhas: Array<Record<string, unknown>>): void {
  const agora = '2026-10-01T12:00:00.000Z'
  const comMeta = linhas.map((linha, indice) => ({
    id: `${tabela}-${indice}`,
    created_at: agora,
    updated_at: agora,
    ...linha,
  }))
  localStorage.setItem(`life:table:${tabela}`, JSON.stringify(comMeta))
}

/** Zera o armazenamento entre um teste e outro. */
export function limparArmazenamento(): void {
  localStorage.clear()
}
