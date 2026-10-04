import { describe, expect, it } from 'vitest'
import {
  chaveDoPadrao,
  lerParcela,
  propostaDaBusca,
  recorrentesNoHistorico,
  semParcela,
  sugerirRecorrentes,
  type LancamentoDoHistorico,
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

  it('dia muito diferente e valor diferente não é a mesma conta', () => {
    expect(
      sugerirRecorrentes([
        linha({ date: '2026-07-03', description: 'Mercado Bom Preco', amountCents: 18300 }),
        linha({ date: '2026-08-18', description: 'Mercado Bom Preco', amountCents: 42100 }),
        linha({ date: '2026-09-27', description: 'Mercado Bom Preco', amountCents: 9700 }),
      ]),
    ).toEqual([])
  })

  it('boleto pago em dias diferentes, mas sempre do mesmo valor, é conta mensal', () => {
    const sugestoes = sugerirRecorrentes([
      linha({ date: '2026-07-03', description: 'Pag boleto Honda', amountCents: 78945 }),
      linha({ date: '2026-08-18', description: 'Pag boleto Honda', amountCents: 78945 }),
      linha({ date: '2026-09-27', description: 'Pag boleto Honda', amountCents: 78945 }),
    ])
    expect(sugestoes).toHaveLength(1)
    expect(sugestoes[0]).toMatchObject({ amountCents: 78945, valorVaria: false })
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

  it('parcela corrigida, que só sobe, sugere o valor mais recente', () => {
    const sugestoes = sugerirRecorrentes([
      linha({ date: '2026-07-10', description: 'Construtora', amountCents: 120000 }),
      linha({ date: '2026-08-10', description: 'Construtora', amountCents: 120480 }),
      linha({ date: '2026-09-10', description: 'Construtora', amountCents: 120962 }),
    ])
    expect(sugestoes[0]!.amountCents).toBe(120962)
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

describe('parcelas', () => {
  it('lê a parcela quando a palavra está na descrição', () => {
    expect(lerParcela('PARC 05/60 CONSTRUTORA ALFA')).toEqual({ atual: 5, total: 60 })
    expect(lerParcela('Prestação 12 de 48 - moto')).toEqual({ atual: 12, total: 48 })
    expect(lerParcela('Parcela 3/2')).toBeNull()
    expect(lerParcela('Netflix 10/2026')).toBeNull()
  })

  it('a regra leva a descrição sem o número da parcela', () => {
    expect(semParcela('PAG BOLETO BANCO HONDA PARC 20/48')).toBe('PAG BOLETO BANCO HONDA')
    expect(semParcela('Prestação 12 de 48 - moto')).toBe('moto')
    expect(semParcela('CONSTRUTORA ALFA 12/60')).toBe('CONSTRUTORA ALFA')
    expect(semParcela('PARC 3/10')).toBe('PARC 3/10')
  })

  it('a parcela vira regra com fim no mês da última', () => {
    const sugestoes = sugerirRecorrentes([
      linha({ date: '2026-07-10', description: 'PARC 16/48 MOTO HONDA', amountCents: 78945 }),
      linha({ date: '2026-08-10', description: 'PARC 17/48 MOTO HONDA', amountCents: 78945 }),
      linha({ date: '2026-09-10', description: 'PARC 18/48 MOTO HONDA', amountCents: 78945 }),
    ])
    expect(sugestoes[0]).toMatchObject({
      parcela: { atual: 18, total: 48 },
      startDate: '2026-10-01',
      // Faltam 30 parcelas depois de setembro de 2026: a última é em março de 2029.
      endDate: '2029-03-10',
    })
  })

  it('com a palavra "parcela", dois meses bastam', () => {
    const sugestoes = sugerirRecorrentes([
      linha({ date: '2026-08-05', description: 'Parcela 2/12 Curso', amountCents: 25000 }),
      linha({ date: '2026-09-05', description: 'Parcela 3/12 Curso', amountCents: 25000 }),
    ])
    expect(sugestoes[0]?.endDate).toBe('2027-06-05')
  })

  it('número solto só vale como parcela se andar junto com o mês', () => {
    const parcela = (data: string, n: number) =>
      linha({ date: data, description: `CONSTRUTORA ALFA ${n}/60`, amountCents: 120000 + n * 300 })
    const sugestoes = sugerirRecorrentes([
      parcela('2026-07-15', 10),
      parcela('2026-08-15', 11),
      parcela('2026-09-15', 12),
    ])
    expect(sugestoes[0]?.parcela).toEqual({ atual: 12, total: 60 })

    // Uma data no texto não passa: 05/07, 12/08 e 03/09 não andam como parcela.
    const datas = sugerirRecorrentes([
      linha({ date: '2026-07-05', description: 'Pix 05/07' }),
      linha({ date: '2026-08-05', description: 'Pix 12/08' }),
      linha({ date: '2026-09-05', description: 'Pix 03/09' }),
    ])
    expect(datas[0]?.parcela ?? null).toBeNull()
  })

  it('parcelamento quitado não vira regra', () => {
    expect(
      sugerirRecorrentes([
        linha({ date: '2026-07-10', description: 'PARC 10/12 SOFA' }),
        linha({ date: '2026-08-10', description: 'PARC 11/12 SOFA' }),
        linha({ date: '2026-09-10', description: 'PARC 12/12 SOFA' }),
      ]),
    ).toEqual([])
  })
})

describe('regularidade', () => {
  it('um mês faltando num histórico longo não desfaz a conta', () => {
    const meses = ['2026-02', '2026-03', '2026-05', '2026-06', '2026-07']
    const sugestoes = sugerirRecorrentes(meses.map((mes) => linha({ date: `${mes}-10` })))
    expect(sugestoes).toHaveLength(1)
  })

  it('buraco de dois meses seguidos já não é série', () => {
    const meses = ['2026-01', '2026-02', '2026-05', '2026-06', '2026-07']
    expect(sugerirRecorrentes(meses.map((mes) => linha({ date: `${mes}-10` })))).toEqual([])
  })

  it('descrição que muda todo mês é reconhecida pelo valor exato', () => {
    const sugestoes = sugerirRecorrentes([
      linha({ date: '2026-07-10', description: 'PIX ENVIADO JOAO', amountCents: 150000 }),
      linha({ date: '2026-08-11', description: 'TRANSF ENVIADA J SILVA', amountCents: 150000 }),
      linha({ date: '2026-09-09', description: 'PIX JOAO DA SILVA', amountCents: 150000 }),
    ])
    expect(sugestoes).toHaveLength(1)
    expect(sugestoes[0]).toMatchObject({ amountCents: 150000, dayOfMonth: 10 })
  })

  it('pelo valor, o dia tem de bater', () => {
    expect(
      sugerirRecorrentes([
        linha({ date: '2026-07-02', description: 'Loja A', amountCents: 5000 }),
        linha({ date: '2026-08-19', description: 'Loja B', amountCents: 5000 }),
        linha({ date: '2026-09-28', description: 'Loja C', amountCents: 5000 }),
      ]),
    ).toEqual([])
  })
})

describe('no histórico', () => {
  const lanc = (
    over: Partial<LancamentoDoHistorico> & { id: string; date: string },
  ): LancamentoDoHistorico => ({
    description: 'PARC CONSTRUTORA ALFA',
    amountCents: 120000,
    kind: 'expense',
    account_id: 'cc',
    category_id: 'moradia',
    installment_group_id: null,
    recurring_id: null,
    ...over,
  })
  const tres = [
    lanc({ id: 'a', date: '2026-07-15' }),
    lanc({ id: 'b', date: '2026-08-15' }),
    lanc({ id: 'c', date: '2026-09-15' }),
  ]

  it('acha no que já está gravado, com conta e categoria da mais recente', () => {
    const achados = recorrentesNoHistorico(tres, [], '2026-10-04')
    expect(achados).toHaveLength(1)
    expect(achados[0]).toMatchObject({
      accountId: 'cc',
      categoryId: 'moradia',
      startDate: '2026-10-01',
    })
    expect(achados[0]!.ocorrencias.map((o) => o.id)).toEqual(['a', 'b', 'c'])
  })

  it('não sugere o que já tem regra, nem com outro nome', () => {
    const regra = {
      description: 'Apartamento',
      kind: 'expense' as const,
      amount_cents: 120000,
      account_id: 'cc',
      day_of_month: 15,
    }
    expect(recorrentesNoHistorico(tres, [regra], '2026-10-04')).toEqual([])
  })

  it('deixa de fora o que parou há meses e o que já veio de uma regra', () => {
    expect(recorrentesNoHistorico(tres, [], '2027-02-01')).toEqual([])
    expect(
      recorrentesNoHistorico(
        tres.map((t) => ({ ...t, recurring_id: 'r' })),
        [],
        '2026-10-04',
      ),
    ).toEqual([])
  })

  it('a busca monta a regra mesmo sem regularidade', () => {
    const proposta = propostaDaBusca(
      [
        lanc({ id: 'm1', date: '2026-03-12', description: 'Boleto moto 03/48', amountCents: 78945 }),
        lanc({ id: 'm2', date: '2026-06-20', description: 'Boleto moto 06/48', amountCents: 78945 }),
        lanc({ id: 'x', date: '2026-06-01', description: 'Mercado', amountCents: 9000 }),
      ],
      'MOTO',
    )
    expect(proposta).toMatchObject({ meses: 2, amountCents: 78945, accountId: 'cc' })
    expect(propostaDaBusca(tres, 'inexistente')).toBeNull()
    expect(propostaDaBusca(tres, 'a')).toBeNull()
  })
})
