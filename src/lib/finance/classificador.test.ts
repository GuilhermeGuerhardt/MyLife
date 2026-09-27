import { describe, expect, it } from 'vitest'
import { palavras, treinar, type LancamentoJaClassificado } from './classificador'

const gasto = (
  description: string,
  category_id: string | null,
  kind = 'expense',
): LancamentoJaClassificado => ({ description, kind, category_id })

/** Repete um lançamento até passar do mínimo de evidência. */
const varias = (description: string, category_id: string, vezes = 3, kind = 'expense') =>
  Array.from({ length: vezes }, () => gasto(description, category_id, kind))

describe('palavras', () => {
  it('tira acento, número e pontuação', () => {
    expect(palavras('PAG*IFOOD 1234')).toEqual(['ifood'])
    expect(palavras('Farmácia São João')).toEqual(['farmacia', 'sao', 'joao'])
  })

  it('descarta o ruído do meio de pagamento', () => {
    expect(palavras('COMPRA CARTAO DEBITO POSTO SHELL')).toEqual(['posto', 'shell'])
  })

  it('devolve vazio quando não sobra palavra', () => {
    expect(palavras('12/48')).toEqual([])
    expect(palavras('PAGAMENTO')).toEqual([])
  })
})

describe('treinar', () => {
  it('não sugere nada sem histórico', () => {
    const modelo = treinar([])
    expect(modelo.base).toBe(0)
    expect(modelo.sugerir('PAG*IFOOD', 'expense')).toBeNull()
  })

  it('conta só o que tem categoria e descrição', () => {
    const modelo = treinar([
      gasto('Mercado', 'alimentacao'),
      gasto('Mercado', null),
      gasto('12345', 'alimentacao'),
    ])
    expect(modelo.base).toBe(1)
  })

  it('sugere pela palavra que se repete', () => {
    const modelo = treinar(varias('PAG*IFOOD SAO PAULO', 'alimentacao'))
    const sugestao = modelo.sugerir('IFOOD *PEDIDO 9931', 'expense')

    expect(sugestao?.categoryId).toBe('alimentacao')
    expect(sugestao?.chave).toBe('ifood')
    expect(sugestao?.motivo).toBe('palavra')
  })

  it('reconhece a descrição inteira antes de olhar palavra por palavra', () => {
    const modelo = treinar([
      ...varias('NETFLIX.COM', 'assinaturas'),
      ...varias('NETFLIX PRESENCIAL COMIDA', 'alimentacao'),
    ])
    const sugestao = modelo.sugerir('NETFLIX.COM', 'expense')

    expect(sugestao?.categoryId).toBe('assinaturas')
    expect(sugestao?.motivo).toBe('descricao')
  })

  it('cala quando viu uma vez só', () => {
    // Uma ocorrência é onde mora o engano de digitação: não vira regra.
    const modelo = treinar(varias('PADARIA CENTRAL', 'alimentacao', 1))
    expect(modelo.sugerir('PADARIA CENTRAL', 'expense')).toBeNull()
  })

  it('aceita a partir da segunda', () => {
    const modelo = treinar(varias('PADARIA CENTRAL', 'alimentacao', 2))
    expect(modelo.sugerir('PADARIA CENTRAL', 'expense')?.categoryId).toBe('alimentacao')
  })

  it('cala quando o histórico se contradiz', () => {
    const modelo = treinar([
      ...varias('POSTO SHELL', 'transporte', 3),
      ...varias('POSTO SHELL', 'lazer', 3),
    ])
    expect(modelo.sugerir('POSTO SHELL', 'expense')).toBeNull()
  })

  it('aceita a maioria folgada mesmo com um engano no meio', () => {
    const modelo = treinar([...varias('UBER TRIP', 'transporte', 9), gasto('UBER TRIP', 'lazer')])
    expect(modelo.sugerir('UBER TRIP', 'expense')?.categoryId).toBe('transporte')
  })

  it('não mistura despesa com receita', () => {
    const modelo = treinar(varias('EMPRESTIMO', 'emprestimo-saida'))
    expect(modelo.sugerir('EMPRESTIMO', 'expense')?.categoryId).toBe('emprestimo-saida')
    expect(modelo.sugerir('EMPRESTIMO', 'income')).toBeNull()
  })

  it('ignora transferência no treino', () => {
    const modelo = treinar(varias('ENTRE CONTAS', 'alguma', 5, 'transfer'))
    expect(modelo.base).toBe(0)
  })

  it('na dúvida entre duas palavras, fica com a mais vista', () => {
    const modelo = treinar([
      ...varias('SUPERMERCADO BOM PRECO', 'alimentacao', 10),
      ...varias('ESTACIONAMENTO PRECO JUSTO', 'transporte', 3),
    ])
    const sugestao = modelo.sugerir('SUPERMERCADO PRECO', 'expense')

    expect(sugestao?.categoryId).toBe('alimentacao')
    expect(sugestao?.vezes).toBe(10)
  })

  it('não deixa a palavra repetida na mesma frase valer dobrado', () => {
    // Contando por lançamento, "casa" tem 8 de 10 e manda. Contando cada
    // repetição, "alimentacao" subiria para 6 contra 8 e ninguém chegaria aos
    // 70% — a sugestão sumiria por causa de uma descrição gaguejante.
    const modelo = treinar([
      ...varias('MERCADO MERCADO MERCADO', 'alimentacao', 2),
      ...varias('MERCADO', 'casa', 8),
    ])
    expect(modelo.sugerir('MERCADO DA ESQUINA', 'expense')?.categoryId).toBe('casa')
  })

  it('cala diante de descrição sem palavra nenhuma', () => {
    const modelo = treinar(varias('MERCADO', 'alimentacao'))
    expect(modelo.sugerir('12/48', 'expense')).toBeNull()
    expect(modelo.sugerir('', 'expense')).toBeNull()
  })
})
