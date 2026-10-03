/**
 * Achar, no extrato importado, o que se repete todo mês.
 *
 * Aluguel, assinatura, mensalidade e salário aparecem no arquivo como três,
 * seis, doze linhas iguais — e hoje viram três, seis, doze lançamentos soltos,
 * sem que o app saiba que são a mesma conta. Quem olha o extrato sabe em dois
 * segundos; o app tem a mesma informação na mão.
 *
 * O que este módulo **não** faz é criar a regra. Criar sozinho duplicaria o mês
 * seguinte na primeira oportunidade: a regra materializa um lançamento que a
 * própria importação acabou de gravar, e ninguém liga uma coisa à outra. Aqui a
 * saída é uma sugestão, para a tela perguntar — e a regra sugerida já começa no
 * mês seguinte ao último que veio no arquivo, pelo mesmo motivo.
 */

import { addMonths, toCompetence, type Competence } from './billing'

export interface LinhaDoExtrato {
  description: string
  amountCents: number
  date: string
  kind: 'income' | 'expense' | 'transfer'
  accountLabel: string
}

export interface RecorrenteSugerida {
  /** A descrição como ela aparece na linha mais recente. */
  description: string
  kind: 'income' | 'expense'
  accountLabel: string
  /** O valor típico: a mediana, que não se deixa levar por um mês fora da curva. */
  amountCents: number
  dayOfMonth: number
  /** Em quantos meses diferentes ela apareceu. */
  meses: number
  /** O valor variou mais que um décimo entre os meses — conta de luz, cartão. */
  valorVaria: boolean
  /** Primeiro dia em que a regra deve valer: o mês seguinte ao último visto. */
  startDate: string
}

/** Três meses é o mínimo para separar repetição de coincidência. */
const MIN_MESES = 3

/** O dia pode andar um pouco: fim de semana e feriado empurram o débito. */
const TOLERANCIA_DE_DIA = 4

/** Acima disto o valor não é "o mesmo de sempre" — mas ainda é recorrente. */
const VARIACAO_ACEITA = 0.1

/**
 * Agrupa pela descrição sem número, que é o que sobrevive de um mês para o
 * outro: "NETFLIX.COM 10/2026" e "NETFLIX.COM 11/2026" são a mesma assinatura.
 */
export function chaveDoPadrao(description: string): string {
  return description
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\d+/g, ' ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(' ')
}

export function sugerirRecorrentes(linhas: LinhaDoExtrato[]): RecorrenteSugerida[] {
  const grupos = new Map<string, LinhaDoExtrato[]>()

  for (const linha of linhas) {
    // Transferência entre contas suas não é conta a pagar, e parcela tem fim:
    // nenhuma das duas vira regra sem fim.
    if (linha.kind === 'transfer') continue
    const chave = `${linha.kind}:${chaveDoPadrao(linha.description)}`
    if (!chave.endsWith(':')) grupos.set(chave, [...(grupos.get(chave) ?? []), linha])
  }

  const sugestoes: RecorrenteSugerida[] = []

  for (const grupo of grupos.values()) {
    const porMes = new Map<Competence, LinhaDoExtrato>()
    for (const linha of grupo) {
      // Duas no mesmo mês: fica a primeira, que é a que marca o dia.
      const mes = toCompetence(linha.date)
      if (!porMes.has(mes)) porMes.set(mes, linha)
    }

    if (porMes.size < MIN_MESES) continue

    const ocorrencias = [...porMes.values()].sort((a, b) => a.date.localeCompare(b.date))
    if (!mesesSeguidos([...porMes.keys()])) continue

    const dias = ocorrencias.map((linha) => Number(linha.date.slice(8, 10)))
    const dia = mediana(dias)
    if (dias.some((valor) => Math.abs(valor - dia) > TOLERANCIA_DE_DIA)) continue

    const valores = ocorrencias.map((linha) => linha.amountCents)
    const tipico = mediana(valores)
    const ultima = ocorrencias[ocorrencias.length - 1]!

    sugestoes.push({
      description: ultima.description,
      kind: ultima.kind === 'income' ? 'income' : 'expense',
      accountLabel: ultima.accountLabel,
      amountCents: tipico,
      dayOfMonth: dia,
      meses: porMes.size,
      valorVaria: valores.some((valor) => Math.abs(valor - tipico) > tipico * VARIACAO_ACEITA),
      startDate: primeiroDiaDoMesSeguinte(ultima.date),
    })
  }

  return sugestoes.sort((a, b) => b.meses - a.meses || b.amountCents - a.amountCents)
}

/**
 * Meses seguidos, sem buraco.
 *
 * Três compras no mesmo lugar em janeiro, março e julho não são uma conta
 * mensal — são três idas ao mesmo lugar.
 */
function mesesSeguidos(meses: Competence[]): boolean {
  const ordenados = [...meses].sort()
  return ordenados.every(
    (mes, indice) => indice === 0 || mes === addMonths(ordenados[indice - 1]!, 1),
  )
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 === 0
    ? Math.round((ordenados[meio - 1]! + ordenados[meio]!) / 2)
    : ordenados[meio]!
}

function primeiroDiaDoMesSeguinte(isoDate: string): string {
  return `${addMonths(toCompetence(isoDate), 1)}-01`
}
