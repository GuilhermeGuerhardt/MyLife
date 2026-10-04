/**
 * Os parcelamentos em andamento: o que já está lançado em parcelas e ainda
 * tem parcela pela frente.
 *
 * Eles não são regras recorrentes, e não devem virar: as parcelas já existem
 * como lançamentos, uma em cada mês, e uma regra por cima lançaria cada mês
 * duas vezes. Mas para quem olha a vida financeira, a moto em 48 vezes e a
 * parcela da construtora são compromissos que se repetem, e a pessoa procura
 * por eles junto das recorrentes. Esta é a lista que faltava.
 */

import { toCompetence } from './billing'
import { chaveDoPadrao } from './recorrentes-do-extrato'
import { normalize } from '@/lib/quick-add/parser'
import { monthsBetween } from './reports'

export interface ParcelaLike {
  id: string
  description: string
  amount_cents: number
  date: string
  kind: 'income' | 'expense' | 'transfer'
  paid: boolean
  account_id: string
  installment_group_id: string | null
  installment_n: number | null
  installment_total: number | null
}

export interface Parcelamento {
  grupo: string
  description: string
  accountId: string
  kind: 'income' | 'expense' | 'transfer'
  /** Quantas parcelas o parcelamento tem. */
  total: number
  /** De quantos em quantos meses vem uma parcela: 1 é mensal, 12 é anual. */
  intervaloMeses: number
  /** A próxima parcela em aberto. */
  proxima: { numero: number; date: string; valorCents: number } | null
  /** O dia da última parcela. */
  ultimaData: string
  /** Quanto ainda falta pagar, e em quantas parcelas. */
  restanteCents: number
  restantes: number
}

/** O intervalo mais comum entre parcelas seguidas, em meses. */
function intervaloTipico(datas: string[]): number {
  if (datas.length < 2) return 1
  const contagem = new Map<number, number>()
  for (let i = 1; i < datas.length; i++) {
    const meses = Math.max(monthsBetween(datas[i - 1]!, datas[i]!), 1)
    contagem.set(meses, (contagem.get(meses) ?? 0) + 1)
  }
  return [...contagem].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0]
}

/**
 * Cada parcelamento que ainda tem parcela em aberto, da próxima a vencer para
 * a mais distante.
 *
 * O número da parcela vem do próprio lançamento, e não da posição na lista:
 * quem importou a partir da 5ª parcela tem "5 de 48" escrito ali, e a lista
 * começaria a contar do 1.
 */
export function parcelamentosEmAndamento<T extends ParcelaLike>(lancamentos: T[]): Parcelamento[] {
  const grupos = new Map<string, T[]>()
  for (const lancamento of lancamentos) {
    if (!lancamento.installment_group_id) continue
    grupos.set(lancamento.installment_group_id, [
      ...(grupos.get(lancamento.installment_group_id) ?? []),
      lancamento,
    ])
  }

  const lista: Parcelamento[] = []
  for (const [grupo, parcelas] of grupos) {
    const emOrdem = [...parcelas].sort((a, b) => a.date.localeCompare(b.date))
    const abertas = emOrdem.filter((parcela) => !parcela.paid)
    if (abertas.length === 0) continue

    const primeira = abertas[0]!
    lista.push({
      grupo,
      description: emOrdem.at(-1)!.description,
      accountId: primeira.account_id,
      kind: primeira.kind,
      total: Math.max(...emOrdem.map((parcela) => parcela.installment_total ?? 0), emOrdem.length),
      intervaloMeses: intervaloTipico(emOrdem.map((parcela) => parcela.date)),
      proxima: {
        numero: primeira.installment_n ?? emOrdem.indexOf(primeira) + 1,
        date: primeira.date,
        valorCents: primeira.amount_cents,
      },
      ultimaData: emOrdem.at(-1)!.date,
      restanteCents: abertas.reduce((soma, parcela) => soma + parcela.amount_cents, 0),
      restantes: abertas.length,
    })
  }

  return lista.sort(
    (a, b) => (a.proxima?.date ?? '').localeCompare(b.proxima?.date ?? '') || a.description.localeCompare(b.description),
  )
}

/** O que os parcelamentos cobram no mês: as parcelas que caem nele. */
export function parcelasDoMes<T extends ParcelaLike>(lancamentos: T[], hoje: string): number {
  const mes = toCompetence(hoje)
  return lancamentos
    .filter((lancamento) => lancamento.installment_group_id && toCompetence(lancamento.date) === mes)
    .reduce((soma, lancamento) => soma + lancamento.amount_cents, 0)
}

export interface RegraQueRepete {
  regraId: string
  /** O parcelamento que a regra repete. */
  description: string
  /** O dia da última parcela dele. */
  ultimaData: string
}

/**
 * Regras que repetem um parcelamento já lançado.
 *
 * Nascem de uma importação antiga: as parcelas vinham como linhas iguais, mês
 * a mês, e a sugestão de recorrente as tomava por conta mensal. A regra criada
 * começa depois da última parcela e não tem fim, então passaria a lançar a
 * cama, o celular e o curso para sempre, depois de quitados.
 *
 * Casa pelo nome e pelo valor da parcela, na mesma conta e no mesmo tipo.
 */
export function regrasQueRepetemParcelamento<T extends ParcelaLike>(
  regras: Array<{
    id: string
    description: string
    kind: 'income' | 'expense'
    amount_cents: number
    account_id: string
  }>,
  lancamentos: T[],
): RegraQueRepete[] {
  const grupos = new Map<string, T[]>()
  for (const lancamento of lancamentos) {
    if (!lancamento.installment_group_id) continue
    grupos.set(lancamento.installment_group_id, [
      ...(grupos.get(lancamento.installment_group_id) ?? []),
      lancamento,
    ])
  }

  const achadas: RegraQueRepete[] = []
  for (const regra of regras) {
    const chave = chaveDoPadrao(regra.description)
    if (!chave) continue
    for (const parcelas of grupos.values()) {
      const exemplo = parcelas[0]!
      const casa =
        exemplo.kind === regra.kind &&
        exemplo.account_id === regra.account_id &&
        chaveDoPadrao(exemplo.description) === chave &&
        parcelas.some(
          (parcela) => Math.abs(parcela.amount_cents - regra.amount_cents) <= regra.amount_cents * 0.01,
        )
      if (!casa) continue
      achadas.push({
        regraId: regra.id,
        description: exemplo.description,
        ultimaData: parcelas.map((parcela) => parcela.date).sort().at(-1)!,
      })
      break
    }
  }
  return achadas
}

/**
 * Os parcelamentos que respondem a uma busca.
 *
 * Pelo nome, e também pela frequência: quem procura "anuidade" ou "anual" quer
 * a parcela que vem uma vez por ano, que no extrato costuma ter o mesmo nome da
 * mensal ("Econ Construtora") e nunca seria achada pelo texto.
 */
export function parcelamentosDaBusca(lista: Parcelamento[], termo: string): Parcelamento[] {
  const procurado = normalize(termo)
  if (procurado.length < 2) return []
  const querAnual = /^anu/.test(procurado)
  return lista.filter(
    (item) =>
      normalize(item.description).includes(procurado) || (querAnual && item.intervaloMeses === 12),
  )
}
