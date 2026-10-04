/**
 * A revisão do mês: um fechamento que atravessa os módulos.
 *
 * Cada módulo já tem o seu número do mês, mas cada um na sua tela. Aqui eles
 * ficam lado a lado, comparados com o mês anterior, para responder em uma
 * olhada como foi o mês: gastou mais, treinou menos, estudou quanto.
 *
 * O mês em andamento é comparado com o mesmo trecho do mês anterior, e não com
 * ele inteiro: dia 4 de outubro contra setembro completo daria "gastou 90% a
 * menos" todo começo de mês.
 */

import { addMonths, lastDayOfMonth, toCompetence, type Competence } from '@/lib/finance/billing'
import { addDays, daysBetween } from '@/lib/dates'

export type Unidade = 'centavos' | 'minutos' | 'horas' | 'kg' | 'contagem' | 'nota' | 'kcal'

export interface ItemDaRevisao {
  id: string
  rotulo: string
  valor: number | null
  anterior: number | null
  unidade: Unidade
  /** `true` = subir é bom; `false` = descer é bom; `null` = nem um nem outro. */
  subirEBom: boolean | null
}

export interface SecaoDaRevisao {
  area: 'finance' | 'health' | 'education' | 'routine'
  titulo: string
  itens: ItemDaRevisao[]
}

export interface Periodo {
  de: string
  ate: string
}

export interface DadosDaRevisao {
  transacoes: Array<{
    kind: 'income' | 'expense' | 'transfer'
    amount_cents: number
    competence: string
    date: string
    category_id: string | null
  }>
  treinos: Array<{ date: string; duration_min: number }>
  metricas: Array<{ date: string; sleep_hours: number | null; mood: number | null }>
  medidas: Array<{ date: string; weight_kg: number }>
  refeicoes: Array<{ date: string; kcal: number }>
  estudo: Array<{ date: string; minutes: number }>
  prazos: Array<{ date: string; kind: string; done: boolean }>
  registrosDeHabito: Array<{ date: string }>
  /** A data em que foi marcada (o `updated_at`), só das concluídas. */
  tarefasFeitas: Array<{ date: string }>
  aulasFeitas: Array<{ date: string }>
}

/** O trecho do mês que vale: até hoje no mês corrente, inteiro nos outros. */
export function periodoDoMes(competence: Competence, hoje: string): Periodo {
  const de = `${competence}-01`
  const fim = `${competence}-${String(lastDayOfMonth(competence)).padStart(2, '0')}`
  return { de, ate: competence === toCompetence(hoje) && hoje < fim ? hoje : fim }
}

/** O mesmo número de dias, a partir do começo do mês anterior. */
export function periodoAnterior(competence: Competence, atual: Periodo): Periodo {
  const anterior = addMonths(competence, -1)
  const de = `${anterior}-01`
  const fim = `${anterior}-${String(lastDayOfMonth(anterior)).padStart(2, '0')}`
  const mesmoTrecho = addDays(de, daysBetween(atual.de, atual.ate))
  return { de, ate: mesmoTrecho < fim ? mesmoTrecho : fim }
}

const dentro = (data: string, p: Periodo) => data >= p.de && data <= p.ate

function media(valores: number[]): number | null {
  return valores.length === 0 ? null : valores.reduce((soma, v) => soma + v, 0) / valores.length
}

function contar<T extends { date: string }>(lista: T[], p: Periodo): number {
  return lista.filter((item) => dentro(item.date, p)).length
}

function somar<T extends { date: string }>(lista: T[], p: Periodo, valor: (item: T) => number): number {
  return lista.filter((item) => dentro(item.date, p)).reduce((soma, item) => soma + valor(item), 0)
}

/** Variação do peso dentro do período: a última medida menos a primeira. */
function variacaoDoPeso(medidas: DadosDaRevisao['medidas'], p: Periodo): number | null {
  const doPeriodo = medidas.filter((m) => dentro(m.date, p)).sort((a, b) => a.date.localeCompare(b.date))
  if (doPeriodo.length < 2) return null
  return doPeriodo.at(-1)!.weight_kg - doPeriodo[0]!.weight_kg
}

function financeiro(dados: DadosDaRevisao, atual: Periodo, anterior: Periodo): ItemDaRevisao[] {
  // Pela data, e não pela competência: no mês corrente, o previsto do dia 25
  // ainda não aconteceu e não pode entrar na conta do "até hoje".
  const fluxo = (p: Periodo) => {
    let receitas = 0
    let despesas = 0
    for (const tx of dados.transacoes) {
      if (!dentro(tx.date, p) || tx.kind === 'transfer') continue
      if (tx.kind === 'income') receitas += tx.amount_cents
      else despesas += tx.amount_cents
    }
    return { receitas, despesas, sobra: receitas - despesas }
  }
  const agora = fluxo(atual)
  const antes = fluxo(anterior)

  return [
    { id: 'receitas', rotulo: 'Receitas', valor: agora.receitas, anterior: antes.receitas, unidade: 'centavos', subirEBom: true },
    { id: 'despesas', rotulo: 'Despesas', valor: agora.despesas, anterior: antes.despesas, unidade: 'centavos', subirEBom: false },
    { id: 'sobra', rotulo: 'Sobrou', valor: agora.sobra, anterior: antes.sobra, unidade: 'centavos', subirEBom: true },
  ]
}

function saude(dados: DadosDaRevisao, atual: Periodo, anterior: Periodo): ItemDaRevisao[] {
  const sono = (p: Periodo) =>
    media(dados.metricas.filter((m) => dentro(m.date, p) && m.sleep_hours !== null).map((m) => m.sleep_hours!))
  const humor = (p: Periodo) =>
    media(dados.metricas.filter((m) => dentro(m.date, p) && m.mood !== null).map((m) => m.mood!))
  // Consumo por dia com registro: quem anotou dez dias não comeu um terço do normal.
  const kcal = (p: Periodo) => {
    const doPeriodo = dados.refeicoes.filter((r) => dentro(r.date, p))
    const dias = new Set(doPeriodo.map((r) => r.date)).size
    return dias === 0 ? null : doPeriodo.reduce((soma, r) => soma + r.kcal, 0) / dias
  }

  return [
    { id: 'treinos', rotulo: 'Treinos', valor: contar(dados.treinos, atual), anterior: contar(dados.treinos, anterior), unidade: 'contagem', subirEBom: true },
    {
      id: 'minutos-de-treino',
      rotulo: 'Tempo de treino',
      valor: somar(dados.treinos, atual, (t) => t.duration_min),
      anterior: somar(dados.treinos, anterior, (t) => t.duration_min),
      unidade: 'minutos',
      subirEBom: true,
    },
    { id: 'sono', rotulo: 'Sono médio', valor: sono(atual), anterior: sono(anterior), unidade: 'horas', subirEBom: true },
    { id: 'humor', rotulo: 'Humor médio', valor: humor(atual), anterior: humor(anterior), unidade: 'nota', subirEBom: true },
    { id: 'peso', rotulo: 'Peso no mês', valor: variacaoDoPeso(dados.medidas, atual), anterior: variacaoDoPeso(dados.medidas, anterior), unidade: 'kg', subirEBom: null },
    { id: 'kcal', rotulo: 'Consumo por dia', valor: kcal(atual), anterior: kcal(anterior), unidade: 'kcal', subirEBom: null },
  ]
}

function estudos(dados: DadosDaRevisao, atual: Periodo, anterior: Periodo): ItemDaRevisao[] {
  const provas = (p: Periodo) =>
    dados.prazos.filter((d) => d.kind !== 'aula' && d.done && dentro(d.date, p)).length

  return [
    {
      id: 'estudo',
      rotulo: 'Tempo de estudo',
      valor: somar(dados.estudo, atual, (s) => s.minutes),
      anterior: somar(dados.estudo, anterior, (s) => s.minutes),
      unidade: 'minutos',
      subirEBom: true,
    },
    { id: 'aulas', rotulo: 'Aulas concluídas', valor: contar(dados.aulasFeitas, atual), anterior: contar(dados.aulasFeitas, anterior), unidade: 'contagem', subirEBom: true },
    { id: 'provas', rotulo: 'Provas e entregas feitas', valor: provas(atual), anterior: provas(anterior), unidade: 'contagem', subirEBom: null },
  ]
}

function rotina(dados: DadosDaRevisao, atual: Periodo, anterior: Periodo): ItemDaRevisao[] {
  return [
    { id: 'habitos', rotulo: 'Hábitos marcados', valor: contar(dados.registrosDeHabito, atual), anterior: contar(dados.registrosDeHabito, anterior), unidade: 'contagem', subirEBom: true },
    { id: 'tarefas', rotulo: 'Tarefas concluídas', valor: contar(dados.tarefasFeitas, atual), anterior: contar(dados.tarefasFeitas, anterior), unidade: 'contagem', subirEBom: true },
  ]
}

/**
 * Um item sem nada nos dois meses não diz nada: zero contra zero só ocupa
 * linha. A seção inteira some quando todos os itens dela somem, para quem não
 * usa aquele módulo.
 */
function temAlgo(item: ItemDaRevisao): boolean {
  return (item.valor !== null && item.valor !== 0) || (item.anterior !== null && item.anterior !== 0)
}

export function revisaoDoMes(
  dados: DadosDaRevisao,
  competence: Competence,
  hoje: string,
): { periodo: Periodo; anterior: Periodo; secoes: SecaoDaRevisao[] } {
  const periodo = periodoDoMes(competence, hoje)
  const anterior = periodoAnterior(competence, periodo)

  const secoes: SecaoDaRevisao[] = [
    { area: 'finance', titulo: 'Financeiro', itens: financeiro(dados, periodo, anterior) },
    { area: 'health', titulo: 'Saúde', itens: saude(dados, periodo, anterior) },
    { area: 'education', titulo: 'Estudos', itens: estudos(dados, periodo, anterior) },
    { area: 'routine', titulo: 'Rotina', itens: rotina(dados, periodo, anterior) },
  ]

  return {
    periodo,
    anterior,
    secoes: secoes
      .map((secao) => ({ ...secao, itens: secao.itens.filter(temAlgo) }))
      .filter((secao) => secao.itens.length > 0),
  }
}
