/**
 * Quem te deve, e quanto.
 *
 * A pessoa é texto livre, então a mesma pessoa chega escrita de jeitos
 * diferentes: "Ana", "ana", "Ána ". Agrupar pelo texto cru partiria a dívida
 * dela em três linhas, e nenhuma delas mostraria o total de verdade.
 */

import { normalize } from '@/lib/quick-add/parser'

export interface ReceberLike {
  id: string
  person: string
  description: string
  amount_cents: number
  date: string
  received_at: string | null
}

/** A chave que junta as grafias da mesma pessoa. */
export function chaveDaPessoa(nome: string): string {
  return normalize(nome).replace(/\s+/g, ' ')
}

/**
 * Qual grafia mostrar: a com inicial maiúscula, e entre essas a mais recente.
 *
 * Só "a mais recente" mostrava "ana" no topo do cartão quando o último
 * registro foi digitado com pressa, e um nome em minúscula parece erro.
 */
function melhorGrafia(registros: ReceberLike[]): string {
  const emOrdem = [...registros].sort((a, b) => a.date.localeCompare(b.date))
  const capitalizadas = emOrdem.filter((item) => /^\p{Lu}/u.test(item.person.trim()))
  return (capitalizadas.at(-1) ?? emOrdem.at(-1)!).person.trim()
}

export interface DividaDaPessoa<T extends ReceberLike> {
  chave: string
  /** Como o nome aparece: ver `melhorGrafia`. */
  nome: string
  totalCents: number
  /** Do mais antigo ao mais novo: o que está esperando há mais tempo vem primeiro. */
  itens: T[]
}

/** O que está em aberto, por pessoa, de quem deve mais para quem deve menos. */
export function emAbertoPorPessoa<T extends ReceberLike>(itens: T[]): Array<DividaDaPessoa<T>> {
  const grupos = new Map<string, DividaDaPessoa<T>>()

  for (const item of itens) {
    if (item.received_at) continue
    const chave = chaveDaPessoa(item.person)
    const grupo = grupos.get(chave) ?? { chave, nome: item.person.trim(), totalCents: 0, itens: [] }
    grupo.totalCents += item.amount_cents
    grupo.itens.push(item)
    grupos.set(chave, grupo)
  }

  return [...grupos.values()]
    .map((grupo) => {
      const itensEmOrdem = [...grupo.itens].sort((a, b) => a.date.localeCompare(b.date))
      return { ...grupo, itens: itensEmOrdem, nome: melhorGrafia(itensEmOrdem) }
    })
    .sort((a, b) => b.totalCents - a.totalCents || a.nome.localeCompare(b.nome))
}

export function totalEmAberto(itens: ReceberLike[]): number {
  return itens.filter((item) => !item.received_at).reduce((soma, item) => soma + item.amount_cents, 0)
}

/** O que voltou no período, pela data em que voltou. */
export function recebidoEntre(itens: ReceberLike[], de: string, ate: string): number {
  return itens
    .filter((item) => item.received_at && item.received_at >= de && item.received_at <= ate)
    .reduce((soma, item) => soma + item.amount_cents, 0)
}

/**
 * Os nomes já usados, para o campo sugerir.
 *
 * Uma grafia por pessoa: sugerir as três variações de "Ana" é o que faz nascer
 * a quarta.
 */
export function pessoasConhecidas(itens: ReceberLike[]): string[] {
  const porChave = new Map<string, ReceberLike[]>()
  for (const item of itens) {
    const chave = chaveDaPessoa(item.person)
    porChave.set(chave, [...(porChave.get(chave) ?? []), item])
  }
  return [...porChave.values()].map(melhorGrafia).sort((a, b) => a.localeCompare(b))
}

/**
 * A parte de cada um numa conta dividida em partes iguais.
 *
 * O centavo que sobra fica com quem pagou: R$ 100,00 entre três é R$ 33,33 de
 * cada um que deve, e quem pagou arca com os R$ 33,34.
 */
export function parteDeCada(totalCents: number, pessoas: number): number {
  if (pessoas < 2) return totalCents
  return Math.floor(totalCents / pessoas)
}
