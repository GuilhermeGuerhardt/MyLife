/**
 * Achar, no extrato, o que se repete todo mês.
 *
 * Aluguel, assinatura, mensalidade, salário e parcela de financiamento aparecem
 * como três, seis, doze linhas parecidas, e viram lançamentos soltos sem que o
 * app saiba que são a mesma conta. Quem olha o extrato sabe em dois segundos; o
 * app tem a mesma informação na mão.
 *
 * Serve a dois momentos: a importação (só as linhas do arquivo) e o histórico
 * (tudo o que já está gravado). O segundo existe porque a primeira não pega
 * tudo: quem importou antes desta detecção, ou em pedaços, ficava sem a
 * sugestão para sempre.
 *
 * O que este módulo **não** faz é criar a regra. Criar sozinho duplicaria o mês
 * seguinte na primeira oportunidade. A saída é uma sugestão, e a regra
 * sugerida começa no mês seguinte ao último visto, pelo mesmo motivo.
 */

import { addMonths, dateInCompetence, toCompetence, type Competence } from './billing'
import { monthsBetween } from './reports'
import { normalize } from '@/lib/quick-add/parser'

export interface Ocorrencia {
  description: string
  amountCents: number
  date: string
  kind: 'income' | 'expense' | 'transfer'
}

/** A parcela da ocorrência mais recente: "18 de 48". */
export interface Parcela {
  atual: number
  total: number
}

export interface Padrao<T extends Ocorrencia> {
  /** A descrição como ela aparece na ocorrência mais recente. */
  description: string
  kind: 'income' | 'expense'
  /** O valor a sugerir: a mediana, ou o último quando o valor só sobe ou só desce. */
  amountCents: number
  dayOfMonth: number
  /** Em quantos meses diferentes apareceu. */
  meses: number
  /** O valor variou mais que um décimo entre os meses: conta de luz, parcela corrigida. */
  valorVaria: boolean
  /** Primeiro dia em que a regra deve valer: o mês seguinte ao último visto. */
  startDate: string
  /** Último dia da regra, quando é parcela: o mês da última parcela. */
  endDate: string | null
  parcela: Parcela | null
  /** Uma por mês, da mais antiga para a mais nova. */
  ocorrencias: T[]
}

/** Três meses é o mínimo para separar repetição de coincidência. */
const MIN_MESES = 3

/** O dia pode andar um pouco: fim de semana e feriado empurram o débito. */
const TOLERANCIA_DE_DIA = 4

/** Acima disto o valor não é "o mesmo de sempre", mas ainda pode ser recorrente. */
const VARIACAO_ACEITA = 0.1

/**
 * Agrupa pela descrição sem número, que é o que sobrevive de um mês para o
 * outro: "NETFLIX.COM 10/2026" e "NETFLIX.COM 11/2026" são a mesma assinatura,
 * e "PARC 05/60 CONSTRUTORA" e "PARC 06/60 CONSTRUTORA" também.
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

/** "parc 5/60", "parcela 05 de 60", "prest. 5/60": a palavra deixa claro que é parcela. */
const PARCELA_COM_NOME = /\b(?:parc(?:ela)?|prest(?:acao|ação)?)\.?\s*(\d{1,3})\s*(?:\/|de)\s*(\d{1,3})(?!\d)/i
/** "5/60" solto: pode ser parcela, pode ser uma data. Só vale confirmado mês a mês. */
const PARCELA_SOLTA = /(?:^|\D)(\d{1,3})\s*\/\s*(\d{1,3})(?!\d)/

function parcelaValida(atual: number, total: number): Parcela | null {
  return total >= 2 && atual >= 1 && atual <= total ? { atual, total } : null
}

/** A parcela escrita na descrição, quando a palavra "parcela" (ou parecida) está lá. */
export function lerParcela(description: string): Parcela | null {
  const achado = PARCELA_COM_NOME.exec(description)
  return achado ? parcelaValida(Number(achado[1]), Number(achado[2])) : null
}

/**
 * A descrição sem o "20/48".
 *
 * A regra repete a descrição em todo lançamento que gerar. Com o número da
 * parcela dentro, o lançamento de março de 2029 sairia dizendo "PARC 20/48".
 */
export function semParcela(description: string): string {
  const limpa = description
    .replace(new RegExp(PARCELA_COM_NOME.source, 'i'), ' ')
    .replace(new RegExp(PARCELA_SOLTA.source), (trecho) => trecho.replace(/\d.*$/, ' '))
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–·:]+|[\s\-–·:]+$/g, '')
    .trim()
  return limpa || description
}

function lerParcelaSolta(description: string): Parcela | null {
  const achado = PARCELA_SOLTA.exec(description)
  return achado ? parcelaValida(Number(achado[1]), Number(achado[2])) : null
}

/**
 * A parcela do grupo, se ele é um parcelamento.
 *
 * Com a palavra "parcela" na descrição, basta a mais recente. Sem ela, um "5/10"
 * pode ser 5 de outubro, então só vale se os meses confirmarem: o total igual
 * e o número andando junto com o mês. Uma data não passa nesse teste.
 */
function parcelaDoGrupo<T extends Ocorrencia>(ocorrencias: T[]): Parcela | null {
  const ultima = ocorrencias.at(-1)
  if (!ultima) return null
  const nomeada = lerParcela(ultima.description)
  if (nomeada) return nomeada

  const lidas = ocorrencias.map((o) => ({ parcela: lerParcelaSolta(o.description), mes: toCompetence(o.date) }))
  if (lidas.length < 2 || lidas.some((lida) => lida.parcela === null)) return null
  const primeira = lidas[0]!
  const confere = lidas.every(
    (lida) =>
      lida.parcela!.total === primeira.parcela!.total &&
      lida.parcela!.atual - primeira.parcela!.atual ===
        monthsBetween(`${primeira.mes}-01`, `${lida.mes}-01`),
  )
  return confere ? lidas.at(-1)!.parcela : null
}

/**
 * Os meses formam uma série mensal?
 *
 * Sem buraco nenhum, sempre. Com histórico de quatro meses ou mais, aceita um
 * mês faltando de vez em quando: um boleto pago no dia 1º do mês seguinte, ou
 * uma linha que ficou fora de uma importação, não desfazem um financiamento de
 * dois anos. Três compras em janeiro, março e julho continuam sendo três idas
 * ao mesmo lugar.
 */
function serieMensal(meses: Competence[]): boolean {
  const ordenados = [...meses].sort()
  let faltando = 0
  for (let i = 1; i < ordenados.length; i++) {
    const buraco = monthsBetween(`${ordenados[i - 1]}-01`, `${ordenados[i]}-01`) - 1
    if (buraco > 1) return false
    faltando += buraco
  }
  if (faltando === 0) return true
  return ordenados.length >= 4 && faltando <= Math.floor(ordenados.length / 4)
}

type Modo = 'descricao' | 'valor'

function avaliar<T extends Ocorrencia>(grupo: T[], modo: Modo): Padrao<T> | null {
  const porMes = new Map<Competence, T>()
  for (const linha of [...grupo].sort((a, b) => a.date.localeCompare(b.date))) {
    // Duas no mesmo mês: fica a primeira, que é a que marca o dia.
    const mes = toCompetence(linha.date)
    if (!porMes.has(mes)) porMes.set(mes, linha)
  }

  const ocorrencias = [...porMes.values()]
  const parcela = parcelaDoGrupo(ocorrencias)
  // Parcelamento quitado não vira regra: não há mais nada para lançar.
  if (parcela && parcela.atual >= parcela.total) return null
  // A parcela já se identifica sozinha; dois meses bastam para confirmá-la.
  if (porMes.size < (parcela ? 2 : MIN_MESES)) return null
  if (!serieMensal([...porMes.keys()])) return null

  const dias = ocorrencias.map((linha) => Number(linha.date.slice(8, 10)))
  const dia = mediana(dias)
  const diaFirme = dias.every((valor) => Math.abs(valor - dia) <= TOLERANCIA_DE_DIA)

  const valores = ocorrencias.map((linha) => linha.amountCents)
  const tipico = mediana(valores)
  const valorFirme = valores.every((valor) => Math.abs(valor - tipico) <= tipico * VARIACAO_ACEITA)
  const sugerido = valorParaSugerir(valores)

  // Pela descrição: basta o dia ou o valor se manter. O boleto do financiamento
  // é pago num dia diferente a cada mês, mas é sempre o mesmo valor.
  // Pelo valor: o valor já é igual por construção, então o dia precisa bater,
  // senão qualquer coisa de R$ 50,00 viraria conta mensal.
  const aceito = modo === 'descricao' ? diaFirme || valorFirme || parcela !== null : diaFirme || parcela !== null
  if (!aceito) return null

  const ultima = ocorrencias.at(-1)!
  const mesDaUltima = toCompetence(ultima.date)

  return {
    description: parcela ? semParcela(ultima.description) : ultima.description,
    kind: ultima.kind === 'income' ? 'income' : 'expense',
    amountCents: sugerido,
    dayOfMonth: dia,
    meses: porMes.size,
    valorVaria: !valorFirme,
    startDate: `${addMonths(mesDaUltima, 1)}-01`,
    endDate: parcela ? dateInCompetence(addMonths(mesDaUltima, parcela.total - parcela.atual), dia) : null,
    parcela,
    ocorrencias,
  }
}

/**
 * Os padrões mensais de uma lista de lançamentos.
 *
 * Duas passadas. A primeira agrupa pela descrição. A segunda pega o que sobrou
 * e agrupa pelo valor exato: o financiamento pago por Pix aparece cada mês com
 * um texto diferente ("PIX ENVIADO", "TRANSF ENVIADA"), mas o valor é o mesmo
 * centavo por centavo.
 */
export function encontrarPadroes<T extends Ocorrencia>(linhas: T[]): Array<Padrao<T>> {
  // Transferência entre contas suas não é conta a pagar.
  const candidatas = linhas.filter((linha) => linha.kind !== 'transfer')
  const padroes: Array<Padrao<T>> = []
  const usadas = new Set<T>()

  const porDescricao = agrupar(candidatas, (linha) => {
    const chave = chaveDoPadrao(linha.description)
    return chave ? `${linha.kind}:${chave}` : null
  })
  for (const grupo of porDescricao) {
    const padrao = avaliar(grupo, 'descricao')
    if (!padrao) continue
    padroes.push(padrao)
    for (const linha of grupo) usadas.add(linha)
  }

  const sobra = candidatas.filter((linha) => !usadas.has(linha))
  for (const grupo of agrupar(sobra, (linha) => `${linha.kind}:${linha.amountCents}`)) {
    const padrao = avaliar(grupo, 'valor')
    if (padrao) padroes.push(padrao)
  }

  return padroes.sort((a, b) => b.meses - a.meses || b.amountCents - a.amountCents)
}

function agrupar<T>(linhas: T[], chave: (linha: T) => string | null): T[][] {
  const grupos = new Map<string, T[]>()
  for (const linha of linhas) {
    const k = chave(linha)
    if (k) grupos.set(k, [...(grupos.get(k) ?? []), linha])
  }
  return [...grupos.values()]
}

// ---------------------------------------------------------------------------
// Na importação: só as linhas do arquivo
// ---------------------------------------------------------------------------

export interface LinhaDoExtrato extends Ocorrencia {
  accountLabel: string
  /** A parcela que a importação separou do nome: "Cama (3/12)" chega como "Cama" + 3 de 12. */
  installment?: { n: number; total: number } | null
}

export interface RecorrenteSugerida {
  description: string
  kind: 'income' | 'expense'
  accountLabel: string
  amountCents: number
  dayOfMonth: number
  meses: number
  valorVaria: boolean
  startDate: string
  endDate: string | null
  parcela: Parcela | null
}

/**
 * Linha que já é parcela fica de fora: a importação grava cada uma como
 * parcelamento, mês a mês, até a última. A sugestão as via como doze linhas
 * iguais e oferecia uma regra mensal sem fim, que começava depois da última
 * parcela e lançaria a cama quitada para sempre.
 */
export function sugerirRecorrentes(linhas: LinhaDoExtrato[]): RecorrenteSugerida[] {
  return encontrarPadroes(linhas.filter((linha) => !linha.installment)).map(({ ocorrencias, ...padrao }) => ({
    ...padrao,
    accountLabel: ocorrencias.at(-1)!.accountLabel,
  }))
}

// ---------------------------------------------------------------------------
// No histórico: tudo o que já está gravado
// ---------------------------------------------------------------------------

export interface LancamentoDoHistorico extends Ocorrencia {
  id: string
  account_id: string
  category_id: string | null
  /** Parcela de cartão lançada pelo app: já tem as parcelas dela, não precisa de regra. */
  installment_group_id: string | null
  /** Já veio de uma regra: está coberta. */
  recurring_id: string | null
}

export interface RegraLike {
  description: string
  kind: 'income' | 'expense'
  amount_cents: number
  account_id: string
  day_of_month: number
}

/**
 * Já existe uma regra para isto?
 *
 * Pela descrição, ou pelo mesmo valor na mesma conta perto do mesmo dia: a
 * regra que a pessoa chamou de "Moto" e o extrato que diz "PAG BOLETO HONDA"
 * são a mesma conta, e oferecê-la de novo criaria a segunda.
 */
function jaTemRegra(padrao: Padrao<LancamentoDoHistorico>, regras: RegraLike[], contaId: string): boolean {
  const chave = chaveDoPadrao(padrao.description)
  return regras.some(
    (regra) =>
      regra.kind === padrao.kind &&
      (chaveDoPadrao(regra.description) === chave ||
        (regra.account_id === contaId &&
          Math.abs(regra.amount_cents - padrao.amountCents) <= padrao.amountCents * 0.01 &&
          Math.abs(regra.day_of_month - padrao.dayOfMonth) <= TOLERANCIA_DE_DIA)),
  )
}

/** Até quantos meses atrás o padrão pode ter parado e ainda valer a pena sugerir. */
const MESES_PARADO = 2

export interface RecorrenteDoHistorico extends Padrao<LancamentoDoHistorico> {
  accountId: string
  categoryId: string | null
}

/**
 * O que se repete nos lançamentos gravados e ainda não tem regra.
 *
 * O que parou há mais de dois meses fica de fora: a assinatura cancelada no
 * ano passado também se repetia, e virar regra agora só criaria pendência falsa.
 */
export function recorrentesNoHistorico(
  lancamentos: LancamentoDoHistorico[],
  regras: RegraLike[],
  hoje: string,
): RecorrenteDoHistorico[] {
  const candidatos = lancamentos.filter(
    (lancamento) => !lancamento.installment_group_id && !lancamento.recurring_id,
  )
  const limite = addMonths(toCompetence(hoje), -MESES_PARADO)

  return encontrarPadroes(candidatos)
    .map((padrao) => {
      const ultima = padrao.ocorrencias.at(-1)!
      return { ...padrao, accountId: ultima.account_id, categoryId: ultima.category_id }
    })
    .filter((padrao) => toCompetence(padrao.ocorrencias.at(-1)!.date) >= limite)
    .filter((padrao) => !jaTemRegra(padrao, regras, padrao.accountId))
}

/**
 * A regra montada a partir de uma busca pela descrição.
 *
 * É a saída para o que a detecção não pegou: a pessoa sabe que "moto" é uma
 * conta mensal, mesmo que o extrato não mostre isso com clareza. Aqui não há
 * trava de quantidade nem de regularidade, porque quem afirmou foi a pessoa.
 * O resultado só preenche o formulário, onde tudo pode ser corrigido.
 */
export function propostaDaBusca(
  lancamentos: LancamentoDoHistorico[],
  termo: string,
): RecorrenteDoHistorico | null {
  const procurado = normalize(termo)
  if (procurado.length < 2) return null

  const achados = lancamentos.filter(
    (lancamento) =>
      lancamento.kind !== 'transfer' &&
      !lancamento.installment_group_id &&
      normalize(lancamento.description).includes(procurado),
  )
  if (achados.length === 0) return null

  // Despesa e receita com o mesmo nome são coisas diferentes; fica a que mais aparece.
  const despesas = achados.filter((lancamento) => lancamento.kind === 'expense')
  const doTipo = despesas.length >= achados.length - despesas.length ? despesas : achados.filter((l) => l.kind === 'income')

  const porMes = new Map<Competence, LancamentoDoHistorico>()
  for (const lancamento of [...doTipo].sort((a, b) => a.date.localeCompare(b.date))) {
    const mes = toCompetence(lancamento.date)
    if (!porMes.has(mes)) porMes.set(mes, lancamento)
  }
  const ocorrencias = [...porMes.values()]
  const ultima = ocorrencias.at(-1)!
  const mesDaUltima = toCompetence(ultima.date)
  const dia = mediana(ocorrencias.map((o) => Number(o.date.slice(8, 10))))
  const valores = ocorrencias.map((o) => o.amountCents)
  const tipico = mediana(valores)
  const parcela = parcelaDoGrupo(ocorrencias)

  return {
    description: parcela ? semParcela(ultima.description) : ultima.description,
    kind: ultima.kind === 'income' ? 'income' : 'expense',
    amountCents: valorParaSugerir(valores),
    dayOfMonth: dia,
    meses: porMes.size,
    valorVaria: valores.some((valor) => Math.abs(valor - tipico) > tipico * VARIACAO_ACEITA),
    startDate: `${addMonths(mesDaUltima, 1)}-01`,
    endDate:
      parcela && parcela.atual < parcela.total
        ? dateInCompetence(addMonths(mesDaUltima, parcela.total - parcela.atual), dia)
        : null,
    parcela,
    ocorrencias,
    accountId: ultima.account_id,
    categoryId: ultima.category_id,
  }
}

/**
 * O valor a sugerir para o próximo mês.
 *
 * Em geral, a mediana: um mês fora da curva não puxa a conta de luz. Mas a
 * parcela corrigida pelo INCC só sobe, e a mediana sugeriria um valor que ficou
 * para trás meses atrás. Quando os valores andam num sentido só, vale o último.
 */
function valorParaSugerir(valores: number[]): number {
  const sobe = valores.every((valor, i) => i === 0 || valor >= valores[i - 1]!)
  const desce = valores.every((valor, i) => i === 0 || valor <= valores[i - 1]!)
  const constante = valores.every((valor) => valor === valores[0])
  return !constante && (sobe || desce) ? valores.at(-1)! : mediana(valores)
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 === 0
    ? Math.round((ordenados[meio - 1]! + ordenados[meio]!) / 2)
    : ordenados[meio]!
}
