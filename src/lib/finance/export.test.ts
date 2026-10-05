import { describe, expect, it } from 'vitest'
import {
  buildExportRows,
  escapeField,
  exportFilename,
  filtrarPorPeriodo,
  periodoDeTudo,
  periodoValido,
  toBrAmount,
  toBrDate,
  toCsv,
  toCsvFile,
  withInstallment,
  type ExportTransaction,
} from './export'
import { buildRows, detectColumns, missingFields, parseCsv } from './import'

const NAMES = {
  account: (id: string) => (id === 'a1' ? 'Crédito Azul' : 'Carteira'),
  category: (id: string | null) => (id === 'c1' ? 'Mercado' : ''),
}

function tx(over: Partial<ExportTransaction> = {}): ExportTransaction {
  return {
    date: '2026-03-14',
    kind: 'expense',
    amount_cents: 3550,
    description: 'Mercado',
    notes: null,
    account_id: 'a1',
    transfer_account_id: null,
    category_id: 'c1',
    paid: true,
    installment_n: null,
    installment_total: null,
    ...over,
  }
}

describe('formatação', () => {
  it('escreve a data como o Excel brasileiro espera', () => {
    expect(toBrDate('2026-03-14')).toBe('14/03/2026')
  })

  it('agrupa o milhar e usa vírgula decimal', () => {
    expect(toBrAmount(113000)).toBe('1.130,00')
    expect(toBrAmount(3550)).toBe('35,50')
    expect(toBrAmount(5)).toBe('0,05')
    expect(toBrAmount(123456789)).toBe('1.234.567,89')
  })

  it('devolve a parcela para a descrição, e só quando existe', () => {
    expect(withInstallment('Geladeira', 3, 12)).toBe('Geladeira (3/12)')
    expect(withInstallment('Café', null, null)).toBe('Café')
    expect(withInstallment('Café', 1, 1)).toBe('Café')
  })

  it('só põe aspas quando o campo precisa', () => {
    expect(escapeField('Mercado', ';')).toBe('Mercado')
    expect(escapeField('Padaria; Pão', ';')).toBe('"Padaria; Pão"')
    expect(escapeField('Diz "oi"', ';')).toBe('"Diz ""oi"""')
    expect(escapeField('duas\nlinhas', ';')).toBe('"duas\nlinhas"')
  })

  it('abre o arquivo com BOM, senão o Excel come os acentos', () => {
    expect(toCsvFile([['Situação']])).toMatch(/^﻿/)
  })
})

describe('buildExportRows', () => {
  it('põe o cabeçalho que a importação reconhece', () => {
    const [header] = buildExportRows([], NAMES)
    expect(header).toEqual([
      'Data',
      'Valor',
      'Tipo',
      'Descrição',
      'Complemento',
      'Conta',
      'Destino',
      'Categoria',
      'Situação',
      'Fatura',
    ])
  })

  it('diz em qual fatura a compra no cartão caiu, e qual fatura o pagamento quitou', () => {
    const comCartao = {
      ...NAMES,
      cartao: (id: string) => (id === 'cartao' ? { closingDay: 20, dueDay: 28 } : null),
    }
    const [, compra, pagamento, comum] = buildExportRows(
      [
        // 24/09 num cartão que fecha dia 20 é da fatura de outubro.
        tx({ date: '2026-09-24', account_id: 'cartao' }),
        tx({ date: '2026-09-25', kind: 'transfer', account_id: 'a1', transfer_account_id: 'cartao', invoice_competence: '2026-09', category_id: null }),
        tx({ date: '2026-09-26' }),
      ],
      comCartao,
    )
    expect(compra!.at(-1)).toBe('10/2026')
    expect(pagamento!.at(-1)).toBe('09/2026')
    expect(comum!.at(-1)).toBe('')
  })

  it('ordena por data crescente, como um extrato', () => {
    const rows = buildExportRows(
      [tx({ date: '2026-03-20', description: 'B' }), tx({ date: '2026-03-01', description: 'A' })],
      NAMES,
    )
    expect(rows.slice(1).map((r) => r[3])).toEqual(['A', 'B'])
  })

  it('escreve situação e tipo em português', () => {
    const [, pago] = buildExportRows([tx()], NAMES)
    expect(pago).toMatchObject({ 2: 'Despesa', 8: 'Pago' })

    const [, aberto] = buildExportRows([tx({ paid: false, kind: 'income' })], NAMES)
    expect(aberto![2]).toBe('Receita')
    expect(aberto![8]).toBe('Em aberto')
  })

  it('a transferência leva a conta que recebe', () => {
    const [, linha] = buildExportRows(
      [tx({ kind: 'transfer', account_id: 'a1', transfer_account_id: 'a2', category_id: null })],
      NAMES,
    )
    expect(linha![2]).toBe('Transferência')
    expect(linha![5]).toBe('Crédito Azul')
    expect(linha![6]).toBe('Carteira')
  })

  it('deixa a célula vazia quando não há categoria, complemento ou destino', () => {
    const [, linha] = buildExportRows([tx({ category_id: null, notes: null })], NAMES)
    expect(linha![4]).toBe('')
    expect(linha![6]).toBe('')
    expect(linha![7]).toBe('')
  })
})

/**
 * O teste que justifica o formato: o arquivo exportado tem que voltar pela
 * porta da importação sem edição nenhuma e reproduzir o que saiu.
 */
describe('ida e volta pelo importador', () => {
  const originais = [
    tx({ date: '2026-03-01', description: 'Mercado', amount_cents: 11300 }),
    tx({
      date: '2026-03-05',
      description: 'Geladeira',
      amount_cents: 41625,
      installment_n: 3,
      installment_total: 12,
      paid: false,
    }),
    tx({ date: '2026-03-10', description: 'Salário', amount_cents: 850000, kind: 'income' }),
    tx({ date: '2026-03-12', description: 'Padaria; do Zé', amount_cents: 1250, notes: 'com aspas "aqui"' }),
  ]

  const csv = toCsvFile(buildExportRows(originais, NAMES))
  const cells = parseCsv(csv)
  const map = detectColumns(cells[0]!)

  it('reconhece todas as colunas obrigatórias', () => {
    expect(missingFields(map)).toEqual([])
  })

  /**
   * A transferência é a que mais tinha a perder na volta: sem a coluna de
   * destino ela voltava como despesa, e os R$ 100 que só trocaram de conta
   * viravam gasto do mês.
   */
  it('a transferência volta transferência, com as duas contas', () => {
    const arquivo = toCsvFile(
      buildExportRows(
        [tx({ kind: 'transfer', account_id: 'a1', transfer_account_id: 'a2', category_id: null })],
        NAMES,
      ),
    )
    const grade = parseCsv(arquivo)
    const volta = buildRows(grade.slice(1), detectColumns(grade[0]!))[0]!

    expect(volta.error).toBeNull()
    expect(volta.kind).toBe('transfer')
    expect(volta.accountLabel).toBe('Crédito Azul')
    expect(volta.transferToLabel).toBe('Carteira')
  })

  it('mapeia as nove colunas, não só as obrigatórias', () => {
    expect(Object.keys(map).sort()).toEqual(
      [
        'account',
        'amount',
        'category',
        'date',
        'description',
        'detail',
        'kind',
        'status',
        'transferTo',
      ].sort(),
    )
  })

  it('devolve data, valor, tipo e descrição idênticos', () => {
    const voltaram = buildRows(cells.slice(1), map)
    expect(voltaram.map((r) => r.error)).toEqual([null, null, null, null])

    expect(voltaram.map((r) => ({ date: r.date, cents: r.amountCents, kind: r.kind }))).toEqual([
      { date: '2026-03-01', cents: 11300, kind: 'expense' },
      { date: '2026-03-05', cents: 41625, kind: 'expense' },
      { date: '2026-03-10', cents: 850000, kind: 'income' },
      { date: '2026-03-12', cents: 1250, kind: 'expense' },
    ])
  })

  it('recupera a parcela em vez de deixá-la grudada no nome', () => {
    const geladeira = buildRows(cells.slice(1), map).find((r) => r.description === 'Geladeira')
    expect(geladeira?.installment).toEqual({ n: 3, total: 12 })
  })

  it('preserva o que está em aberto', () => {
    const voltaram = buildRows(cells.slice(1), map)
    expect(voltaram.map((r) => r.paid)).toEqual([true, false, true, true])
  })

  it('sobrevive a ponto e vírgula e aspas dentro do campo', () => {
    const zé = buildRows(cells.slice(1), map).find((r) => r.date === '2026-03-12')
    expect(zé?.description).toBe('Padaria; do Zé')
    expect(zé?.detail).toBe('com aspas "aqui"')
  })

  it('traz conta e categoria pelo nome', () => {
    const voltaram = buildRows(cells.slice(1), map)
    expect(voltaram[0]?.accountLabel).toBe('Crédito Azul')
    expect(voltaram[0]?.categoryLabel).toBe('Mercado')
  })
})

describe('período', () => {
  const linhas = [
    { competence: '2024-11' },
    { competence: '2025-04' },
    { competence: '2026-01' },
    { competence: '2026-03' },
  ]

  const meses = (periodo: { de: string; ate: string }) =>
    filtrarPorPeriodo(linhas, periodo).map((l) => l.competence)

  it('inclui os dois meses das pontas', () => {
    expect(meses({ de: '2025-04', ate: '2026-01' })).toEqual(['2025-04', '2026-01'])
  })

  it('traz um mês só quando as pontas são iguais', () => {
    expect(meses({ de: '2026-03', ate: '2026-03' })).toEqual(['2026-03'])
  })

  it('vai até o último lançamento quando o fim está vazio', () => {
    expect(meses({ de: '2026-01', ate: '' })).toEqual(['2026-01', '2026-03'])
  })

  it('começa no primeiro lançamento quando o começo está vazio', () => {
    expect(meses({ de: '', ate: '2025-04' })).toEqual(['2024-11', '2025-04'])
  })

  it('sem nenhuma ponta é tudo', () => {
    expect(meses({ de: '', ate: '' })).toHaveLength(4)
  })

  it('não devolve nada quando o fim vem antes do começo', () => {
    expect(meses({ de: '2026-03', ate: '2025-01' })).toEqual([])
    expect(periodoValido({ de: '2026-03', ate: '2025-01' })).toBe(false)
  })

  it('aceita o intervalo com uma ponta aberta', () => {
    expect(periodoValido({ de: '', ate: '2020-01' })).toBe(true)
  })

  it('abre cobrindo do primeiro ao último lançamento', () => {
    expect(periodoDeTudo(linhas, '2026-09')).toEqual({ de: '2024-11', ate: '2026-03' })
  })

  it('sem lançamento nenhum, abre no mês de hoje', () => {
    expect(periodoDeTudo([], '2026-09')).toEqual({ de: '2026-09', ate: '2026-09' })
  })
})

describe('nome do arquivo', () => {
  it('carrega o intervalo', () => {
    expect(exportFilename({ de: '2026-01', ate: '2026-03' }, '2026-03-21')).toBe(
      'life-lancamentos-2026-01-a-2026-03.csv',
    )
  })

  it('usa só a competência quando é um mês só', () => {
    expect(exportFilename({ de: '2026-03', ate: '2026-03' }, '2026-03-21')).toBe(
      'life-lancamentos-2026-03.csv',
    )
  })

  it('diz de onde vem, ou até onde vai, na ponta aberta', () => {
    expect(exportFilename({ de: '2026-01', ate: '' }, '2026-03-21')).toBe(
      'life-lancamentos-desde-2026-01.csv',
    )
    expect(exportFilename({ de: '', ate: '2026-01' }, '2026-03-21')).toBe(
      'life-lancamentos-ate-2026-01.csv',
    )
  })

  it('cai na data do dia quando as duas pontas estão abertas', () => {
    expect(exportFilename({ de: '', ate: '' }, '2026-03-21')).toBe('life-lancamentos-2026-03-21.csv')
  })
})

describe('toCsv', () => {
  it('separa por ponto e vírgula e quebra linha com CRLF', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('a;b\r\nc;d')
  })
})
