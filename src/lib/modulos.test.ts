import { describe, expect, it } from 'vitest'
import { escondidos, moduloAtivo, montarModulos } from './modulos'

const NAV = [
  { to: '/' },
  { to: '/saude' },
  { to: '/faculdade' },
  { to: '/cursos' },
] as const

describe('montarModulos', () => {
  it('mostra tudo quando nada foi ajustado', () => {
    expect(montarModulos(NAV, []).every((item) => item.visible)).toBe(true)
  })

  it('esconde o que foi desligado', () => {
    const itens = montarModulos(NAV, [{ modulo: '/saude', visible: false }])
    expect(itens.find((item) => item.def.to === '/saude')?.visible).toBe(false)
    expect(itens.find((item) => item.def.to === '/cursos')?.visible).toBe(true)
  })

  it('mantém o Início mesmo com ajuste salvo mandando esconder', () => {
    const itens = montarModulos(NAV, [{ modulo: '/', visible: false }])
    const inicio = itens.find((item) => item.def.to === '/')
    expect(inicio?.visible).toBe(true)
    expect(inicio?.podeEsconder).toBe(false)
  })

  it('preserva a ordem do menu', () => {
    const itens = montarModulos(NAV, [{ modulo: '/saude', visible: false }])
    expect(itens.map((item) => item.def.to)).toEqual(['/', '/saude', '/faculdade', '/cursos'])
  })

  it('ignora ajuste de módulo que não existe mais', () => {
    const itens = montarModulos(NAV, [{ modulo: '/dividas', visible: false }])
    expect(itens).toHaveLength(NAV.length)
    expect(itens.every((item) => item.visible)).toBe(true)
  })
})

describe('escondidos', () => {
  it('junta só as rotas fora do menu', () => {
    const itens = montarModulos(NAV, [
      { modulo: '/saude', visible: false },
      { modulo: '/cursos', visible: false },
    ])
    expect(escondidos(itens)).toEqual(new Set(['/saude', '/cursos']))
  })
})

describe('moduloAtivo', () => {
  it('mantém widget sem módulo declarado', () => {
    expect(moduloAtivo([], new Set(['/saude']))).toBe(true)
  })

  it('tira o widget quando o módulo dele saiu', () => {
    expect(moduloAtivo(['/saude'], new Set(['/saude']))).toBe(false)
  })

  it('mantém o widget de dois módulos enquanto um sobra', () => {
    expect(moduloAtivo(['/faculdade', '/cursos'], new Set(['/faculdade']))).toBe(true)
    expect(moduloAtivo(['/faculdade', '/cursos'], new Set(['/faculdade', '/cursos']))).toBe(false)
  })
})
