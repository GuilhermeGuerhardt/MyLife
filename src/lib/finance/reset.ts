/**
 * Código de confirmação para operações sem desfazer.
 *
 * Digitar um código sorteado na hora é o que separa "quero apagar" de "cliquei
 * sem ler". Um `confirm()` do navegador não separa — a mão já aprendeu a passar
 * por ele.
 */

/**
 * Alfabeto sem os pares que a pessoa confunde ao copiar: `O`/`0`, `I`/`L`/`1`.
 * Manter esses caracteres transformaria a proteção em irritação, e irritação
 * ensina a colar o código sem lê-lo.
 */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export const CODE_LENGTH = 6

/** Sorteia o código com o gerador criptográfico — `Math.random` não é sorteio. */
export function generateConfirmationCode(): string {
  const values = new Uint32Array(CODE_LENGTH)
  crypto.getRandomValues(values)

  let code = ''
  for (const value of values) {
    code += CODE_ALPHABET[value % CODE_ALPHABET.length]
  }
  return code
}

/**
 * Confere o que foi digitado.
 *
 * Ignora caixa e espaços nas pontas: quem copiou o código não deve ser punido
 * por um espaço colado junto, e exigir maiúscula não torna a decisão mais
 * consciente — só mais chata.
 */
export function matchesConfirmationCode(input: string, code: string): boolean {
  if (!code) return false
  return input.trim().toUpperCase() === code.trim().toUpperCase()
}
