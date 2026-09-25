/**
 * A leitura de cada célula: data, valor, tipo, situação, parcela e conta.
 *
 * Funções pequenas e independentes, uma por formato que aparece no mundo real.
 * Ficam juntas por serem a mesma pergunta repetida — "o que este pedaço de
 * texto quer dizer?" — e separadas do resto porque é aqui que mora quase todo
 * o caso chato do importador, e é aqui que os testes batem primeiro.
 */

import { normalizeText } from './import-colunas'

/**
 * Aceita ISO (`2026-09-30`), brasileiro (`30/09/2026`) e as variantes com dois
 * dígitos de ano. Devolve `null` no que não reconhece, para a linha virar um
 * erro visível em vez de um lançamento com data errada.
 */
export function parseDate(value: string): string | null {
  const text = value.trim()
  if (!text) return null

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(text)
  if (br) {
    const year = Number(br[3])
    // "26" é 2026, não 26 d.C. — o pivô em 2000 basta para extrato bancário.
    return validDate(year < 100 ? 2000 + year : year, Number(br[2]), Number(br[1]))
  }

  return null
}

function validDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day, 12)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const INCOME_WORDS = ['receita', 'entrada', 'credito', 'income', 'ganho', 'provento', 'deposito', 'recebimento']
const EXPENSE_WORDS = ['despesa', 'saida', 'debito', 'expense', 'gasto', 'pagamento', 'compra']
const TRANSFER_WORDS = ['transferencia', 'transferi', 'transfer']

/**
 * Descobre se é receita, despesa ou transferência.
 *
 * A coluna de tipo manda quando existe. Sem ela, sobra o sinal do valor — que
 * é como a maioria dos extratos bancários se expressa.
 *
 * Transferência é testada primeiro porque ela não é nem uma coisa nem outra:
 * dinheiro que sai de uma conta sua e entra em outra não é gasto nem ganho, e
 * tratá-la como despesa — que é o que acontecia — inflava o mês inteiro.
 */
export function parseKind(typeText: string, rawAmount: string): 'income' | 'expense' | 'transfer' {
  const text = normalizeText(typeText)
  if (text) {
    if (TRANSFER_WORDS.some((word) => text.includes(word))) return 'transfer'
    if (INCOME_WORDS.some((word) => text.includes(word))) return 'income'
    if (EXPENSE_WORDS.some((word) => text.includes(word))) return 'expense'
  }
  return rawAmount.trim().startsWith('-') ? 'expense' : text ? 'expense' : 'income'
}

/**
 * As duas contas escritas na própria frase: "Transferência de X para Y".
 *
 * É assim que exportador nenhum diz de onde para onde foi — a informação vem
 * na descrição, em português, porque foi escrita para uma pessoa ler. Quando o
 * arquivo tem uma coluna de destino, ela manda; isto aqui é o que salva o
 * arquivo que não tem.
 */
export function parseTransferParties(description: string): { de: string; para: string } | null {
  const match = /\bde\s+(.+?)\s+para\s+(.+)$/i.exec(description.trim())
  if (!match) return null

  const de = match[1]!.trim()
  const para = match[2]!.trim()
  return de && para ? { de, para } : null
}

const PAID_WORDS = ['pago', 'paga', 'recebido', 'recebida', 'efetivado', 'liquidado', 'concluido', 'sim', 'ok', 'true']
const UNPAID_WORDS = ['falta', 'pendente', 'aberto', 'previsto', 'agendado', 'a pagar', 'a receber', 'nao', 'false']

/**
 * "Já foi pago" e "Falta pagar" contêm os dois a palavra "pagar", então a
 * negação é testada primeiro — o contrário marcaria como quitada toda conta
 * que ainda vence.
 */
export function parsePaid(statusText: string, fallback = true): boolean {
  const text = normalizeText(statusText)
  if (!text) return fallback
  if (UNPAID_WORDS.some((word) => text.includes(word))) return false
  if (PAID_WORDS.some((word) => text.includes(word))) return true
  return fallback
}

export interface Installment {
  n: number
  total: number
}

/**
 * Separa a parcela do nome: `Geladeira (5/48)` vira `Geladeira` + 5 de 48.
 *
 * Guardar isso estruturado é o que permite ao app saber quanto ainda falta da
 * moto — a informação estava ali no texto, só não era somável.
 */
export function parseInstallment(description: string): {
  description: string
  installment: Installment | null
} {
  const match = /^(.*?)\s*[([](\d{1,3})\s*[/de]{1,2}\s*(\d{1,3})[)\]]\s*$/i.exec(description.trim())
  if (!match) return { description: description.trim(), installment: null }

  const n = Number(match[2])
  const total = Number(match[3])
  if (n < 1 || total < 1 || n > total) return { description: description.trim(), installment: null }

  return { description: (match[1] ?? '').trim(), installment: { n, total } }
}

/**
 * Limpa o rótulo da conta: `Conta - Banco Azul` vira `Banco Azul`.
 *
 * O prefixo é do app de origem, não do banco. Mantê-lo faria "Conta - Banco
 * Inter" e "Banco Azul" virarem duas contas diferentes na hora de casar.
 */
export function cleanAccountLabel(value: string): string {
  const text = value.trim()
  // "-" é célula vazia em vários exportadores. Sem isto, o traço virava uma
  // conta chamada "-" no meio das contas de verdade.
  if (isBlank(text)) return ''
  const match = /^(?:conta|cartao|cart[ãa]o|carteira)\s*[-–:]\s*(.+)$/i.exec(text)
  return (match?.[1] ?? text).trim()
}

/** Placeholder de célula vazia usado por vários exportadores. */
export function isBlank(value: string): boolean {
  const text = value.trim()
  return text === '' || text === '-' || text === '--' || text === 'N/A'
}
