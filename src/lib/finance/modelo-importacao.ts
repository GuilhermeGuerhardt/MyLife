/**
 * O arquivo de exemplo que a pessoa baixa para preencher.
 *
 * Quem exporta de outro app quase sempre descobre o formato por tentativa: leva
 * o arquivo, a prévia recusa metade das linhas, volta, corrige, tenta de novo.
 * O modelo troca isso por um arquivo que já entra — a pessoa apaga as linhas de
 * exemplo, põe as suas e reconhece a forma de cada campo pelo que está escrito
 * ali.
 *
 * As linhas não são decorativas. Cada uma mostra um caso que o importador trata
 * de um jeito diferente: parcelamento escrito no nome, transferência com conta
 * de destino, lançamento ainda em aberto. E o teste passa este mesmo conteúdo
 * pelo importador de verdade — o modelo que não importa limpo quebra a suíte,
 * em vez de quebrar na mão de quem baixou.
 */

import { IMPORT_HEADER, toCsvFile } from './export'

export const MODELO_NOME = 'life-modelo-importacao.csv'

/**
 * As linhas do modelo, datadas no mês que a pessoa está vivendo.
 *
 * Data fixa envelheceria: um modelo baixado em 2027 com exemplos de 2026 parece
 * arquivo esquecido, e a pessoa fica na dúvida se a data importa. Todos os dias
 * usados vão até 28, que todo mês tem.
 */
export function linhasDoModelo(hoje: string): string[][] {
  const mes = hoje.slice(0, 7)
  const dia = (numero: string) => {
    const [ano, m] = mes.split('-')
    return `${numero}/${m}/${ano}`
  }

  return [
    [...IMPORT_HEADER],
    [dia('05'), '4.200,00', 'Receita', 'Salário', '', 'Conta Corrente', '', 'Salário', 'Pago'],
    [
      dia('06'),
      '129,90',
      'Despesa',
      'Mercado do bairro',
      'compras da semana',
      'Conta Corrente',
      '',
      'Mercado',
      'Pago',
    ],
    // A parcela mora no nome, entre parênteses: é assim que o importador a
    // reconhece e transforma em parcelamento de verdade.
    [dia('12'), '208,25', 'Despesa', 'Geladeira (5/48)', '', 'Cartão', '', 'Casa', 'Pago'],
    // Transferência é a única linha que usa a coluna Destino. Sem ela o dinheiro
    // sai de uma conta e não chega em lugar nenhum.
    [dia('15'), '500,00', 'Transferência', 'Guardar', '', 'Conta Corrente', 'Poupança', '', 'Pago'],
    [dia('28'), '89,90', 'Despesa', 'Internet', '', 'Conta Corrente', '', 'Casa', 'Em aberto'],
  ]
}

/** O modelo pronto para salvar, com BOM e ponto e vírgula, como o Excel espera. */
export function modeloDeImportacao(hoje: string): string {
  return toCsvFile(linhasDoModelo(hoje))
}
