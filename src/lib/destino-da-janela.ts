/**
 * Para onde a janela recém-aberta deve ir.
 *
 * Uma janela nova do Tauri carrega `index.html` — é o único caminho que existe
 * com certeza dentro do app empacotado. O destino viaja no endereço, e aqui ele
 * é transformado de volta em rota antes de o roteador ler a barra de endereços.
 *
 * Roda uma vez, no arranque, antes do primeiro render: depois disso o
 * `BrowserRouter` já teria lido `/index.html` e caído na tela inicial.
 */

export const DESTINO = 'ir'

export function aplicarDestinoDaJanela(): void {
  const rota = new URLSearchParams(window.location.search).get(DESTINO)
  if (!rota || !rota.startsWith('/')) return

  // `replaceState` e não `assign`: trocar o endereço sem recarregar mantém o
  // arranque em um passo só, e a janela não pisca a tela inicial antes.
  window.history.replaceState(null, '', rota)
}
