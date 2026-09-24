/**
 * A máquina de estados da importação em segundo plano.
 *
 * Fora do React de propósito. São poucas transições, mas cada uma tem uma
 * regra que só aparece quando se lê todas juntas — o "x" que esconde em vez de
 * cancelar, o progresso atrasado que não pode ressuscitar a barra depois do
 * fim, o recibo que só é marcado como visto uma vez. Escritas soltas dentro de
 * um componente, essas regras não têm como ser testadas e a primeira delas já
 * escapou: `marcarVisto` devolvia um estado novo mesmo quando nada mudava, e a
 * tela que o chamava entrava em laço de render.
 *
 * Daí a regra que vale para o arquivo inteiro: **quando nada muda, devolver o
 * mesmo objeto**. É isso que faz o React parar.
 */

import type { ImportPlan, ImportProgress, ImportResult } from './use-import'

export type EstadoDaImportacao =
  | { kind: 'parado' }
  | {
      kind: 'rodando'
      arquivo: string
      /** O que gravar. É daqui que o executor sai montado. */
      plano: ImportPlan
      progresso: ImportProgress
      /** O cartão do canto foi fechado. A gravação continua. */
      oculto: boolean
    }
  | {
      kind: 'concluido'
      arquivo: string
      resultado: ImportResult
      /** Alguém já viu o recibo — na tela de Planilhas ou no cartão. */
      visto: boolean
    }
  | { kind: 'erro'; arquivo: string; mensagem: string }

export type AcaoDaImportacao =
  | { tipo: 'comecar'; arquivo: string; plano: ImportPlan }
  | { tipo: 'progresso'; progresso: ImportProgress }
  | { tipo: 'concluir'; resultado: ImportResult }
  | { tipo: 'falhar'; mensagem: string }
  /** O "x" do cartão. Quer dizer coisas diferentes em cada estado. */
  | { tipo: 'fechar' }
  | { tipo: 'marcar-visto' }

export const PARADO: EstadoDaImportacao = { kind: 'parado' }

export function reduzir(
  estado: EstadoDaImportacao,
  acao: AcaoDaImportacao,
): EstadoDaImportacao {
  switch (acao.tipo) {
    case 'comecar':
      // Duas gravações ao mesmo tempo criariam a mesma conta duas vezes e
      // deixariam duas barras andando sobre o mesmo banco. A tela também
      // desabilita o botão; esta é a garantia que não depende da tela.
      if (estado.kind === 'rodando') return estado
      return {
        kind: 'rodando',
        arquivo: acao.arquivo,
        plano: acao.plano,
        progresso: { done: 0, total: 0 },
        oculto: false,
      }

    case 'progresso':
      // Só enquanto está rodando. O aviso de andamento sai em transição, de
      // prioridade mais baixa que o aviso de fim: um progresso pode chegar
      // depois do resultado, e sem esta guarda a barra voltaria a aparecer
      // sobre uma importação que já acabou.
      if (estado.kind !== 'rodando') return estado
      return { ...estado, progresso: acao.progresso }

    case 'concluir':
      if (estado.kind !== 'rodando') return estado
      return { kind: 'concluido', arquivo: estado.arquivo, resultado: acao.resultado, visto: false }

    case 'falhar':
      if (estado.kind !== 'rodando') return estado
      return { kind: 'erro', arquivo: estado.arquivo, mensagem: acao.mensagem }

    case 'fechar':
      // Fechar o cartão de uma gravação em curso esconde o cartão e mais nada:
      // metade das linhas dentro e metade fora é o pior resultado possível, e
      // não é o que um "x" deve significar. Nos outros estados, encerra.
      if (estado.kind === 'rodando') return estado.oculto ? estado : { ...estado, oculto: true }
      return estado.kind === 'parado' ? estado : PARADO

    case 'marcar-visto':
      if (estado.kind !== 'concluido' || estado.visto) return estado
      return { ...estado, visto: true }
  }
}
