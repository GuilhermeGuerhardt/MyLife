import { describe, expect, it } from 'vitest'
import { translateAuthError } from './auth-context'

describe('mensagens de erro do login', () => {
  it('traduz credencial inválida sem entregar qual campo errou', () => {
    // Dizer "e-mail não existe" contaria a estranhos quem tem conta aqui.
    expect(translateAuthError('Invalid login credentials')).toBe('E-mail ou senha incorretos.')
  })

  it('explica e-mail não confirmado', () => {
    expect(translateAuthError('Email not confirmed')).toContain('Confirme o e-mail')
  })

  it('reconhece conta já existente', () => {
    expect(translateAuthError('User already registered')).toContain('Já existe uma conta')
    expect(translateAuthError('this email has already been registered')).toContain(
      'Já existe uma conta',
    )
  })

  it('traduz senha curta e e-mail inválido', () => {
    expect(translateAuthError('Password should be at least 6 characters')).toContain(
      'pelo menos 6 caracteres',
    )
    expect(translateAuthError('Unable to validate email address')).toBe('E-mail inválido.')
  })

  it('diferencia excesso de tentativas de falha de rede', () => {
    expect(translateAuthError('Request rate limit reached')).toContain('Muitas tentativas')
    expect(translateAuthError('Failed to fetch')).toContain('Sem conexão')
  })

  it('não engole mensagem que não conhece', () => {
    // Traduzir errado seria pior que mostrar o original: esconderia a pista.
    expect(translateAuthError('Something unexpected happened')).toBe(
      'Something unexpected happened',
    )
  })

  it('não depende de maiúsculas', () => {
    expect(translateAuthError('INVALID LOGIN CREDENTIALS')).toBe('E-mail ou senha incorretos.')
  })
})
