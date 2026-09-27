// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  comPulado,
  comVisto,
  deveMostrar,
  gravarVisto,
  lerVisto,
  NADA_VISTO,
} from './visto'

describe('deveMostrar', () => {
  it('mostra na primeira visita', () => {
    expect(deveMostrar(NADA_VISTO, '/saude')).toBe(true)
  })

  it('não mostra o que já foi fechado', () => {
    expect(deveMostrar({ rotas: ['/saude'], pulado: false }, '/saude')).toBe(false)
    expect(deveMostrar({ rotas: ['/saude'], pulado: false }, '/rotina')).toBe(true)
  })

  it('cala todos depois de pular tudo', () => {
    expect(deveMostrar({ rotas: [], pulado: true }, '/rotina')).toBe(false)
  })
})

describe('comVisto', () => {
  it('acrescenta a rota', () => {
    expect(comVisto(NADA_VISTO, '/saude').rotas).toEqual(['/saude'])
  })

  it('devolve o mesmo objeto quando já estava visto', () => {
    const antes = { rotas: ['/saude'], pulado: false }
    expect(comVisto(antes, '/saude')).toBe(antes)
  })

  it('não mexe no pulado', () => {
    expect(comVisto({ rotas: [], pulado: true }, '/saude').pulado).toBe(true)
  })
})

describe('comPulado', () => {
  it('liga uma vez e devolve o mesmo objeto depois', () => {
    const ligado = comPulado(NADA_VISTO)
    expect(ligado.pulado).toBe(true)
    expect(comPulado(ligado)).toBe(ligado)
  })
})

describe('leitura e gravação', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('vai e volta', () => {
    gravarVisto({ rotas: ['/caderno', '/rotina'], pulado: false })
    expect(lerVisto()).toEqual({ rotas: ['/caderno', '/rotina'], pulado: false })
  })

  it('começa do zero sem nada guardado', () => {
    expect(lerVisto()).toEqual(NADA_VISTO)
  })

  it('não quebra com valor corrompido', () => {
    localStorage.setItem('life:tutorial', '{isso não é json')
    expect(lerVisto()).toEqual(NADA_VISTO)
  })

  it('descarta formato estranho em vez de confiar', () => {
    localStorage.setItem('life:tutorial', JSON.stringify({ rotas: 'tudo', pulado: 'sim' }))
    expect(lerVisto()).toEqual(NADA_VISTO)
  })

  it('joga fora item que não é rota', () => {
    localStorage.setItem('life:tutorial', JSON.stringify({ rotas: ['/saude', 7, null] }))
    expect(lerVisto().rotas).toEqual(['/saude'])
  })
})
