import { describe, expect, it } from 'vitest'
import {
  chaveDoPadrao,
  sugerirRecorrentes,
  type LinhaDoExtrato,
} from './recorrentes-do-extrato'

const linha = (over: Partial<LinhaDoExtrato> & { date: string }): LinhaDoExtrato => ({
  description: 'Netflix',
  amountCents: 3990,
  kind: 'expense',
  accountLabel: 'Conta Corrente',
  ...over,
})

describe('chave do padrão', () => {
  it('ignora número, acento e pontuação', () => {
    expect(chaveDoPadrao('NETFLIX.COM 10/2026')).toBe('netflix com')
    expect(chaveDoPadrao('netflix com')).toBe('netflix com')
    expect(chaveDoPadrao('Academia Força Total 03')).toBe('academia forca total')
  })

  it('corta o que vem depois da quarta palavra, que é onde mora o código', () => {
    expect(chaveDoPadrao('PAG*IFOOD RESTAURANTE DO ZE LTDA ME 998877')).toBe(
      'pag ifood restaurante do',
    )
  })
})

describe('recorrentes no extrato', () => {
  it('reconhece a assinatura de três meses seguidos', () => {
    const sugestoes = sugerirRecorrentes([
      linha({ date: '2026-07-15' }),
      linha({ date: '2026-08-15' }),
      linha({ date: '2026-09-15' }),
    ])

    expect(sugestoes).toHaveLength(1)
    expect(sugestoes[0]).toMatchObject({
      description: 'Netflix',
      amountCents: 3990,
      dayOfMonth: 15,
      meses: 3,
      valorVaria: false,
    })
  })

  /**
   * A regra criada aqui não pode repetir o que o arquivo acabou de trazer: ela
   * vale do mês seguinte ao último que veio, e não do primeiro.
   */
  it('a regra começa no mês seguinte ao último do arquivo', () => {
    const sugestoes = sugerirRecorrentes([
      linha({ date: '2026-07-15' }),
      linha({ date: '2026-08-15' }),
      linha({ date: '2026-09-15' }),
    ])

    expect(sugestoes[0]!.startDate).toBe('2026-10-01')
  })

  it('duas vezes não é recorrente', () => {
    expect(sugerirRecorrentes([linha({ date: '2026-08-15' }), linha({ date: '2026-09-15' })])).toEqual(
      [],
    )
  })

  it('mês salteado não é conta mensal, é coincidência', () => {
    expect(
      sugerirRecorrentes([
        linha({ date: '2026-01-15' }),
        linha({ date: '2026-03-15' }),
        linha({ date: '2026-07-15' }),
      ]),
    ).toEqual([])
  })

  it('o dia pode andar alguns dias, que é o feriado empurrando o débito', () => {
    const sugestoes = sugerirRecorrentes([
      linha({ date: '2026-07-10' }),
      linha({ date: '2026-08-12' }),
      linha({ date: '2026-09-11' }),
    ])

    expect(sugestoes).toHaveLength(1)
    expect(sugestoes[0]!.dayOfMonth).toBe(11)
  })

  it('dia muito diferente não é a mesma conta', () => {
    expect(
      sugerirRecorrentes([
        linha({ date: '2026-07-03' }),
        linha({ date: '2026-08-18' }),
        linha({ date: '2026-09-27' }),
      ]),
    ).toEqual([])
  })

  it('conta de luz entra, avisando que o valor varia', () => {
    const sugestoes = sugerirRecorrentes([
      linha({ date: '2026-07-20', description: 'Energia', amountCents: 14300 }),
      linha({ date: '2026-08-20', description: 'Energia', amountCents: 18700 }),
      linha({ date: '2026-09-20', description: 'Energia', amountCents: 16100 }),
    ])

    expect(sugestoes[0]!.valorVaria).toBe(true)
    // A mediana, não a média: um mês fora da curva não puxa o valor sugerido.
    expect(sugestoes[0]!.amountCents).toBe(16100)
  })

  it('transferência entre contas suas nunca vira regra', () => {
    expect(
      sugerirRecorrentes([
        linha({ date: '2026-07-05', kind: 'transfer', description: 'Para a poupanca' }),
        linha({ date: '2026-08-05', kind: 'transfer', description: 'Para a poupanca' }),
        linha({ date: '2026-09-05', kind: 'transfer', description: 'Para a poupanca' }),
      ]),
    ).toEqual([])
  })

  it('receita mensal também é reconhecida', () => {
    const sugestoes = sugerirRecorrentes([
      linha({ date: '2026-07-05', description: 'Salario', kind: 'income', amountCents: 450000 }),
      linha({ date: '2026-08-05', description: 'Salario', kind: 'income', amountCents: 450000 }),
      linha({ date: '2026-09-05', description: 'Salario', kind: 'income', amountCents: 450000 }),
    ])

    expect(sugestoes[0]).toMatchObject({ kind: 'income', amountCents: 450000, dayOfMonth: 5 })
  })

  it('duas linhas no mesmo mês contam como um mês só', () => {
    expect(
      sugerirRecorrentes([
        linha({ date: '2026-08-15' }),
        linha({ date: '2026-08-16' }),
        linha({ date: '2026-09-15' }),
      ]),
    ).toEqual([])
  })
})
