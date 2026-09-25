/**
 * O que o arquivo traz e o app já tem.
 *
 * A parte com mais regra de negócio do importador, e por isso separada: são
 * três formas de reconhecer o mesmo lançamento, cada uma existindo por um
 * motivo que só aparece com o extrato na mão.
 */

import { normalizeText } from './import-colunas'
import type { ImportRow } from './import-linhas'

export interface ExistingLike {
  date: string
  amount_cents: number
  description: string
  kind: 'income' | 'expense' | 'transfer'
  /** Parcela, quando o lançamento faz parte de um parcelamento. */
  installment_n?: number | null
  installment_total?: number | null
  /** Preenchido quando quem criou o lançamento foi uma regra de recorrência. */
  recurring_id?: string | null
}

/**
 * Identidade de um lançamento para fins de repetição.
 *
 * Data, valor, tipo e descrição normalizada. Sem a conta de propósito: o mesmo
 * extrato reimportado depois de a pessoa ter renomeado a conta continua sendo
 * o mesmo lançamento, e duplicar seria pior do que deixar passar.
 */
export function dedupKey(row: {
  date: string
  amountCents: number
  description: string
  kind: string
}): string {
  return [row.date, row.amountCents, row.kind, normalizeText(row.description)].join('|')
}

/**
 * A parcela, sem a data: `Geladeira` 5 de 48 é uma só no mundo.
 *
 * O app guarda as 48 parcelas na data da compra, porque é o que ele sabe na
 * hora de registrar; o extrato traz cada uma no dia em que foi debitada. São a
 * mesma parcela com datas diferentes, e é por isso que a data fica de fora.
 */
function chaveDaParcela(descricao: string, n: number, total: number): string {
  return [normalizeText(descricao), n, total].join('|')
}

/**
 * A previsão de um recorrente: mês, valor, tipo e descrição.
 *
 * Também sem o dia. A regra de recorrência cria o lançamento no dia do
 * vencimento, que é um palpite; o extrato traz o dia em que a conta de fato
 * saiu. Um dia de diferença não faz duas assinaturas do Streaming.
 */
function chaveDaPrevisao(
  descricao: string,
  centavos: number,
  tipo: string,
  data: string,
): string {
  return [data.slice(0, 7), centavos, tipo, normalizeText(descricao)].join('|')
}

/**
 * Marca o que já existe no app e o que se repete dentro do próprio arquivo.
 *
 * Três formas de reconhecer o que já está lá, da mais exata para a mais
 * tolerante — e cada lançamento do app só pode ser reconhecido uma vez, para
 * duas linhas do arquivo não casarem com a mesma cobrança:
 *
 * 1. **Igual**: mesma data, valor, tipo e descrição.
 * 2. **Mesma parcela**: `Geladeira (5/48)` acha a parcela 5 de 48 que o app
 *    guardou na data da compra.
 * 3. **Previsão de recorrente**: a assinatura que a regra criou no dia do
 *    vencimento acha a mesma cobrança no dia em que ela saiu de verdade.
 *
 * As duas últimas existem porque o app cria esses lançamentos **antes** de o
 * extrato existir, e com a data que ele podia saber na época. Comparando só
 * pela data exata, toda parcela e toda assinatura entrava de novo — que é
 * exatamente como o caderno de alguém acaba com tudo em dobro.
 *
 * Contagem, e não conjunto, porque repetição legítima acontece: duas viagens de
 * metrô de R$ 5,40 no mesmo dia são dois lançamentos. Só a partir da terceira
 * ocorrência, quando o app já tem duas, é que sobra duplicata.
 */
export function markDuplicates(rows: ImportRow[], existing: ExistingLike[]): ImportRow[] {
  const usado = new Array<boolean>(existing.length).fill(false)

  const iguais = new Map<string, number[]>()
  const parcelas = new Map<string, number[]>()
  const previsoes = new Map<string, number[]>()

  const indexar = (mapa: Map<string, number[]>, chave: string, posicao: number) => {
    const lista = mapa.get(chave)
    if (lista) lista.push(posicao)
    else mapa.set(chave, [posicao])
  }

  existing.forEach((item, posicao) => {
    indexar(
      iguais,
      dedupKey({
        date: item.date,
        amountCents: item.amount_cents,
        description: item.description,
        kind: item.kind,
      }),
      posicao,
    )

    if (item.installment_n && item.installment_total) {
      indexar(
        parcelas,
        chaveDaParcela(item.description, item.installment_n, item.installment_total),
        posicao,
      )
    }

    // Só o que a recorrência criou. Um lançamento digitado à mão tem data
    // porque alguém a escolheu, e casar por mês ali marcaria como repetido o
    // segundo almoço de R$ 42 do mês.
    if (item.recurring_id) {
      indexar(
        previsoes,
        chaveDaPrevisao(item.description, item.amount_cents, item.kind, item.date),
        posicao,
      )
    }
  })

  /** O primeiro lançamento ainda não reconhecido sob esta chave. */
  const reservar = (mapa: Map<string, number[]>, chave: string): boolean => {
    const lista = mapa.get(chave)
    const posicao = lista?.find((i) => !usado[i])
    if (posicao === undefined) return false
    usado[posicao] = true
    return true
  }

  const noArquivo = new Map<string, number>()

  return rows.map((row) => {
    if (row.error) return row

    const chave = dedupKey(row)
    const repetidaNoArquivo = (noArquivo.get(chave) ?? 0) > 0

    const jaExiste =
      reservar(iguais, chave) ||
      (row.installment !== null &&
        reservar(
          parcelas,
          chaveDaParcela(row.description, row.installment.n, row.installment.total),
        )) ||
      reservar(
        previsoes,
        chaveDaPrevisao(row.description, row.amountCents, row.kind, row.date),
      )

    if (jaExiste) return { ...row, duplicate: true }

    noArquivo.set(chave, (noArquivo.get(chave) ?? 0) + 1)
    return { ...row, repeated: repetidaNoArquivo }
  })
}
