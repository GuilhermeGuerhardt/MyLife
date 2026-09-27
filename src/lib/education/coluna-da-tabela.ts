/**
 * A largura que uma coluna de tabela precisa ter.
 *
 * O clique duplo na divisória faz o que o Excel faz: a coluna encolhe ou cresce
 * até caber o maior conteúdo dela. A medição dos textos é DOM, e fica na tela;
 * aqui está a decisão, que é onde estão os casos chatos — coluna vazia, coluna
 * com um parágrafo inteiro dentro de uma célula.
 */

/**
 * Abaixo disto a coluna vira um risco e não dá para clicar dentro dela.
 *
 * O mesmo número está no `min-width` de `th, td` em `index.css`, e os dois
 * precisam continuar iguais: com um piso maior lá, o ajuste grava uma largura
 * que a tela ignora e o clique duplo parece não fazer nada.
 */
export const LARGURA_MINIMA = 56

/**
 * Acima disto a tabela empurra as outras colunas para fora.
 *
 * Uma célula com um parágrafo inteiro pediria mil pixels, e ajustar por ela
 * espremeria todas as outras. Passando daqui, o texto volta a quebrar em várias
 * linhas — que é o comportamento certo para texto longo.
 */
export const LARGURA_MAXIMA = 420

/**
 * A maior das medidas, presa entre o mínimo e o máximo.
 *
 * Coluna sem nada escrito não colapsa: fica no mínimo, visível e clicável.
 */
export function larguraIdeal(medidas: readonly number[]): number {
  const maior = medidas.reduce((a, b) => Math.max(a, b), 0)
  return Math.round(Math.min(Math.max(maior, LARGURA_MINIMA), LARGURA_MAXIMA))
}

/**
 * Se a tabela tem alguma célula ocupando mais de uma coluna ou linha.
 *
 * O ajuste identifica a coluna pela posição da célula dentro da linha, e essa
 * conta deixa de valer assim que uma célula ocupa duas: da mesclagem para a
 * direita, a terceira célula de uma linha pode ser a quarta coluna da tabela.
 * Ajustar nesse caso mexeria na coluna errada sem avisar — melhor não mexer.
 *
 * O editor não oferece mesclar sem que se peça, mas o conteúdo colado de um
 * site e a tabela que vem de um `.docx` chegam com `colspan`, e a limpeza do
 * HTML deixa passar de propósito.
 */
export function temCelulaMesclada(tabela: HTMLTableElement): boolean {
  for (const linha of tabela.rows) {
    for (const celula of linha.cells) {
      if (celula.colSpan > 1 || celula.rowSpan > 1) return true
    }
  }
  return false
}
