import { describe, expect, it } from 'vitest'
import { NAV } from '@/components/layout/nav'
import { TUTORIAIS, tutorialDaRota } from './conteudo'

describe('tutorialDaRota', () => {
  it('acha o módulo pela tela interna', () => {
    expect(tutorialDaRota('/rotina/tarefas')?.rota).toBe('/rotina')
    expect(tutorialDaRota('/financeiro/importar')?.rota).toBe('/financeiro')
    expect(tutorialDaRota('/saude/plano')?.rota).toBe('/saude')
  })

  it('casa a raiz só com ela mesma', () => {
    expect(tutorialDaRota('/')?.rota).toBe('/')
    expect(tutorialDaRota('/caderno')?.rota).toBe('/caderno')
  })

  it('não confunde rota que só começa igual', () => {
    expect(tutorialDaRota('/cursos')?.rota).toBe('/cursos')
    expect(tutorialDaRota('/faculdade')?.rota).toBe('/faculdade')
  })

  it('devolve nulo em tela sem tutorial', () => {
    expect(tutorialDaRota('/inexistente')).toBeNull()
  })
})

describe('catálogo', () => {
  it('cobre todo módulo do menu', () => {
    const cobertas = new Set(TUTORIAIS.map((tutorial) => tutorial.rota))
    expect(NAV.filter((item) => !cobertas.has(item.to)).map((item) => item.to)).toEqual([])
  })

  it('não repete rota', () => {
    expect(new Set(TUTORIAIS.map((tutorial) => tutorial.rota)).size).toBe(TUTORIAIS.length)
  })

  it('para em quatro passos, que é o que se lê de uma vez', () => {
    for (const tutorial of TUTORIAIS) {
      expect(tutorial.passos.length).toBeGreaterThan(0)
      expect(tutorial.passos.length).toBeLessThanOrEqual(4)
    }
  })
})
