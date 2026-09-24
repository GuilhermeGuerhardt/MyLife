import { describe, expect, it } from 'vitest'
import { PARADO, reduzir, type EstadoDaImportacao } from './import-run-state'
import type { ImportPlan } from './use-import'

const plano: ImportPlan = { rows: [], accounts: {}, categories: {}, fallbackAccountId: 'conta-1' }
const resultado = { transactions: 42, accountsCreated: 1, categoriesCreated: 0 }

const comecar = (estado: EstadoDaImportacao = PARADO) =>
  reduzir(estado, { tipo: 'comecar', arquivo: 'extrato.csv', plano })

const rodando = (progresso = { done: 10, total: 100 }) =>
  reduzir(comecar(), { tipo: 'progresso', progresso })

const concluido = () => reduzir(rodando(), { tipo: 'concluir', resultado })

describe('começar', () => {
  it('guarda o arquivo e o plano, com a barra no zero', () => {
    expect(comecar()).toEqual({
      kind: 'rodando',
      arquivo: 'extrato.csv',
      plano,
      progresso: { done: 0, total: 0 },
      oculto: false,
    })
  })

  it('não começa outra por cima de uma que está rodando', () => {
    const emCurso = rodando()
    expect(reduzir(emCurso, { tipo: 'comecar', arquivo: 'outro.csv', plano })).toBe(emCurso)
  })

  it('depois de um recibo, começa de novo', () => {
    expect(comecar(concluido()).kind).toBe('rodando')
  })
})

describe('progresso', () => {
  it('anda a barra', () => {
    expect(rodando({ done: 30, total: 90 })).toMatchObject({ progresso: { done: 30, total: 90 } })
  })

  /**
   * O andamento sai em transição e o fim não: o React pode entregar um
   * progresso atrasado depois do resultado. Sem esta guarda a barra
   * ressuscitaria sobre uma importação encerrada.
   */
  it('um progresso atrasado não desfaz o fim', () => {
    const fim = concluido()
    expect(reduzir(fim, { tipo: 'progresso', progresso: { done: 99, total: 100 } })).toBe(fim)
  })
})

describe('fim', () => {
  it('concluir guarda o recibo por ver', () => {
    expect(concluido()).toEqual({
      kind: 'concluido',
      arquivo: 'extrato.csv',
      resultado,
      visto: false,
    })
  })

  it('falhar guarda a mensagem', () => {
    expect(reduzir(rodando(), { tipo: 'falhar', mensagem: 'Deu ruim.' })).toEqual({
      kind: 'erro',
      arquivo: 'extrato.csv',
      mensagem: 'Deu ruim.',
    })
  })

  it('não conclui o que não estava rodando', () => {
    expect(reduzir(PARADO, { tipo: 'concluir', resultado })).toBe(PARADO)
  })
})

describe('fechar o cartão', () => {
  it('durante a gravação, só esconde', () => {
    const escondido = reduzir(rodando(), { tipo: 'fechar' })
    expect(escondido).toMatchObject({ kind: 'rodando', oculto: true })
  })

  it('fechar de novo não mexe em nada', () => {
    const escondido = reduzir(rodando(), { tipo: 'fechar' })
    expect(reduzir(escondido, { tipo: 'fechar' })).toBe(escondido)
  })

  it('a gravação escondida ainda termina no recibo', () => {
    const escondido = reduzir(rodando(), { tipo: 'fechar' })
    expect(reduzir(escondido, { tipo: 'concluir', resultado })).toMatchObject({
      kind: 'concluido',
      visto: false,
    })
  })

  it('com recibo ou erro na tela, encerra', () => {
    expect(reduzir(concluido(), { tipo: 'fechar' })).toBe(PARADO)
    const erro = reduzir(rodando(), { tipo: 'falhar', mensagem: 'x' })
    expect(reduzir(erro, { tipo: 'fechar' })).toBe(PARADO)
  })

  it('parado continua o mesmo objeto', () => {
    expect(reduzir(PARADO, { tipo: 'fechar' })).toBe(PARADO)
  })
})

describe('marcar visto', () => {
  it('marca uma vez', () => {
    expect(reduzir(concluido(), { tipo: 'marcar-visto' })).toMatchObject({ visto: true })
  })

  /**
   * A regra que faltava: marcar de novo devolvia um estado novo, o React
   * renderizava, a tela marcava de novo — laço infinito enquanto o recibo
   * estivesse aberto em Planilhas.
   */
  it('marcar de novo devolve o mesmo objeto', () => {
    const visto = reduzir(concluido(), { tipo: 'marcar-visto' })
    expect(reduzir(visto, { tipo: 'marcar-visto' })).toBe(visto)
  })

  it('não marca o que não é recibo', () => {
    const emCurso = rodando()
    expect(reduzir(emCurso, { tipo: 'marcar-visto' })).toBe(emCurso)
  })
})
