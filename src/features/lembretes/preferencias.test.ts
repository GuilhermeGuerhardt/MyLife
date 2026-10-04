import { describe, expect, it } from 'vitest'
import { interpretarPreferencias, PADRAO } from './preferencias'

describe('preferências de aviso', () => {
  it('sem nada gravado, desligado e com todos os tipos', () => {
    expect(interpretarPreferencias(null)).toEqual(PADRAO)
    expect(PADRAO.ligado).toBe(false)
    expect(PADRAO.tipos).toHaveLength(5)
  })

  it('lixo volta ao padrão em vez de travar', () => {
    expect(interpretarPreferencias('{isso não é json')).toEqual(PADRAO)
    expect(interpretarPreferencias('"texto"')).toEqual(PADRAO)
  })

  it('tipo desconhecido some, e a ordem é a do catálogo', () => {
    const lido = interpretarPreferencias(
      JSON.stringify({ ligado: true, tipos: ['habitos', 'inventado', 'contas'] }),
    )
    expect(lido).toEqual({ ligado: true, tipos: ['contas', 'habitos'] })
  })

  it('ligado só com true de verdade', () => {
    expect(interpretarPreferencias(JSON.stringify({ ligado: 'sim' })).ligado).toBe(false)
  })
})
