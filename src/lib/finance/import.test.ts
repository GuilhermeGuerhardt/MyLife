import { describe, expect, it } from 'vitest'
import {
  buildRows,
  cleanAccountLabel,
  detectColumns,
  detectDelimiter,
  distinctLabels,
  markDuplicates,
  missingFields,
  parseCsv,
  parseDate,
  parseInstallment,
  parseKind,
  parsePaid,
  summarize,
  type ImportRow,
} from './import'

/** Um recorte fiel do extrato exportado, com os casos que quebram parser ruim. */
const SAMPLE = [
  'Tipo,Valor,Data,Nome,Descrição,Método,Categoria,Status',
  'Despesa,"R$ 869,59",2026-09-23,Geladeira (5/48),-,Conta - Banco Azul,Veículo,Falta pagar',
  'Despesa,"R$ 1.130,00",2026-08-06,Empréstimo ,-,Conta - Banco Azul,Empréstimo,Já foi pago',
  'Receita,"R$ 280,20",2026-08-16,Delivery ,-,Conta - Banco Azul,Rendimento,Já recebido',
  'Despesa,"R$ 192,49",2026-09-30,Boleto ,Internet,Conta - Banco Azul,Pagamento,Falta pagar',
].join('\n')

describe('leitura do CSV', () => {
  it('descobre o separador', () => {
    expect(detectDelimiter(SAMPLE)).toBe(',')
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';')
    expect(detectDelimiter('a\tb\tc')).toBe('\t')
  })

  it('não quebra o valor na vírgula dos centavos', () => {
    const rows = parseCsv(SAMPLE)
    expect(rows).toHaveLength(5)
    expect(rows[2]!).toEqual([
      'Despesa',
      'R$ 1.130,00',
      '2026-08-06',
      'Empréstimo ',
      '-',
      'Conta - Banco Azul',
      'Empréstimo',
      'Já foi pago',
    ])
  })

  it('entende aspas escapadas e o BOM do Excel', () => {
    expect(parseCsv('﻿a,b\n"diz ""oi""",2')).toEqual([
      ['a', 'b'],
      ['diz "oi"', '2'],
    ])
  })

  it('ignora linhas em branco no fim do arquivo', () => {
    expect(parseCsv('a,b\n1,2\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('mapeamento de colunas', () => {
  it('reconhece o cabeçalho do extrato', () => {
    const map = detectColumns(parseCsv(SAMPLE)[0]!)
    expect(map).toEqual({
      kind: 0,
      amount: 1,
      date: 2,
      description: 3,
      detail: 4,
      account: 5,
      category: 6,
      status: 7,
    })
    expect(missingFields(map)).toEqual([])
  })

  it('não deixa "Descrição" roubar a vaga de "Nome"', () => {
    // O arquivo tem as duas colunas: "Nome" é o lançamento e "Descrição" é o
    // complemento. Trocá-las encheria o app de despesas chamadas "-".
    const map = detectColumns(['Nome', 'Descrição'])
    expect(map.description).toBe(0)
    expect(map.detail).toBe(1)
  })

  it('aponta o que falta quando o cabeçalho é estranho', () => {
    expect(missingFields(detectColumns(['coluna a', 'coluna b']))).toEqual([
      'date',
      'amount',
      'description',
    ])
  })
})

describe('leitura de célula', () => {
  it('aceita data ISO e brasileira', () => {
    expect(parseDate('2026-09-30')).toBe('2026-09-30')
    expect(parseDate('30/09/2026')).toBe('2026-09-30')
    expect(parseDate('5/1/26')).toBe('2026-01-05')
    expect(parseDate('30/02/2026')).toBeNull()
    expect(parseDate('ontem')).toBeNull()
    expect(parseDate('')).toBeNull()
  })

  it('descobre receita e despesa', () => {
    expect(parseKind('Despesa', 'R$ 10,00')).toBe('expense')
    expect(parseKind('Receita', 'R$ 10,00')).toBe('income')
    // Sem coluna de tipo, o sinal decide.
    expect(parseKind('', '-10,00')).toBe('expense')
    expect(parseKind('', '10,00')).toBe('income')
  })

  it('não confunde "Falta pagar" com pago', () => {
    // As duas frases contêm "pag" — a negação precisa ganhar.
    expect(parsePaid('Falta pagar')).toBe(false)
    expect(parsePaid('Já foi pago')).toBe(true)
    expect(parsePaid('Já recebido')).toBe(true)
    expect(parsePaid('')).toBe(true)
  })

  it('separa a parcela do nome', () => {
    expect(parseInstallment('Geladeira (5/48)')).toEqual({
      description: 'Geladeira',
      installment: { n: 5, total: 48 },
    })
    expect(parseInstallment('Reforma (2/24)').installment).toEqual({ n: 2, total: 24 })
    expect(parseInstallment('Mercearia').installment).toBeNull()
    // Parcela impossível é texto, não parcela.
    expect(parseInstallment('Coisa (9/2)').installment).toBeNull()
  })

  it('tira o prefixo do rótulo da conta', () => {
    expect(cleanAccountLabel('Conta - Banco Azul')).toBe('Banco Azul')
    expect(cleanAccountLabel('Cartão - Crédito Azul')).toBe('Crédito Azul')
    expect(cleanAccountLabel('Banco Azul')).toBe('Banco Azul')
  })
})

describe('linhas prontas', () => {
  const rows = () => {
    const cells = parseCsv(SAMPLE)
    return buildRows(cells.slice(1), detectColumns(cells[0]!))
  }

  it('converte o extrato inteiro', () => {
    const [moto, pedro, ifood, boleto] = rows()

    expect(moto).toMatchObject({
      line: 2,
      date: '2026-09-23',
      kind: 'expense',
      amountCents: 86959,
      description: 'Geladeira',
      installment: { n: 5, total: 48 },
      accountLabel: 'Banco Azul',
      categoryLabel: 'Veículo',
      paid: false,
      detail: null,
      error: null,
    })

    expect(pedro).toMatchObject({ amountCents: 113000, paid: true, description: 'Empréstimo' })
    expect(ifood).toMatchObject({ kind: 'income', amountCents: 28020, paid: true })
    // "-" é célula vazia; "Internet" é complemento de verdade.
    expect(boleto!.detail).toBe('Internet')
  })

  it('marca a linha ruim sem derrubar as boas', () => {
    const bad = buildRows(
      [
        ['Despesa', 'R$ 10,00', 'qualquer coisa', 'Mercado', '', '', '', ''],
        ['Despesa', '', '2026-08-01', 'Mercado', '', '', '', ''],
        ['Despesa', 'R$ 10,00', '2026-08-01', 'Mercado', '', '', '', ''],
      ],
      detectColumns(parseCsv(SAMPLE)[0]!),
    )
    expect(bad[0]!.error).toContain('Data inválida')
    expect(bad[1]!.error).toContain('Sem valor')
    expect(bad[2]!.error).toBeNull()
  })

  it('lista os rótulos distintos para o mapeamento', () => {
    expect(distinctLabels(rows(), (row) => row.categoryLabel)).toEqual([
      'Veículo',
      'Empréstimo',
      'Rendimento',
      'Pagamento',
    ])
    expect(distinctLabels(rows(), (row) => row.accountLabel)).toEqual(['Banco Azul'])
  })
})

describe('deduplicação', () => {
  const row = (date: string, cents: number, description: string): ImportRow => ({
    line: 2,
    date,
    kind: 'expense',
    amountCents: cents,
    description,
    detail: null,
    accountLabel: '',
    categoryLabel: '',
    paid: true,
    installment: null,
    error: null,
    duplicate: false,
    repeated: false,
  })

  it('reconhece o que já foi importado', () => {
    const marked = markDuplicates(
      [row('2026-08-07', 540, 'Metro'), row('2026-08-06', 350, 'Mercearia')],
      [{ date: '2026-08-07', amount_cents: 540, description: 'metro', kind: 'expense' }],
    )
    expect(marked[0]!.duplicate).toBe(true)
    expect(marked[1]!.duplicate).toBe(false)
  })

  it('deixa passar a repetição legítima do mesmo dia', () => {
    // Duas viagens de metrô de R$ 5,40 no mesmo dia são dois lançamentos.
    const marked = markDuplicates(
      [row('2026-08-07', 540, 'Metro'), row('2026-08-07', 540, 'Metro')],
      [],
    )
    expect(marked.map((item) => item.duplicate)).toEqual([false, false])
    expect(marked[1]!.repeated).toBe(true)
  })

  it('consome uma ocorrência existente por vez', () => {
    // O app já tem uma das duas viagens: a primeira linha é duplicata, a
    // segunda ainda precisa entrar.
    const marked = markDuplicates(
      [row('2026-08-07', 540, 'Metro'), row('2026-08-07', 540, 'Metro')],
      [{ date: '2026-08-07', amount_cents: 540, description: 'Metro', kind: 'expense' }],
    )
    expect(marked.map((item) => item.duplicate)).toEqual([true, false])
  })
})

describe('resumo', () => {
  it('soma só o que foi marcado para importar', () => {
    const cells = parseCsv(SAMPLE)
    const rows = markDuplicates(buildRows(cells.slice(1), detectColumns(cells[0]!)), [])
    const summary = summarize(rows, (row) => !row.error && !row.duplicate)

    expect(summary).toMatchObject({
      total: 4,
      ready: 4,
      errors: 0,
      duplicates: 0,
      incomeCents: 28020,
      expenseCents: 86959 + 113000 + 19249,
      from: '2026-08-06',
      to: '2026-09-30',
    })
  })
})
