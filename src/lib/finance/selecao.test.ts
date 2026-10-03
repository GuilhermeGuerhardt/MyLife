import { describe, expect, it } from 'vitest'
import {
  podarSelecao,
  podeMarcarPagamento,
  resumoDaSelecao,
  separarParaPagamento,
  voltamParaAFatura,
  type ContaDoLancamento,
  type LancamentoSelecionavel,
} from './selecao'

function tx(over: Partial<LancamentoSelecionavel> = {}): LancamentoSelecionavel {
  return {
    id: 't',
    account_id: 'conta',
    kind: 'expense',
    amount_cents: 10000,
    paid: false,
    installment_group_id: null,
    installment_total: null,
    ...over,
  }
}

const CONTAS = new Map<string, ContaDoLancamento>([
  ['conta', { kind: 'checking' }],
  ['cartao', { kind: 'credit' }],
])

describe('resumo da seleção', () => {
  it('vazio é tudo zero', () => {
    const r = resumoDaSelecao([])
    expect(r.quantidade).toBe(0)
    expect(r.saldoCents).toBe(0)
    expect(r.despesas).toEqual({ quantidade: 0, cents: 0 })
  })

  it('só despesas: soma e conta, saldo negativo', () => {
    const r = resumoDaSelecao([
      tx({ id: 'a', amount_cents: 30000 }),
      tx({ id: 'b', amount_cents: 15000 }),
    ])
    expect(r.quantidade).toBe(2)
    expect(r.despesas).toEqual({ quantidade: 2, cents: 45000 })
    expect(r.receitas).toEqual({ quantidade: 0, cents: 0 })
    expect(r.saldoCents).toBe(-45000)
  })

  it('separa receita de despesa e o saldo é a diferença', () => {
    const r = resumoDaSelecao([
      tx({ id: 'a', kind: 'expense', amount_cents: 45000 }),
      tx({ id: 'b', kind: 'income', amount_cents: 100000 }),
    ])
    expect(r.despesas.cents).toBe(45000)
    expect(r.receitas).toEqual({ quantidade: 1, cents: 100000 })
    expect(r.saldoCents).toBe(55000)
  })

  it('transferência é contada, mas não entra no saldo', () => {
    const r = resumoDaSelecao([
      tx({ id: 'a', kind: 'income', amount_cents: 100000 }),
      tx({ id: 'b', kind: 'transfer', amount_cents: 80000 }),
    ])
    expect(r.quantidade).toBe(2)
    expect(r.transferencias).toEqual({ quantidade: 1, cents: 80000 })
    expect(r.saldoCents).toBe(100000)
  })

  it('conta as parcelas, e só as de compra parcelada de fato', () => {
    const r = resumoDaSelecao([
      tx({ id: 'a', installment_group_id: 'g', installment_total: 3 }),
      tx({ id: 'b', installment_group_id: 'g', installment_total: 1 }),
      tx({ id: 'c' }),
    ])
    expect(r.parcelas).toBe(1)
  })
})

describe('quem pode ter o pagamento marcado à mão', () => {
  it('lançamento de conta comum pode', () => {
    expect(podeMarcarPagamento(tx(), { kind: 'checking' })).toBe(true)
  })

  it('compra no cartão em aberto não pode: quem paga é a fatura', () => {
    expect(podeMarcarPagamento(tx({ paid: false }), { kind: 'credit' })).toBe(false)
  })

  it('compra no cartão já paga pode voltar a prevista, como na linha', () => {
    expect(podeMarcarPagamento(tx({ paid: true }), { kind: 'credit' })).toBe(true)
  })

  it('sem conta conhecida, vale a regra comum', () => {
    expect(podeMarcarPagamento(tx(), undefined)).toBe(true)
  })
})

describe('separar para marcar o pagamento', () => {
  it('despesa e receita previstas entram ao marcar como pago', () => {
    const despesa = tx({ id: 'd' })
    const receita = tx({ id: 'r', kind: 'income' })
    const { aplicar, ignorados } = separarParaPagamento([despesa, receita], CONTAS, true)
    expect(aplicar.map((t) => t.id)).toEqual(['d', 'r'])
    expect(ignorados).toEqual([])
  })

  it('compra no cartão em aberto fica de fora ao marcar como pago', () => {
    const compra = tx({ id: 'c', account_id: 'cartao' })
    const despesa = tx({ id: 'd' })
    const { aplicar, ignorados } = separarParaPagamento([compra, despesa], CONTAS, true)
    expect(aplicar.map((t) => t.id)).toEqual(['d'])
    expect(ignorados.map((t) => t.id)).toEqual(['c'])
  })

  it('compra no cartão paga pode ser desmarcada, como a linha permite', () => {
    const compra = tx({ id: 'c', account_id: 'cartao', paid: true })
    const { aplicar, ignorados } = separarParaPagamento([compra], CONTAS, false)
    expect(aplicar.map((t) => t.id)).toEqual(['c'])
    expect(ignorados).toEqual([])
  })

  it('compra no cartão paga, marcada como paga de novo, não vai para lugar nenhum', () => {
    const compra = tx({ id: 'c', account_id: 'cartao', paid: true })
    const { aplicar, ignorados } = separarParaPagamento([compra], CONTAS, true)
    expect(aplicar).toEqual([])
    expect(ignorados).toEqual([])
  })

  it('quem já está no estado pedido não é gravado nem contado como ignorado', () => {
    const pago = tx({ id: 'p', paid: true })
    const emAberto = tx({ id: 'c', account_id: 'cartao', paid: false })
    expect(separarParaPagamento([pago], CONTAS, true)).toEqual({ aplicar: [], ignorados: [] })
    // Desmarcar uma compra no cartão que já está em aberto não é bloqueio, é nada a fazer.
    expect(separarParaPagamento([emAberto], CONTAS, false)).toEqual({ aplicar: [], ignorados: [] })
  })
})

describe('o que um "não pago" devolve para a fatura', () => {
  it('só a compra no cartão que já está paga', () => {
    const pagaNoCartao = tx({ id: 'pc', account_id: 'cartao', paid: true })
    const abertaNoCartao = tx({ id: 'ac', account_id: 'cartao', paid: false })
    const pagaNaConta = tx({ id: 'p', paid: true })
    const voltam = voltamParaAFatura([pagaNoCartao, abertaNoCartao, pagaNaConta], CONTAS)
    expect(voltam.map((t) => t.id)).toEqual(['pc'])
  })

  it('conta desconhecida não é cartão', () => {
    expect(voltamParaAFatura([tx({ account_id: 'sumiu', paid: true })], CONTAS)).toEqual([])
  })
})

describe('podar a seleção pela lista visível', () => {
  it('tira o que o filtro escondeu', () => {
    const podado = podarSelecao(new Set(['a', 'b', 'c']), [{ id: 'b' }, { id: 'x' }])
    expect([...podado]).toEqual(['b'])
  })

  it('devolve o mesmo conjunto quando nada sai', () => {
    const selecionados = new Set(['a'])
    expect(podarSelecao(selecionados, [{ id: 'a' }, { id: 'b' }])).toBe(selecionados)
  })

  it('lista vazia esvazia a seleção', () => {
    expect(podarSelecao(new Set(['a']), []).size).toBe(0)
  })
})
