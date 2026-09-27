/**
 * Dinheiro em centavos.
 *
 * Todo valor monetário do app é um inteiro de centavos. Guardar reais como
 * número decimal parece inofensivo até somar algumas centenas de lançamentos:
 * 0,1 + 0,2 não dá 0,3 em ponto flutuante, e o saldo passa a fechar com uns
 * centavos de diferença que ninguém consegue explicar.
 *
 * A conversão acontece só nas bordas: `parseAmount` na entrada, `formatCents`
 * na saída.
 */

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** Centavos para "R$ 1.234,56". */
export function formatCents(cents: number): string {
  return brl.format(cents / 100)
}

/**
 * Centavos para "1.234,56" (sem símbolo), para campos de digitação.
 *
 * Com o ponto do milhar, igual ao que a máscara escreve enquanto se digita: um
 * valor que abre sem ponto e ganha ponto ao receber uma tecla pareceria que o
 * campo mexeu no número sozinho.
 */
export function centsToInput(cents: number): string {
  const [inteiro, decimal] = Math.abs(cents / 100)
    .toFixed(2)
    .split('.') as [string, string]
  const agrupado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${cents < 0 ? '-' : ''}${agrupado},${decimal}`
}

/** Teto da máscara: 13 dígitos são 99 bilhões, mais do que cabe em qualquer vida. */
const MAX_DIGITOS = 13

/**
 * O que mostrar enquanto a pessoa digita um valor.
 *
 * Conta pelos centavos, da direita para a esquerda, como o caixa eletrônico e
 * todo app de banco: digitar `3550` escreve `35,50`, e o próximo dígito empurra
 * tudo para o lado. Assim ninguém precisa procurar a vírgula no teclado nem
 * lembrar de pôr o ponto do milhar — era isso que fazia o valor entrar errado
 * quando a pressa batia.
 *
 * Só os dígitos contam: vírgula, ponto, `R$` e espaço colados de um extrato são
 * ignorados, então colar `R$ 1.234,56` dá no mesmo que digitar `123456`.
 */
export function mascaraDeDinheiro(texto: string): string {
  const digitos = texto.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MAX_DIGITOS)
  if (!digitos) return ''
  return centsToInput(Number(digitos))
}

/**
 * Converte o que a pessoa digitou em centavos.
 *
 * Aceita "35", "35,50", "R$ 1.234,56", "1234.56" e "1.234". A ambiguidade do
 * ponto é resolvida como no resto do app: com vírgula presente, o ponto é
 * separador de milhar; sem vírgula, só é milhar quando separa 3 dígitos.
 */
export function parseAmount(input: string): number {
  const cleaned = input
    .replace(/[R$\s]/gi, '')
    .replace(/[^\d.,-]/g, '')
    .trim()
  if (!cleaned) return 0

  let normalized: string
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '')
  } else {
    normalized = cleaned
  }

  const value = Number(normalized)
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100)
}

/**
 * Divide um valor em N parcelas sem perder centavos.
 *
 * 100,00 em 3 vezes vira 33,34 + 33,33 + 33,33 — a sobra fica na primeira,
 * que é como as operadoras fazem. Somar as parcelas devolve exatamente o
 * total original.
 */
export function splitInstallments(totalCents: number, count: number): number[] {
  if (count <= 1) return [totalCents]
  const base = Math.floor(totalCents / count)
  const remainder = totalCents - base * count
  return Array.from({ length: count }, (_, index) => (index === 0 ? base + remainder : base))
}
