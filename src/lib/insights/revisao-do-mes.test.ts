import { describe, expect, it } from 'vitest'
import {
  periodoAnterior,
  periodoDoMes,
  revisaoDoMes,
  type DadosDaRevisao,
} from './revisao-do-mes'

const vazio = (over: Partial<DadosDaRevisao> = {}): DadosDaRevisao => ({
  transacoes: [],
  treinos: [],
  metricas: [],
  medidas: [],
  refeicoes: [],
  estudo: [],
  prazos: [],
  registrosDeHabito: [],
  tarefasFeitas: [],
  aulasFeitas: [],
  ...over,
})

const tx = (kind: 'income' | 'expense', amount_cents: number, date: string) => ({
  kind,
  amount_cents,
  date,
  competence: date.slice(0, 7),
  category_id: null,
})

describe('período', () => {
  it('mês fechado vai inteiro; o mês corrente vai até hoje', () => {
    expect(periodoDoMes('2026-09', '2026-10-04')).toEqual({ de: '2026-09-01', ate: '2026-09-30' })
    expect(periodoDoMes('2026-10', '2026-10-04')).toEqual({ de: '2026-10-01', ate: '2026-10-04' })
  })

  it('o anterior tem o mesmo número de dias, sem passar do fim do mês', () => {
    expect(periodoAnterior('2026-10', { de: '2026-10-01', ate: '2026-10-04' })).toEqual({
      de: '2026-09-01',
      ate: '2026-09-04',
    })
    // 31 dias de março contra fevereiro: para no dia 28.
    expect(periodoAnterior('2026-03', { de: '2026-03-01', ate: '2026-03-31' })).toEqual({
      de: '2026-02-01',
      ate: '2026-02-28',
    })
  })
})

describe('revisão do mês', () => {
  it('compara o começo do mês com o mesmo começo do anterior', () => {
    const dados = vazio({
      transacoes: [
        tx('expense', 10000, '2026-09-02'),
        // Depois do dia 4 de setembro: não entra na comparação com 1 a 4 de outubro.
        tx('expense', 90000, '2026-09-20'),
        tx('expense', 15000, '2026-10-03'),
        // Agendada para o dia 25: ainda não aconteceu.
        tx('expense', 50000, '2026-10-25'),
      ],
    })
    const { secoes } = revisaoDoMes(dados, '2026-10', '2026-10-04')
    const despesas = secoes[0]!.itens.find((item) => item.id === 'despesas')
    expect(despesas).toMatchObject({ valor: 15000, anterior: 10000, subirEBom: false })
  })

  it('some com o que não tem dado nos dois meses, e com a seção inteira', () => {
    const dados = vazio({ treinos: [{ date: '2026-09-10', duration_min: 45 }] })
    const { secoes } = revisaoDoMes(dados, '2026-09', '2026-10-04')
    expect(secoes.map((secao) => secao.area)).toEqual(['health'])
    expect(secoes[0]!.itens.map((item) => item.id)).toEqual(['treinos', 'minutos-de-treino'])
  })

  it('médias, peso e consumo por dia com registro', () => {
    const dados = vazio({
      metricas: [
        { date: '2026-09-01', sleep_hours: 7, mood: 4 },
        { date: '2026-09-02', sleep_hours: 6, mood: null },
      ],
      medidas: [
        { date: '2026-09-01', weight_kg: 80 },
        { date: '2026-09-28', weight_kg: 78.5 },
      ],
      refeicoes: [
        { date: '2026-09-01', kcal: 1000 },
        { date: '2026-09-01', kcal: 800 },
        { date: '2026-09-03', kcal: 2000 },
      ],
    })
    const itens = revisaoDoMes(dados, '2026-09', '2026-10-04').secoes[0]!.itens
    const valor = (id: string) => itens.find((item) => item.id === id)?.valor
    expect(valor('sono')).toBe(6.5)
    expect(valor('humor')).toBe(4)
    expect(valor('peso')).toBe(-1.5)
    expect(valor('kcal')).toBe(1900)
  })

  it('estudo, provas feitas e hábitos', () => {
    const dados = vazio({
      estudo: [
        { date: '2026-09-05', minutes: 90 },
        { date: '2026-08-05', minutes: 30 },
      ],
      prazos: [
        { date: '2026-09-10', kind: 'prova', done: true },
        { date: '2026-09-11', kind: 'aula', done: true },
        { date: '2026-09-12', kind: 'entrega', done: false },
      ],
      registrosDeHabito: [{ date: '2026-09-01' }, { date: '2026-09-02' }],
    })
    const { secoes } = revisaoDoMes(dados, '2026-09', '2026-10-04')
    const estudos = secoes.find((secao) => secao.area === 'education')!.itens
    expect(estudos.find((item) => item.id === 'estudo')).toMatchObject({ valor: 90, anterior: 30 })
    expect(estudos.find((item) => item.id === 'provas')?.valor).toBe(1)
    expect(secoes.find((secao) => secao.area === 'routine')!.itens[0]).toMatchObject({
      id: 'habitos',
      valor: 2,
    })
  })
})
