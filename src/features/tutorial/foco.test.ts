import { describe, expect, it } from 'vitest'
import { posicionarBalao, recorte, vale } from './foco'

const TELA = { largura: 1280, altura: 800 }
const BALAO = { largura: 320, altura: 160 }

describe('posicionarBalao', () => {
  it('põe abaixo do alvo quando cabe', () => {
    const p = posicionarBalao({ top: 100, left: 500, width: 200, height: 40 }, BALAO, TELA)
    expect(p.lado).toBe('abaixo')
    expect(p.top).toBe(152)
  })

  it('sobe quando não cabe embaixo', () => {
    const p = posicionarBalao({ top: 700, left: 500, width: 200, height: 40 }, BALAO, TELA)
    expect(p.lado).toBe('acima')
    expect(p.top).toBe(528)
  })

  it('centraliza quando não cabe dos dois lados', () => {
    const baixa = { largura: 1280, altura: 320 }
    const p = posicionarBalao({ top: 120, left: 500, width: 200, height: 120 }, BALAO, baixa)
    expect(p.lado).toBe('centro')
  })

  it('centraliza o passo sem alvo', () => {
    const p = posicionarBalao(null, BALAO, TELA)
    expect(p).toEqual({ lado: 'centro', top: 320, left: 480 })
  })

  it('alinha pelo centro do alvo', () => {
    const p = posicionarBalao({ top: 100, left: 540, width: 200, height: 40 }, BALAO, TELA)
    expect(p.left).toBe(480)
  })

  it('não deixa o balão sair pela esquerda', () => {
    const p = posicionarBalao({ top: 100, left: 0, width: 40, height: 40 }, BALAO, TELA)
    expect(p.left).toBe(16)
  })

  it('não deixa o balão sair pela direita', () => {
    const p = posicionarBalao({ top: 100, left: 1240, width: 40, height: 40 }, BALAO, TELA)
    expect(p.left).toBe(TELA.largura - BALAO.largura - 16)
  })

  it('cabe numa tela estreita sem sair da borda', () => {
    const celular = { largura: 375, altura: 720 }
    const p = posicionarBalao({ top: 80, left: 300, width: 60, height: 40 }, { largura: 343, altura: 180 }, celular)
    expect(p.left).toBeGreaterThanOrEqual(16)
    expect(p.left + 343).toBeLessThanOrEqual(celular.largura)
  })
})

describe('recorte', () => {
  it('abre uma folga em volta do alvo', () => {
    expect(recorte({ top: 100, left: 50, width: 200, height: 40 })).toEqual({
      top: 94,
      left: 44,
      width: 212,
      height: 52,
    })
  })
})

describe('vale', () => {
  it('recusa alvo ausente ou escondido', () => {
    expect(vale(null)).toBe(false)
    expect(vale({ top: 0, left: 0, width: 0, height: 0 })).toBe(false)
    expect(vale({ top: 0, left: 0, width: 200, height: 4 })).toBe(false)
  })

  it('aceita alvo visível', () => {
    expect(vale({ top: 10, left: 10, width: 120, height: 36 })).toBe(true)
  })
})
