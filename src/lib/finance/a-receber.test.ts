import { describe, expect, it } from 'vitest'
import {
  chaveDaPessoa,
  emAbertoPorPessoa,
  parteDeCada,
  pessoasConhecidas,
  recebidoEntre,
  totalEmAberto,
  type ReceberLike,
} from './a-receber'

const item = (over: Partial<ReceberLike> & { id: string }): ReceberLike => ({
  person: 'Ana',
  description: 'Pizza',
  amount_cents: 5000,
  date: '2026-10-01',
  received_at: null,
  ...over,
})

describe('a receber', () => {
  it('junta as grafias da mesma pessoa', () => {
    expect(chaveDaPessoa('  Ána  Maria ')).toBe(chaveDaPessoa('ana maria'))
  })

  it('agrupa o que está em aberto, de quem deve mais para quem deve menos', () => {
    const grupos = emAbertoPorPessoa([
      item({ id: '1', person: 'ana', date: '2026-09-10', amount_cents: 3000 }),
      item({ id: '2', person: 'Bruno', amount_cents: 2000 }),
      item({ id: '3', person: 'Ana ', date: '2026-10-02', amount_cents: 4000 }),
      item({ id: '4', person: 'Ana', amount_cents: 9000, received_at: '2026-10-03' }),
    ])

    expect(grupos.map((grupo) => [grupo.nome, grupo.totalCents])).toEqual([
      // A grafia com maiúscula mais recente: 'Ana ', aparada.
      ['Ana', 7000],
      ['Bruno', 2000],
    ])
    expect(grupos[0]!.itens.map((i) => i.id)).toEqual(['1', '3'])
  })

  it('prefere a grafia com maiúscula, mesmo que a última venha em minúscula', () => {
    const grupos = emAbertoPorPessoa([
      item({ id: '1', person: 'Ana', date: '2026-09-10' }),
      item({ id: '2', person: 'ana', date: '2026-09-28' }),
    ])
    expect(grupos[0]!.nome).toBe('Ana')
    expect(pessoasConhecidas([item({ id: '3', person: 'bruno' })])).toEqual(['bruno'])
  })

  it('total em aberto e recebido no período', () => {
    const itens = [
      item({ id: '1', amount_cents: 3000 }),
      item({ id: '2', amount_cents: 2000, received_at: '2026-09-15' }),
      item({ id: '3', amount_cents: 1000, received_at: '2026-10-02' }),
    ]
    expect(totalEmAberto(itens)).toBe(3000)
    expect(recebidoEntre(itens, '2026-10-01', '2026-10-31')).toBe(1000)
  })

  it('sugere uma grafia por pessoa, a mais recente', () => {
    const itens = [
      item({ id: '1', person: 'ana', date: '2026-09-01' }),
      item({ id: '2', person: 'Ana', date: '2026-10-01' }),
      item({ id: '3', person: 'Bruno' }),
    ]
    expect(pessoasConhecidas(itens)).toEqual(['Ana', 'Bruno'])
  })

  it('divide em partes iguais e o centavo que sobra fica com quem pagou', () => {
    expect(parteDeCada(10000, 2)).toBe(5000)
    expect(parteDeCada(10000, 3)).toBe(3333)
    expect(parteDeCada(10000, 1)).toBe(10000)
  })
})
