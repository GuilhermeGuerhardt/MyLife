import { describe, expect, it } from 'vitest'
import { comparar, NOVIDADES, novidadesDesde } from './novidades'

describe('comparar', () => {
  it('ordena por número, não por texto', () => {
    expect(comparar('0.10.0', '0.9.0')).toBeGreaterThan(0)
    expect(comparar('1.0.0', '0.99.9')).toBeGreaterThan(0)
  })

  it('reconhece igual', () => {
    expect(comparar('0.4.0', '0.4.0')).toBe(0)
  })

  it('tolera versão com menos partes', () => {
    expect(comparar('0.4', '0.4.0')).toBe(0)
    expect(comparar('0.4', '0.4.1')).toBeLessThan(0)
  })
})

describe('novidadesDesde', () => {
  it('mostra só o que veio depois da versão que a pessoa tinha', () => {
    expect(novidadesDesde('0.3.0', '0.4.0').map((n) => n.versao)).toEqual(['0.4.0'])
  })

  it('junta as versões puladas', () => {
    expect(novidadesDesde('0.1.0', '0.4.0').map((n) => n.versao)).toEqual([
      '0.4.0',
      '0.3.0',
      '0.2.0',
    ])
  })

  it('não mostra nada para quem já está na última', () => {
    expect(novidadesDesde('0.4.0', '0.4.0')).toEqual([])
  })

  it('não anuncia versão futura que já esteja escrita aqui', () => {
    expect(novidadesDesde('0.2.0', '0.3.0').map((n) => n.versao)).toEqual(['0.3.0'])
  })

  it('a lista vem da mais nova para a mais antiga', () => {
    const versoes = NOVIDADES.map((n) => n.versao)
    expect([...versoes].sort((a, b) => comparar(b, a))).toEqual(versoes)
  })

  it('toda entrada tem pelo menos um item', () => {
    for (const novidade of NOVIDADES) expect(novidade.itens.length).toBeGreaterThan(0)
  })
})
