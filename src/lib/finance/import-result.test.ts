import { describe, expect, it } from 'vitest'
import { descreverResultado } from './import-result'

const recibo = (t: number, c = 0, k = 0) =>
  descreverResultado({ transactions: t, accountsCreated: c, categoriesCreated: k })

describe('recibo da importação', () => {
  it('conta os lançamentos no singular e no plural', () => {
    expect(recibo(1).titulo).toBe('1 lançamento importado')
    expect(recibo(42).titulo).toBe('42 lançamentos importados')
  })

  it('sem nada criado, fala só da etiqueta', () => {
    expect(recibo(42).detalhe).toBe('Os lançamentos ficaram com a etiqueta "importado".')
  })

  it('junta conta e categoria criadas', () => {
    expect(recibo(42, 2, 3).detalhe).toBe(
      '2 contas criadas e 3 categorias criadas. Os lançamentos ficaram com a etiqueta "importado".',
    )
  })

  it('uma só de cada fica no singular', () => {
    expect(recibo(9, 1, 1).detalhe).toMatch(/^1 conta criada e 1 categoria criada\./)
  })

  it('só o que foi criado aparece', () => {
    expect(recibo(9, 0, 4).detalhe).toMatch(/^4 categorias criadas\./)
    expect(recibo(9, 4, 0).detalhe).toMatch(/^4 contas criadas\./)
  })
})
