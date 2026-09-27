import { describe, expect, it } from 'vitest'
import { buildRows, detectColumns, missingFields, parseCsv } from './import'
import { linhasDoModelo, modeloDeImportacao, MODELO_NOME } from './modelo-importacao'

/**
 * O modelo existe para não dar erro na mão de quem baixou, então o teste não
 * confere o texto dele: passa o arquivo inteiro pelo importador de verdade, o
 * mesmo caminho que a tela percorre, e exige que as seis linhas entrem.
 */
const HOJE = '2026-09-26'
const grade = parseCsv(modeloDeImportacao(HOJE))
const map = detectColumns(grade[0]!)
const linhas = buildRows(grade.slice(1), map)

describe('modelo de importação', () => {
  it('tem as colunas obrigatórias reconhecidas sozinhas', () => {
    expect(missingFields(map)).toEqual([])
  })

  it('mapeia as nove colunas', () => {
    expect(Object.keys(map)).toHaveLength(9)
  })

  it('não deixa nenhuma linha com erro', () => {
    expect(linhas.map((linha) => linha.error)).toEqual([null, null, null, null, null])
  })

  it('traz os três tipos de lançamento', () => {
    expect(linhas.map((linha) => linha.kind)).toEqual([
      'income',
      'expense',
      'expense',
      'transfer',
      'expense',
    ])
  })

  it('lê os valores em reais', () => {
    expect(linhas[0]?.amountCents).toBe(420000)
    expect(linhas[1]?.amountCents).toBe(12990)
  })

  it('transforma a parcela escrita no nome em parcelamento', () => {
    expect(linhas[2]?.installment).toEqual({ n: 5, total: 48 })
    expect(linhas[2]?.description).toBe('Geladeira')
  })

  it('leva a transferência para a conta de destino', () => {
    expect(linhas[3]?.transferToLabel).toBe('Poupança')
  })

  it('distingue o que está pago do que está em aberto', () => {
    expect(linhas.map((linha) => linha.paid)).toEqual([true, true, true, true, false])
  })

  it('data as linhas no mês de quem baixou', () => {
    expect(linhas.map((linha) => linha.date)).toEqual([
      '2026-09-05',
      '2026-09-06',
      '2026-09-12',
      '2026-09-15',
      '2026-09-28',
    ])
  })

  it('acompanha o mês corrente em vez de envelhecer', () => {
    const outro = parseCsv(modeloDeImportacao('2027-02-03'))
    expect(buildRows(outro.slice(1), detectColumns(outro[0]!))[0]?.date).toBe('2027-02-05')
  })

  it('tem cabeçalho e cinco exemplos', () => {
    expect(linhasDoModelo(HOJE)).toHaveLength(6)
  })

  it('sai com nome de arquivo pronto para salvar', () => {
    expect(MODELO_NOME).toMatch(/\.csv$/)
  })
})
