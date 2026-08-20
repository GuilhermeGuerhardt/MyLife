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

/** Centavos para "1.234,56" (sem símbolo), para inputs. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

export function centsToNumber(cents: number): number {
  return cents / 100
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
