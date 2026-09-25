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
  summarize,
} from './import'

/** O exportador separa `R$` do número com U+00A0, não com espaço comum. */
const NB = ' '

const EXTRATO = [
  'Tipo,Valor,Data,Nome,Descrição,Método,Categoria,Status',
  `Despesa,"R$${NB}869,59",2026-09-23,Geladeira (5/48),-,Conta - Banco Azul,Veículo,Falta pagar`,
  `Despesa,"R$${NB}869,59",2026-08-24,Geladeira (4/48),-,Conta - Banco Azul,Veículo,Já foi pago`,
  `Despesa,"R$${NB}890,16",2026-05-26,Geladeira (1/48),-,Conta - Banco Azul,Veículo,Já foi pago`,
  `Despesa,"R$${NB}550,00",2026-10-22,Reforma (3/24),-,Conta - Banco Azul,Moradia,Falta pagar`,
  `Despesa,"R$${NB}554,29",2026-08-21,Reforma (1/24),-,Conta - Banco Azul,Moradia,Já foi pago`,
  `Despesa,"R$${NB}4.500,00",2026-12-22,Reforma (1/2),-,Conta - Banco Azul,Moradia,Falta pagar`,
  `Despesa,"R$${NB}510,00",2026-07-26,Reforma ,-,Conta - Banco Azul,Moradia,Já foi pago`,
  `Receita,"R$${NB}1.119,14",2026-08-20,Empresa ,-,Conta - Banco Azul,Salário,Já recebido`,
  `Despesa,"R$${NB}675,21",2026-11-30,Boleto ,Internet,Conta - Banco Azul,Pagamento,Falta pagar`,
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
    expect(new Set(rows.map((r) => r.accountLabel))).toEqual(new Set(['Banco Azul']))
  })

  it('separa a parcela do nome', () => {
    const { rows } = ler()
    expect(rows[0]!.description).toBe('Geladeira')
    expect(rows[0]!.installment).toEqual({ n: 5, total: 48 })
  })

  it('lançamento sem marcação de parcela não vira parcelado', () => {
    const { rows } = ler()
    const avulso = rows.find((r) => r.description === 'Reforma' && !r.installment)
    expect(avulso).toBeDefined()
    expect(avulso!.amountCents).toBe(51000)
  })

  it('duas séries de mesmo nome e totais diferentes não se misturam', () => {
    const { rows } = ler()
    const econ = rows.filter((r) => r.description === 'Reforma' && r.installment)
    expect(new Set(econ.map(grupo))).toEqual(
      new Set(['reforma|24', 'reforma|2']),
    )
  })

  it('a primeira parcela mantém o valor diferente das demais', () => {
    const { rows } = ler()
    const cg = rows.filter((r) => r.description === 'Geladeira')
    expect(cg.find((r) => r.installment!.n === 1)!.amountCents).toBe(89016)
    expect(cg.find((r) => r.installment!.n === 4)!.amountCents).toBe(86959)
  })

  it('a situação vale por parcela, não pelo grupo', () => {
    const { rows } = ler()
    const cg = rows.filter((r) => r.description === 'Geladeira')
    expect(cg.find((r) => r.installment!.n === 4)!.paid).toBe(true)
    expect(cg.find((r) => r.installment!.n === 5)!.paid).toBe(false)
  })

  it('"Falta pagar" e "Já foi pago" não se confundem', () => {
    const { rows } = ler()
    expect(rows.find((r) => r.description === 'Boleto')!.paid).toBe(false)
    expect(rows.find((r) => r.description === 'Reforma' && !r.installment)!.paid).toBe(
      true,
    )
  })

  it('receita marcada como "Já recebido" entra como recebida', () => {
    const { rows } = ler()
    const salario = rows.find((r) => r.description === 'Empresa')!
    expect(salario.kind).toBe('income')
    expect(salario.paid).toBe(true)
  })

  it('traço na coluna de descrição vira vazio, e texto de verdade fica', () => {
    const { rows } = ler()
    expect(rows[0]!.detail).toBeNull()
    expect(rows.find((r) => r.description === 'Boleto')!.detail).toBe('Internet')
  })

  it('linha idêntica repetida no arquivo continua importável', () => {
    // Dois lanches de mesmo valor no mesmo dia acontecem de verdade; o arquivo
    // real tem dois. Só o que já existe no app é que vem desmarcado.
    const dobrado = [
      'Tipo,Valor,Data,Nome,Descrição,Método,Categoria,Status',
      `Despesa,"R$${NB}4,89",2026-08-21,Delivery ,-,Conta - Banco Azul,Alimentação,Já foi pago`,
      `Despesa,"R$${NB}4,89",2026-08-21,Delivery ,-,Conta - Banco Azul,Alimentação,Já foi pago`,
    ].join('\n')
    const grade = parseCsv(dobrado, detectDelimiter(dobrado))
    const rows = markDuplicates(buildRows(grade.slice(1), detectColumns(grade[0]!)), [])
    expect(rows.filter((r) => r.duplicate)).toHaveLength(0)
  })
})

/**
 * A transferência do mesmo exportador.
 *
 * Ela chega com as contas escritas na frase e com o método em branco — um
 * traço —, porque dinheiro que anda entre contas da própria pessoa não tem
 * "método de pagamento". Era a linha que virava despesa e inflava o mês.
 */
describe('transferência no extrato', () => {
  const comTransferencia = (linha: string) =>
    [
      'Tipo,Valor,Data,Nome,Descrição,Método,Categoria,Status',
      linha,
      `Despesa,"R$${NB}23,90",2026-09-24,Padaria ,-,Conta - Banco Azul,Alimentação,Já foi pago`,
    ].join('\n')

  const lerLinha = (linha: string) => {
    const texto = comTransferencia(linha)
    const grade = parseCsv(texto, detectDelimiter(texto))
    const map = detectColumns(grade[0]!)
    return { map, rows: buildRows(grade.slice(1), map) }
  }

  const TRANSFERENCIA =
    `Transferência,"R$${NB}100,00",2026-09-24,Transferência de Banco Azul para Poupança,-,-,-,Já transferido`

  it('não é receita nem despesa', () => {
    const { rows } = lerLinha(TRANSFERENCIA)
    expect(rows[0]!.kind).toBe('transfer')
  })

  it('tira as duas contas da frase, já que o método vem em branco', () => {
    const { rows } = lerLinha(TRANSFERENCIA)
    expect(rows[0]!.accountLabel).toBe('Banco Azul')
    expect(rows[0]!.transferToLabel).toBe('Poupança')
  })

  it('entra sem erro e sem categoria', () => {
    const { rows } = lerLinha(TRANSFERENCIA)
    expect(rows[0]!.error).toBeNull()
    expect(rows[0]!.categoryLabel).toBe('')
  })

  it('fica fora das somas de receita e despesa', () => {
    const { rows } = lerLinha(TRANSFERENCIA)
    const resumo = summarize(rows, () => true)
    expect(resumo.ready).toBe(2)
    // Só o Padaria de R$ 23,90; os R$ 100 que trocaram de conta não contam.
    expect(resumo.expenseCents).toBe(2390)
    expect(resumo.incomeCents).toBe(0)
  })

  it('sem as duas pontas, recusa a linha em vez de inventar uma despesa', () => {
    const { rows } = lerLinha(
      `Transferência,"R$${NB}100,00",2026-09-24,Aplicação no CDB,-,-,-,Já transferido`,
    )
    expect(rows[0]!.kind).toBe('transfer')
    expect(rows[0]!.error).toMatch(/destino/i)
  })

  it('a coluna de destino manda mais que a frase', () => {
    const texto = [
      'Tipo,Valor,Data,Nome,Método,Destino,Status',
      `Transferência,"R$${NB}100,00",2026-09-24,Transferência de Banco Azul para Poupança,Conta - Banco Azul,Poupança,Já transferido`,
    ].join('\n')
    const grade = parseCsv(texto, detectDelimiter(texto))
    const map = detectColumns(grade[0]!)
    const rows = buildRows(grade.slice(1), map)

    expect(map.transferTo).toBe(5)
    expect(rows[0]!.transferToLabel).toBe('Poupança')
  })
})
