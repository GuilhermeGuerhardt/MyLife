// @vitest-environment happy-dom

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TransactionsPage } from './transactions'
import { confirmar } from '@/lib/avisos'
import { addMonths, toCompetence } from '@/lib/finance/billing'
import { today } from '@/lib/utils'
import { limparArmazenamento, montarTela, semear } from '@/testes/montar-tela'

/**
 * Marcar lançamentos e agir sobre eles de uma vez.
 *
 * O que se confere aqui é o que dá prejuízo se quebrar: apagar o que não foi
 * marcado, apagar sem perguntar, ou marcar como paga uma compra que só a fatura
 * quita. A pergunta é simulada — no teste não há janela para clicar.
 */

vi.mock('@/lib/avisos', () => ({ confirmar: vi.fn() }))

// O mês aberto na tela é o de hoje; semear nele mantém o teste de pé no mês que vem.
const MES = toCompetence(today())

const conta = {
  name: 'Conta Corrente',
  kind: 'checking',
  bank: 'Banco',
  initial_balance_cents: 500000,
  credit_limit_cents: null,
  closing_day: null,
  due_day: null,
  color: '#3b82f6',
  archived: false,
}

const cartao = {
  name: 'Cartao',
  kind: 'credit',
  bank: 'Banco',
  initial_balance_cents: 0,
  credit_limit_cents: 500000,
  closing_day: 20,
  due_day: 15,
  color: '#a855f7',
  archived: false,
}

const lancamento = (over: Record<string, unknown>) => ({
  account_id: 'accounts-0',
  transfer_account_id: null,
  category_id: null,
  kind: 'expense',
  date: `${MES}-02`,
  competence: MES,
  tags: [],
  paid: false,
  installment_group_id: null,
  installment_n: null,
  installment_total: null,
  recurring_id: null,
  invoice_competence: null,
  notes: null,
  ...over,
})

function semearMes() {
  semear('accounts', [conta, cartao])
  semear('transactions', [
    lancamento({ description: 'Mercado', amount_cents: 30000 }),
    lancamento({ description: 'Farmacia', amount_cents: 15050 }),
    lancamento({ description: 'Salario', kind: 'income', amount_cents: 450000, paid: true }),
    lancamento({ description: 'Compra no cartao', account_id: 'accounts-1', amount_cents: 32000 }),
  ])
}

interface Gravado {
  description: string
  paid: boolean
}

function gravados(): Gravado[] {
  return JSON.parse(localStorage.getItem('life:table:transactions') ?? '[]') as Gravado[]
}

function gravado(descricao: string): Gravado | undefined {
  return gravados().find((t) => t.description === descricao)
}

function descricoes(): string[] {
  return gravados()
    .map((t) => t.description)
    .sort()
}

/** A caixa da linha. O nome leva data e valor depois da descrição. */
async function caixa(descricao: string): Promise<HTMLInputElement> {
  return (await screen.findByRole('checkbox', {
    name: new RegExp(`^Selecionar ${descricao}, `),
  })) as HTMLInputElement
}

function caixaDeTodos(): HTMLInputElement {
  return screen.getByRole('checkbox', { name: 'Selecionar todos' }) as HTMLInputElement
}

/** O que a barra anuncia ao leitor de tela — o resumo inteiro, numa frase. */
function anunciado(): HTMLElement {
  const barra = caixaDeTodos().closest('div') as HTMLElement
  return within(barra).getByRole('status')
}

/** Os botões da barra — a linha tem um "Marcar como pago" próprio, no selo. */
function acao(nome: string): HTMLButtonElement {
  const barra = screen.getByRole('group', { name: 'Ações nos selecionados' })
  return within(barra).getByRole('button', { name: nome }) as HTMLButtonElement
}

/**
 * Avança o relógio falso e espera a tela acompanhar. Sem o `act`, o render
 * que o temporizador dispara fica para depois, e a conferência seguinte lê a
 * tela de antes — passaria até com o aviso já fechado.
 */
async function passar(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

/** A linha em volta da caixa: é ela que abre o editor e responde ao arrasto. */
function linhaDe(elemento: HTMLElement): HTMLElement {
  return elemento.closest('.relative.flex') as HTMLElement
}

beforeEach(() => {
  limparArmazenamento()
  vi.mocked(confirmar).mockReset()
})
// Sem os globais do vitest, a testing-library não desmonta sozinha entre um
// teste e outro, e a tela anterior continuaria no documento respondendo às buscas.
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  limparArmazenamento()
})

describe('seleção de lançamentos', () => {
  it('sem nada marcado, a barra é só o convite — e a palavra marca, como rótulo', async () => {
    semearMes()
    montarTela(<TransactionsPage />)

    await caixa('Mercado')
    expect(screen.queryByRole('group', { name: 'Ações nos selecionados' })).toBeNull()

    fireEvent.click(screen.getByText('Selecionar'))
    await waitFor(async () => expect((await caixa('Mercado')).checked).toBe(true))
    expect(caixaDeTodos().checked).toBe(true)
  })

  it('marcar duas despesas mostra quantas são e quanto somam, e o leitor de tela ouve', async () => {
    semearMes()
    montarTela(<TransactionsPage />)

    await caixa('Mercado')
    // A região de status já existe, vazia, antes da primeira marcação: uma que
    // nasce com texto não é anunciada.
    const status = anunciado()
    expect(status.textContent).toBe('')

    fireEvent.click(await caixa('Mercado'))
    fireEvent.click(await caixa('Farmacia'))

    expect(screen.getByText('2 despesas')).toBeTruthy()
    expect(anunciado()).toBe(status)
    expect(status.textContent).toMatch(/^2 despesas · R\$\s450,50$/)

    // Parte marcada: a caixa de cima fica no meio-termo.
    expect(caixaDeTodos().indeterminate).toBe(true)
  })

  it('marcar todos mostra o saldo e, depois, despesas e receitas separadas', async () => {
    semearMes()
    montarTela(<TransactionsPage />)

    await caixa('Mercado')
    fireEvent.click(caixaDeTodos())

    // Duas formas no HTML: a de uma linha e a de duas, com as partes
    // abreviadas. O CSS mostra uma conforme a largura; aqui não há CSS.
    expect(screen.getAllByText('4 selecionados')).toHaveLength(2)
    expect(screen.getByText('3 desp.')).toBeTruthy()
    expect(screen.getByText('1 rec.')).toBeTruthy()
    expect(anunciado().textContent).toMatch(
      /^4 selecionados · saldo \+R\$\s3\.729,50 · 3 despesas R\$\s770,50 · 1 receita R\$\s4\.500,00$/,
    )
    // O nome da caixa de cima não muda com o estado; o estado vai no marcado.
    expect(caixaDeTodos().checked).toBe(true)
  })

  it('a caixa da linha diz qual lançamento é: descrição, data e valor', async () => {
    semearMes()
    montarTela(<TransactionsPage />)

    expect((await caixa('Mercado')).getAttribute('aria-label')).toMatch(
      /^Selecionar Mercado, .+, R\$\s300,00$/,
    )
  })

  it('"Marcar como pago" grava os marcados e limpa a seleção', async () => {
    semearMes()
    montarTela(<TransactionsPage />)

    fireEvent.click(await caixa('Mercado'))
    fireEvent.click(await caixa('Farmacia'))

    // A ordem do Tab é a da tela em qualquer largura: as ações e, por último,
    // o X — no celular a faixa de baixo leva os quatro juntos.
    const grupo = screen.getByRole('group', { name: 'Ações nos selecionados' })
    const nomes = within(grupo)
      .getAllByRole('button')
      .map((botao) => botao.getAttribute('aria-label') ?? botao.textContent)
    expect(nomes).toEqual([
      'Marcar como pago',
      'Marcar como não pago',
      'Apagar',
      'Limpar seleção',
    ])

    fireEvent.click(acao('Marcar como pago'))

    await waitFor(() =>
      expect(
        gravados()
          .filter((t) => t.paid)
          .map((t) => t.description)
          .sort(),
      ).toEqual(['Farmacia', 'Mercado', 'Salario']),
    )
    await waitFor(async () => expect((await caixa('Mercado')).checked).toBe(false))
  })

  it('compra no cartão em aberto fica de fora, e a tela diz isso', async () => {
    semearMes()
    montarTela(<TransactionsPage />)

    fireEvent.click(await caixa('Compra no cartao'))
    // Só ela marcada: não há o que marcar como pago.
    expect(acao('Marcar como pago').disabled).toBe(true)

    fireEvent.click(await caixa('Mercado'))
    fireEvent.click(acao('Marcar como pago'))

    expect(await screen.findByText(/compra no cartão ficou de fora/i)).toBeTruthy()
    expect(gravado('Mercado')?.paid).toBe(true)
    expect(gravado('Compra no cartao')?.paid).toBe(false)
  })

  it('cada aviso tem o próprio prazo, mesmo chegando logo depois de outro', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    semear('accounts', [conta, cartao])
    semear('transactions', [
      lancamento({ description: 'Mercado', amount_cents: 30000 }),
      lancamento({ description: 'Farmacia', amount_cents: 15050 }),
      lancamento({ description: 'Tenis', account_id: 'accounts-1', amount_cents: 32000 }),
      lancamento({ description: 'Livro', account_id: 'accounts-1', amount_cents: 9000 }),
    ])
    montarTela(<TransactionsPage />)

    fireEvent.click(await caixa('Mercado'))
    fireEvent.click(await caixa('Tenis'))
    fireEvent.click(acao('Marcar como pago'))
    expect(await screen.findByText(/1 compra no cartão ficou de fora/)).toBeTruthy()

    await passar(5000)

    fireEvent.click(await caixa('Farmacia'))
    fireEvent.click(await caixa('Tenis'))
    fireEvent.click(await caixa('Livro'))
    fireEvent.click(acao('Marcar como pago'))
    expect(await screen.findByText(/2 compras no cartão ficaram de fora/)).toBeTruthy()
    // O aviso anterior não fica junto, dizendo algo desta ação.
    expect(screen.queryByText(/1 compra no cartão ficou de fora/)).toBeNull()

    // Já passou do prazo do primeiro; o segundo continua de pé.
    await passar(2000)
    expect(screen.queryByText(/2 compras no cartão ficaram de fora/)).not.toBeNull()

    await passar(5000)
    expect(screen.queryByText(/2 compras no cartão ficaram de fora/)).toBeNull()
  })

  it('"Marcar como não pago" grava os pagos e só se oferece quando há algum pago', async () => {
    semearMes()
    montarTela(<TransactionsPage />)

    fireEvent.click(await caixa('Mercado'))
    expect(acao('Marcar como não pago').disabled).toBe(true)

    fireEvent.click(await caixa('Salario'))
    fireEvent.click(acao('Marcar como não pago'))

    await waitFor(() => expect(gravado('Salario')?.paid).toBe(false))
    expect(gravado('Mercado')?.paid).toBe(false)
    // Nada de cartão no meio: não há o que perguntar.
    expect(confirmar).not.toHaveBeenCalled()
  })

  it('"não pago" em compra no cartão já paga pergunta antes, porque não tem volta pela tela', async () => {
    vi.mocked(confirmar).mockResolvedValue(false)
    semear('accounts', [conta, cartao])
    semear('transactions', [
      lancamento({ description: 'Mercado', amount_cents: 30000, paid: true }),
      lancamento({ description: 'Tenis', account_id: 'accounts-1', amount_cents: 32000, paid: true }),
    ])
    montarTela(<TransactionsPage />)

    fireEvent.click(await caixa('Mercado'))
    fireEvent.click(await caixa('Tenis'))
    fireEvent.click(acao('Marcar como não pago'))

    await waitFor(() =>
      expect(confirmar).toHaveBeenCalledWith(
        expect.stringMatching(/Uma compra no cartão volta para a fatura/),
        expect.objectContaining({ tom: 'warning' }),
      ),
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(gravado('Mercado')?.paid).toBe(true)
    expect(gravado('Tenis')?.paid).toBe(true)

    vi.mocked(confirmar).mockResolvedValue(true)
    fireEvent.click(acao('Marcar como não pago'))
    await waitFor(() => expect(gravado('Tenis')?.paid).toBe(false))
    expect(gravado('Mercado')?.paid).toBe(false)
  })

  it('apagar pergunta antes e leva só os marcados', async () => {
    vi.mocked(confirmar).mockResolvedValue(true)
    semearMes()
    montarTela(<TransactionsPage />)

    fireEvent.click(await caixa('Mercado'))
    fireEvent.click(await caixa('Salario'))
    fireEvent.click(acao('Apagar'))

    await waitFor(() => expect(descricoes()).toEqual(['Compra no cartao', 'Farmacia']))
    expect(confirmar).toHaveBeenCalledWith(
      expect.stringMatching(/2 lançamentos[\s\S]*não tem volta/),
      expect.objectContaining({ confirmar: 'Apagar', cancelar: 'Cancelar', tom: 'warning' }),
    )
    await waitFor(() => expect(screen.queryByText('Mercado')).toBeNull())
  })

  it('apagar com a pergunta negada não apaga nada', async () => {
    vi.mocked(confirmar).mockResolvedValue(false)
    semearMes()
    montarTela(<TransactionsPage />)

    fireEvent.click(await caixa('Mercado'))
    fireEvent.click(acao('Apagar'))

    await waitFor(() => expect(confirmar).toHaveBeenCalledOnce())
    // Dá tempo de uma remoção que escapasse terminar antes de conferir.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(gravados()).toHaveLength(4)
    expect((await caixa('Mercado')).checked).toBe(true)
  })

  it('o que o filtro escondeu sai da seleção, não volta marcado e não é apagado', async () => {
    vi.mocked(confirmar).mockResolvedValue(true)
    semearMes()
    montarTela(<TransactionsPage />)

    fireEvent.click(await caixa('Mercado'))
    fireEvent.click(await caixa('Salario'))
    fireEvent.click(screen.getByRole('tab', { name: 'Despesas' }))
    expect(await screen.findByText('1 despesa')).toBeTruthy()

    // De volta ao "Todos", o salário reaparece desmarcado: a seleção que
    // continuasse guardando o escondido levaria ele no próximo Apagar.
    fireEvent.click(screen.getByRole('tab', { name: 'Todos' }))
    expect((await caixa('Salario')).checked).toBe(false)
    expect((await caixa('Mercado')).checked).toBe(true)
    expect(screen.getByText('1 despesa')).toBeTruthy()

    fireEvent.click(acao('Apagar'))
    await waitFor(() => expect(descricoes()).toEqual(['Compra no cartao', 'Farmacia', 'Salario']))
  })

  it('apagar uma parcela leva só ela, e a pergunta avisa', async () => {
    vi.mocked(confirmar).mockResolvedValue(true)
    semear('accounts', [conta, cartao])
    semear('transactions', [
      lancamento({
        description: 'Geladeira',
        account_id: 'accounts-1',
        amount_cents: 50000,
        installment_group_id: 'g1',
        installment_n: 2,
        installment_total: 10,
      }),
      lancamento({
        description: 'Geladeira',
        account_id: 'accounts-1',
        amount_cents: 50000,
        competence: addMonths(MES, 1),
        installment_group_id: 'g1',
        installment_n: 3,
        installment_total: 10,
      }),
    ])
    montarTela(<TransactionsPage />)

    fireEvent.click(await caixa('Geladeira'))
    fireEvent.click(acao('Apagar'))

    await waitFor(() => expect(gravados()).toHaveLength(1))
    expect(confirmar).toHaveBeenCalledWith(expect.stringMatching(/parcela/), expect.anything())
  })

  it('o lote é tudo ou nada: com um item sumido, nenhum é gravado e a seleção fica', async () => {
    semearMes()
    montarTela(<TransactionsPage />)

    fireEvent.click(await caixa('Mercado'))
    fireEvent.click(await caixa('Farmacia'))

    // Outra janela apagou a farmácia e esta ainda não releu: o lote é recusado
    // inteiro, em vez de pagar o mercado e parar na farmácia.
    localStorage.setItem(
      'life:table:transactions',
      JSON.stringify(gravados().filter((t) => t.description !== 'Farmacia')),
    )
    fireEvent.click(acao('Marcar como pago'))

    expect(await screen.findByText('Nada foi marcado como pago')).toBeTruthy()
    expect(screen.getByText(/não encontrado/)).toBeTruthy()
    expect(gravado('Mercado')?.paid).toBe(false)
    // O que sumiu sai da lista e da seleção; o resto continua marcado.
    await waitFor(() => expect(screen.queryByText('Farmacia')).toBeNull())
    expect((await caixa('Mercado')).checked).toBe(true)
    expect(anunciado().textContent).toMatch(/^1 despesa · /)
  })

  it('o que se marca enquanto a ação roda continua marcado no fim', async () => {
    let responder: (sim: boolean) => void = () => {}
    vi.mocked(confirmar).mockImplementation(
      () =>
        new Promise((resolve) => {
          responder = resolve
        }),
    )
    semearMes()
    montarTela(<TransactionsPage />)

    fireEvent.click(await caixa('Mercado'))
    fireEvent.click(acao('Apagar'))
    await waitFor(() => expect(confirmar).toHaveBeenCalledOnce())

    fireEvent.click(await caixa('Farmacia'))
    responder(true)

    await waitFor(() => expect(descricoes()).toEqual(['Compra no cartao', 'Farmacia', 'Salario']))
    await waitFor(async () => expect((await caixa('Farmacia')).checked).toBe(true))
  })

  it('ao limpar, o foco volta para a caixa de cima em vez de cair na página', async () => {
    semearMes()
    montarTela(<TransactionsPage />)

    fireEvent.click(await caixa('Mercado'))
    const limpar = screen.getByRole('button', { name: 'Limpar seleção' })
    limpar.focus()
    fireEvent.click(limpar)

    await waitFor(() => expect(document.activeElement).toBe(caixaDeTodos()))
  })

  it('clicar na caixa não abre o editor; clicar na linha abre', async () => {
    semearMes()
    montarTela(<TransactionsPage />)

    fireEvent.click(await caixa('Mercado'))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByText('Mercado'))
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })

  it('arrasto que começa na caixa não marca como pago; o que começa na linha marca', async () => {
    semearMes()
    montarTela(<TransactionsPage />)

    const mercado = await caixa('Mercado')
    const linha = linhaDe(mercado)
    fireEvent.pointerDown(mercado, { clientX: 0, clientY: 0, button: 0 })
    fireEvent.pointerMove(linha, { clientX: 100, clientY: 0 })
    fireEvent.pointerUp(linha)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(gravado('Mercado')?.paid).toBe(false)

    // O mesmo gesto a partir do texto da linha: prova que o arrasto acima
    // valeria se não fosse barrado na caixa.
    fireEvent.pointerDown(screen.getByText('Mercado'), { clientX: 0, clientY: 0, button: 0 })
    fireEvent.pointerMove(linha, { clientX: 100, clientY: 0 })
    fireEvent.pointerUp(linha)
    await waitFor(() => expect(gravado('Mercado')?.paid).toBe(true))
  })

  it('Esc desmarca tudo', async () => {
    semearMes()
    montarTela(<TransactionsPage />)

    fireEvent.click(await caixa('Mercado'))
    expect((await caixa('Mercado')).checked).toBe(true)

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(async () => expect((await caixa('Mercado')).checked).toBe(false))
  })

  it('com o editor aberto, o Esc é dele: fecha o editor e a seleção fica', async () => {
    semearMes()
    montarTela(<TransactionsPage />)

    fireEvent.click(await caixa('Mercado'))
    fireEvent.click(screen.getByText('Mercado'))
    const editor = await screen.findByRole('dialog')

    fireEvent.keyDown(editor, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect((await caixa('Mercado')).checked).toBe(true)
  })

  it('compra de cartão arquivado espera a fatura na linha e no lote, igual', async () => {
    semear('accounts', [conta, { ...cartao, archived: true }])
    semear('transactions', [
      lancamento({ description: 'Compra antiga', account_id: 'accounts-1', amount_cents: 32000 }),
    ])
    montarTela(<TransactionsPage />)

    fireEvent.click(await caixa('Compra antiga'))
    // A linha não oferece o selo clicável, e o lote também não marca.
    expect(screen.getByText('na fatura')).toBeTruthy()
    expect(
      within(linhaDe(await caixa('Compra antiga'))).queryByRole('button', { name: 'Marcar como pago' }),
    ).toBeNull()
    expect(acao('Marcar como pago').disabled).toBe(true)
  })
})
