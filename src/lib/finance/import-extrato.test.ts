/**
 * Formato exportado pelo app de finanças que o usuário trazia antes.
 *
 * Amostra reduzida de um extrato real, mantendo só o que é difícil: duas séries
 * de parcela com o mesmo nome e totais diferentes, primeira parcela com valor
 * diferente das demais, situação variando dentro do mesmo grupo, e o espaço não
 * separável que o exportador põe entre `R$` e o número.
 */

import { describe, expect, it } from 'vitest'
import {
  buildRows,
  detectColumns,
  detectDelimiter,
  markDuplicates,
  missingFields,
  normalizeText,
  parseCsv,
} from './import'

/** O exportador separa `R$` do número com U+00A0, não com espaço comum. */
const NB = ' '

const EXTRATO = [
  'Tipo,Valor,Data,Nome,Descrição,Método,Categoria,Status',
  `Despesa,"R$${NB}869,59",2026-09-23,CG 160 Fan (5/48),-,Conta - Banco Inter,Veículo,Falta pagar`,
  `Despesa,"R$${NB}869,59",2026-08-24,CG 160 Fan (4/48),-,Conta - Banco Inter,Veículo,Já foi pago`,
  `Despesa,"R$${NB}890,16",2026-05-26,CG 160 Fan (1/48),-,Conta - Banco Inter,Veículo,Já foi pago`,
  `Despesa,"R$${NB}550,00",2026-10-22,Econ Construtora (3/24),-,Conta - Banco Inter,Moradia,Falta pagar`,
  `Despesa,"R$${NB}554,29",2026-08-21,Econ Construtora (1/24),-,Conta - Banco Inter,Moradia,Já foi pago`,
  `Despesa,"R$${NB}4.500,00",2026-12-22,Econ Construtora (1/2),-,Conta - Banco Inter,Moradia,Falta pagar`,
  `Despesa,"R$${NB}510,00",2026-07-26,Econ Construtora ,-,Conta - Banco Inter,Moradia,Já foi pago`,
  `Receita,"R$${NB}1.119,14",2026-08-20,Digitrix ,-,Conta - Banco Inter,Salário,Já recebido`,
  `Despesa,"R$${NB}675,21",2026-11-30,Serasa ,Claro,Conta - Banco Inter,Pagamento,Falta pagar`,
].join('\n')

function ler() {
  const grade = parseCsv(EXTRATO, detectDelimiter(EXTRATO))
  const map = detectColumns(grade[0]!)
  return { map, rows: buildRows(grade.slice(1), map) }
}

/** A mesma chave que a importação usa para juntar as parcelas numa compra só. */
const grupo = (row: { description: string; installment: { total: number } | null }) =>
  row.installment ? `${normalizeText(row.description)}|${row.installment.total}` : null

describe('extrato do app anterior', () => {
  it('reconhece as oito colunas pelo cabeçalho, sem ajuste manual', () => {
    const { map } = ler()
    expect(missingFields(map)).toEqual([])
    expect(map).toMatchObject({
      kind: 0,
      amount: 1,
      date: 2,
      description: 3,
      detail: 4,
      account: 5,
      category: 6,
      status: 7,
    })
  })

  it('lê todas as linhas sem erro', () => {
    const { rows } = ler()
    expect(rows).toHaveLength(9)
    expect(rows.filter((r) => r.error)).toEqual([])
  })

  it('entende o valor com espaço não separável e milhar', () => {
    const { rows } = ler()
    expect(rows[0]!.amountCents).toBe(86959)
    expect(rows[6]!.amountCents).toBe(51000)
    expect(rows[7]!.amountCents).toBe(111914)
  })

  it('tira o prefixo do app do nome da conta', () => {
    const { rows } = ler()
    expect(new Set(rows.map((r) => r.accountLabel))).toEqual(new Set(['Banco Inter']))
  })

  it('separa a parcela do nome', () => {
    const { rows } = ler()
    expect(rows[0]!.description).toBe('CG 160 Fan')
    expect(rows[0]!.installment).toEqual({ n: 5, total: 48 })
  })

  it('lançamento sem marcação de parcela não vira parcelado', () => {
    const { rows } = ler()
    const avulso = rows.find((r) => r.description === 'Econ Construtora' && !r.installment)
    expect(avulso).toBeDefined()
    expect(avulso!.amountCents).toBe(51000)
  })

  it('duas séries de mesmo nome e totais diferentes não se misturam', () => {
    const { rows } = ler()
    const econ = rows.filter((r) => r.description === 'Econ Construtora' && r.installment)
    expect(new Set(econ.map(grupo))).toEqual(
      new Set(['econ construtora|24', 'econ construtora|2']),
    )
  })

  it('a primeira parcela mantém o valor diferente das demais', () => {
    const { rows } = ler()
    const cg = rows.filter((r) => r.description === 'CG 160 Fan')
    expect(cg.find((r) => r.installment!.n === 1)!.amountCents).toBe(89016)
    expect(cg.find((r) => r.installment!.n === 4)!.amountCents).toBe(86959)
  })

  it('a situação vale por parcela, não pelo grupo', () => {
    const { rows } = ler()
    const cg = rows.filter((r) => r.description === 'CG 160 Fan')
    expect(cg.find((r) => r.installment!.n === 4)!.paid).toBe(true)
    expect(cg.find((r) => r.installment!.n === 5)!.paid).toBe(false)
  })

  it('"Falta pagar" e "Já foi pago" não se confundem', () => {
    const { rows } = ler()
    expect(rows.find((r) => r.description === 'Serasa')!.paid).toBe(false)
    expect(rows.find((r) => r.description === 'Econ Construtora' && !r.installment)!.paid).toBe(
      true,
    )
  })

  it('receita marcada como "Já recebido" entra como recebida', () => {
    const { rows } = ler()
    const salario = rows.find((r) => r.description === 'Digitrix')!
    expect(salario.kind).toBe('income')
    expect(salario.paid).toBe(true)
  })

  it('traço na coluna de descrição vira vazio, e texto de verdade fica', () => {
    const { rows } = ler()
    expect(rows[0]!.detail).toBeNull()
    expect(rows.find((r) => r.description === 'Serasa')!.detail).toBe('Claro')
  })

  it('linha idêntica repetida no arquivo continua importável', () => {
    // Dois lanches de mesmo valor no mesmo dia acontecem de verdade; o arquivo
    // real tem dois. Só o que já existe no app é que vem desmarcado.
    const dobrado = [
      'Tipo,Valor,Data,Nome,Descrição,Método,Categoria,Status',
      `Despesa,"R$${NB}4,89",2026-08-21,Ifood ,-,Conta - Banco Inter,Alimentação,Já foi pago`,
      `Despesa,"R$${NB}4,89",2026-08-21,Ifood ,-,Conta - Banco Inter,Alimentação,Já foi pago`,
    ].join('\n')
    const grade = parseCsv(dobrado, detectDelimiter(dobrado))
    const rows = markDuplicates(buildRows(grade.slice(1), detectColumns(grade[0]!)), [])
    expect(rows.filter((r) => r.duplicate)).toHaveLength(0)
  })
})
