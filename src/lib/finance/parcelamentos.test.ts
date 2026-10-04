import { describe, expect, it } from 'vitest'
import { addMonths } from './billing'
import {
  parcelamentosDaBusca,
  parcelamentosEmAndamento,
  parcelasDoMes,
  regrasQueRepetemParcelamento,
  type ParcelaLike,
} from './parcelamentos'

/** Um parcelamento: `total` parcelas a cada `intervalo` meses, as `pagas` primeiras já pagas. */
function parcelamento(
  grupo: string,
  description: string,
  valor: number,
  inicio: string,
  total: number,
  { intervalo = 1, pagas = 0, primeiroNumero = 1 } = {},
): ParcelaLike[] {
  return Array.from({ length: total - primeiroNumero + 1 }, (_, i) => ({
    id: `${grupo}-${i}`,
    description,
    amount_cents: valor,
    date: `${addMonths(inicio.slice(0, 7), i * intervalo)}-${inicio.slice(8, 10)}`,
    kind: 'expense' as const,
    paid: i < pagas,
    account_id: 'cc',
    installment_group_id: grupo,
    installment_n: primeiroNumero + i,
    installment_total: total,
  }))
}

const moto = parcelamento('moto', 'CG 160 Fan', 86959, '2026-05-23', 48, { pagas: 4 })
const econMensal = parcelamento('econ', 'Econ Construtora', 55000, '2026-08-22', 24, { pagas: 2 })
const econAnual = parcelamento('econ-anual', 'Econ Construtora', 450000, '2026-12-22', 2, { intervalo: 12 })

describe('parcelamentos em andamento', () => {
  it('lista o que tem parcela em aberto, com a próxima e quanto falta', () => {
    const lista = parcelamentosEmAndamento([...moto, ...econMensal, ...econAnual])
    const cg = lista.find((item) => item.grupo === 'moto')!

    expect(cg).toMatchObject({
      description: 'CG 160 Fan',
      total: 48,
      intervaloMeses: 1,
      proxima: { numero: 5, date: '2026-09-23', valorCents: 86959 },
      ultimaData: '2030-04-23',
      restantes: 44,
      restanteCents: 44 * 86959,
    })
    // Da próxima a vencer para a mais distante.
    expect(lista.map((item) => item.grupo)).toEqual(['moto', 'econ', 'econ-anual'])
  })

  it('a parcela anual é reconhecida pelo intervalo de doze meses', () => {
    const [anual] = parcelamentosEmAndamento(econAnual)
    expect(anual).toMatchObject({ intervaloMeses: 12, total: 2, ultimaData: '2027-12-22' })
  })

  it('o número da parcela vem do lançamento, não da posição', () => {
    const doMeio = parcelamento('g', 'Geladeira', 30000, '2026-09-10', 10, { primeiroNumero: 5 })
    expect(parcelamentosEmAndamento(doMeio)[0]!.proxima?.numero).toBe(5)
  })

  it('parcelamento quitado sai da lista', () => {
    expect(parcelamentosEmAndamento(parcelamento('q', 'Sofa', 10000, '2026-01-10', 3, { pagas: 3 }))).toEqual([])
  })

  it('a busca acha pelo nome, e "anuidade" acha o que vem uma vez por ano', () => {
    const lista = parcelamentosEmAndamento([...moto, ...econMensal, ...econAnual])
    expect(parcelamentosDaBusca(lista, 'cg').map((item) => item.grupo)).toEqual(['moto'])
    expect(parcelamentosDaBusca(lista, 'Econ').map((item) => item.grupo)).toEqual(['econ', 'econ-anual'])
    expect(parcelamentosDaBusca(lista, 'anuidade').map((item) => item.grupo)).toEqual(['econ-anual'])
    expect(parcelamentosDaBusca(lista, 'c')).toEqual([])
  })

  it('soma as parcelas que caem no mês', () => {
    expect(parcelasDoMes([...moto, ...econMensal, ...econAnual], '2026-12-05')).toBe(86959 + 55000 + 450000)
  })
})

describe('regras que repetem parcelamento', () => {
  const cama = parcelamento('cama', 'Cama', 14000, '2026-10-09', 12)
  const regra = (id: string, description: string, amount_cents: number) => ({
    id,
    description,
    kind: 'expense' as const,
    amount_cents,
    account_id: 'cc',
  })

  it('aponta a regra com o nome e o valor da parcela', () => {
    expect(regrasQueRepetemParcelamento([regra('r1', 'Cama', 14000)], cama)).toEqual([
      { regraId: 'r1', description: 'Cama', ultimaData: '2027-09-09' },
    ])
  })

  it('não confunde com regra de outro valor ou outro nome', () => {
    expect(
      regrasQueRepetemParcelamento([regra('r1', 'Cama', 50000), regra('r2', 'Aluguel', 14000)], cama),
    ).toEqual([])
  })
})
