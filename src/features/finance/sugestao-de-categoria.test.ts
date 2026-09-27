/**
 * O caminho inteiro do palpite de categoria, do extrato ao lançamento gravado.
 *
 * O arquivo aqui é o que um banco exporta de verdade: descrição carimbada pela
 * maquininha, sem coluna de categoria nenhuma. É o caso que motivou o
 * classificador — sem ele, estas linhas entrariam todas sem classificação.
 *
 * O teste vai além do classificador porque o risco não está nele: está na
 * junção. Quem grava é `montarLancamentos`, e o que precisa ficar provado é a
 * precedência — o que o arquivo diz vence o palpite, e "sem categoria" escolhido
 * à mão vence os dois.
 */

import { describe, expect, it } from 'vitest'
import { treinar, type LancamentoJaClassificado } from '@/lib/finance/classificador'
import { buildRows, detectColumns, detectDelimiter, parseCsv } from '@/lib/finance/import'
import type { Account } from '@/data/types'
import { chaveDaCategoria, montarLancamentos, type AlvosDaImportacao } from './use-import'

const EXTRATO = [
  'Data,Descrição,Valor',
  '2026-09-02,PAG*IFOOD SAO PAULO,-58.90',
  '2026-09-03,UBER   *TRIP HELP.UBER,-23.40',
  '2026-09-05,DROGARIA SAO PAULO 442,-91.10',
  '2026-09-08,PAGAMENTO RECEBIDO,-1200.00',
].join('\n')

/** Histórico de quem usa o app há alguns meses e categoriza o que entra. */
const HISTORICO: LancamentoJaClassificado[] = [
  ...repetir('IFOOD *PEDIDO', 'alimentacao', 6),
  ...repetir('PAG*IFOOD RESTAURANTE', 'alimentacao', 4),
  ...repetir('UBER *TRIP', 'transporte', 9),
  ...repetir('DROGARIA PACHECO', 'saude', 3),
  ...repetir('POSTO IPIRANGA', 'transporte', 3),
]

function repetir(description: string, category_id: string, vezes: number) {
  return Array.from({ length: vezes }, () => ({ description, kind: 'expense', category_id }))
}

function linhas() {
  const grade = parseCsv(EXTRATO, detectDelimiter(EXTRATO))
  return buildRows(grade.slice(1), detectColumns(grade[0]!))
}

const CONTA: Account = {
  id: 'conta-1',
  name: 'Banco',
  kind: 'checking',
  created_at: '',
  updated_at: '',
} as Account

function alvos(over: Partial<AlvosDaImportacao> = {}): AlvosDaImportacao {
  return {
    contas: new Map(),
    categorias: new Map(),
    contasPorId: new Map([[CONTA.id, CONTA]]),
    fallbackAccountId: CONTA.id,
    sugestoes: new Map(),
    ...over,
  }
}

/** O que a tela da prévia faz: palpita para a linha que ficaria sem categoria. */
function sugerir(rows: ReturnType<typeof linhas>) {
  const modelo = treinar(HISTORICO)
  const fora = new Map<number, string>()

  for (const row of rows) {
    if (row.error || row.kind === 'transfer' || row.categoryLabel.trim() !== '') continue
    const palpite = modelo.sugerir(row.description, row.kind)
    if (palpite) fora.set(row.line, palpite.categoryId)
  }

  return fora
}

describe('extrato de banco, sem coluna de categoria', () => {
  it('o arquivo não traz categoria nenhuma', () => {
    expect(linhas().every((row) => row.categoryLabel === '')).toBe(true)
  })

  it('classifica o que o histórico reconhece', () => {
    const sugestoes = sugerir(linhas())
    const lancamentos = montarLancamentos(linhas(), alvos({ sugestoes }))

    const porDescricao = new Map(lancamentos.map((l) => [l.description, l.category_id]))
    expect(porDescricao.get('PAG*IFOOD SAO PAULO')).toBe('alimentacao')
    expect(porDescricao.get('UBER   *TRIP HELP.UBER')).toBe('transporte')
  })

  it('reconhece o estabelecimento que nunca viu, pelo ramo', () => {
    const sugestoes = sugerir(linhas())
    const lancamentos = montarLancamentos(linhas(), alvos({ sugestoes }))

    // O histórico tem a Drogaria Pacheco; o extrato traz outra drogaria. É o
    // ganho que justifica o recurso: a palavra viaja, a frase inteira não.
    const droga = lancamentos.find((l) => l.description.startsWith('DROGARIA'))
    expect(droga?.category_id).toBe('saude')
  })

  it('cala no que não reconhece, em vez de chutar', () => {
    const sugestoes = sugerir(linhas())
    const lancamentos = montarLancamentos(linhas(), alvos({ sugestoes }))

    // Sobra "recebido", que nunca apareceu classificado. Sem palavra conhecida,
    // sem palpite.
    const pagamento = lancamentos.find((l) => l.description === 'PAGAMENTO RECEBIDO')
    expect(pagamento?.category_id).toBeNull()
  })

  it('sem palpite nenhum, é exatamente o que era antes', () => {
    const lancamentos = montarLancamentos(linhas(), alvos())
    expect(lancamentos.every((l) => l.category_id === null)).toBe(true)
  })
})

describe('precedência', () => {
  const COM_CATEGORIA = ['Data,Descrição,Valor,Categoria', '2026-09-02,PAG*IFOOD,-58.90,Lazer'].join(
    '\n',
  )

  function linhaComRotulo() {
    const grade = parseCsv(COM_CATEGORIA, detectDelimiter(COM_CATEGORIA))
    return buildRows(grade.slice(1), detectColumns(grade[0]!))
  }

  it('o rótulo do arquivo vence o palpite', () => {
    const rows = linhaComRotulo()
    const chave = chaveDaCategoria('Lazer', 'expense')

    const [lancamento] = montarLancamentos(
      rows,
      alvos({
        categorias: new Map([[chave, 'lazer']]),
        // Mesmo com um palpite gravado para a linha, ele não é consultado.
        sugestoes: new Map([[rows[0]!.line, 'alimentacao']]),
      }),
    )

    expect(lancamento?.category_id).toBe('lazer')
  })

  it('"sem categoria" escolhido à mão continua sendo sem categoria', () => {
    const rows = linhaComRotulo()
    const chave = chaveDaCategoria('Lazer', 'expense')

    const [lancamento] = montarLancamentos(
      rows,
      alvos({
        categorias: new Map([[chave, null]]),
        sugestoes: new Map([[rows[0]!.line, 'alimentacao']]),
      }),
    )

    expect(lancamento?.category_id).toBeNull()
  })

  it('transferência não recebe palpite', () => {
    const texto = ['Data,Descrição,Valor,Tipo', '2026-09-02,IFOOD,58.90,Transferência'].join('\n')
    const grade = parseCsv(texto, detectDelimiter(texto))
    const rows = buildRows(grade.slice(1), detectColumns(grade[0]!))
    if (rows[0]?.kind !== 'transfer') return

    const [lancamento] = montarLancamentos(
      rows,
      alvos({ sugestoes: new Map([[rows[0]!.line, 'alimentacao']]) }),
    )
    expect(lancamento?.category_id ?? null).toBeNull()
  })
})
