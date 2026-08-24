import { describe, expect, it } from 'vitest'
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  generateConfirmationCode,
  matchesConfirmationCode,
} from './reset'

describe('código de confirmação', () => {
  it('tem o tamanho combinado', () => {
    expect(generateConfirmationCode()).toHaveLength(CODE_LENGTH)
  })

  it('usa só o alfabeto sem caracteres ambíguos', () => {
    for (let i = 0; i < 200; i++) {
      for (const char of generateConfirmationCode()) {
        expect(CODE_ALPHABET).toContain(char)
      }
    }
  })

  it('não sorteia os caracteres que se confundem ao copiar', () => {
    for (const ambiguo of ['O', '0', 'I', 'L', '1']) {
      expect(CODE_ALPHABET).not.toContain(ambiguo)
    }
  })

  it('não repete o mesmo código a cada chamada', () => {
    const sorteios = new Set(Array.from({ length: 100 }, () => generateConfirmationCode()))
    // Com 31^6 combinações, 100 sorteios iguais denunciariam um gerador quebrado.
    expect(sorteios.size).toBeGreaterThan(90)
  })
})

describe('conferência do que foi digitado', () => {
  it('aceita o código exato', () => {
    expect(matchesConfirmationCode('K7M2XQ', 'K7M2XQ')).toBe(true)
  })

  it('aceita minúsculas', () => {
    expect(matchesConfirmationCode('k7m2xq', 'K7M2XQ')).toBe(true)
  })

  it('aceita espaço colado junto na cópia', () => {
    expect(matchesConfirmationCode('  K7M2XQ ', 'K7M2XQ')).toBe(true)
  })

  it('recusa código errado', () => {
    expect(matchesConfirmationCode('K7M2XR', 'K7M2XQ')).toBe(false)
  })

  it('recusa código incompleto', () => {
    expect(matchesConfirmationCode('K7M2X', 'K7M2XQ')).toBe(false)
  })

  it('recusa entrada vazia', () => {
    expect(matchesConfirmationCode('', 'K7M2XQ')).toBe(false)
    expect(matchesConfirmationCode('   ', 'K7M2XQ')).toBe(false)
  })

  it('recusa tudo quando não há código — nada libera por omissão', () => {
    expect(matchesConfirmationCode('', '')).toBe(false)
    expect(matchesConfirmationCode('qualquer', '')).toBe(false)
  })
})
