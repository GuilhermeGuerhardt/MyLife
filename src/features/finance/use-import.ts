/**
 * A gravação da importação.
 *
 * `src/lib/finance/import.ts` transforma texto em `ImportRow` sem saber que o
 * app existe. Aqui é o contrário: nada de parsing, só a ponte entre as linhas
 * revisadas e as tabelas — inclusive criar a conta e a categoria que o arquivo
 * menciona e o app ainda não tem.
 */

import { useAccounts, useCategories, useTransactions } from '@/data/queries'
import { guessCategory } from '@/data/seed-finance'
import type { Account, BaseRow, Category, Transaction } from '@/data/types'
import { cardConfig } from '@/features/finance/actions'
import { DEFAULT_ICON } from '@/features/finance/category-icons'
import { competenceFor } from '@/lib/finance/billing'
import { normalizeText, type ImportRow } from '@/lib/finance/import'
import { CHART_PALETTE } from '@/lib/finance/palette'
import { uid } from '@/lib/utils'

import type { ImportProgress, ImportResult } from '@/lib/finance/import-result'

// O andamento e o recibo moram num módulo sem dependência nenhuma: assim o
// cartão do canto — montado em todas as telas — fala deles sem arrastar a
// gravação para o pacote inicial. Repassados aqui para quem já os importava.
export {
  descreverResultado,
  type ImportProgress,
  type ImportResult,
} from '@/lib/finance/import-result'

/** Valor especial das listas de mapeamento. */
export const CREATE = '__create__'
export const IGNORE = '__ignore__'

const ACCOUNT_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#14b8a6', '#eab308', '#64748b']

// ---------------------------------------------------------------------------
// Sugestão de correspondência
// ---------------------------------------------------------------------------

/**
 * Casa o rótulo do arquivo com uma conta que já existe.
 *
 * Compara normalizado e aceita conter: "Banco Azul" no arquivo encontra
 * "Inter" no app. Sem correspondência, sugere criar — melhor do que jogar tudo
 * numa conta qualquer e a pessoa descobrir depois.
 */
export function suggestAccounts(labels: string[], accounts: Account[]): Record<string, string> {
  const result: Record<string, string> = {}

  for (const label of labels) {
    const target = normalizeText(label)
    const exact = accounts.find((account) => normalizeText(account.name) === target)
    const partial =
      exact ??
      accounts.find((account) => {
        const name = normalizeText(account.name)
        return name.includes(target) || target.includes(name)
      })
    result[label] = partial?.id ?? CREATE
  }

  return result
}

/**
 * Casa o rótulo de categoria do arquivo com uma categoria do app.
 *
 * Primeiro pelo nome; depois pelas palavras-chave do catálogo, que já existem
 * para o registro rápido — é assim que "Combustível" cai em Transporte sem
 * ninguém ter configurado nada. O que sobra vira categoria nova.
 */
export function suggestCategories(
  labels: LabelKind[],
  categories: Category[],
): Record<string, string> {
  const result: Record<string, string> = {}

  for (const { label, kind } of labels) {
    const target = normalizeText(label)
    const byName = categories.find(
      (category) => category.kind === kind && normalizeText(category.name) === target,
    )
    result[chaveDaCategoria(label, kind)] =
      (byName ?? guessCategory(label, categories, kind))?.id ?? CREATE
  }

  return result
}

/** Um rótulo de categoria do arquivo e o tipo que ele representa. */
export interface LabelKind {
  label: string
  kind: 'income' | 'expense'
}

/**
 * A chave do mapeamento de categorias: o rótulo **e** o tipo.
 *
 * Só o rótulo não serve. "Empréstimo" aparece nos dois lados de um extrato
 * real — o dinheiro que você emprestou e o que recebeu de volta —, e uma
 * entrada só no mapa obrigaria os dois a irem para a mesma categoria. Uma
 * categoria tem tipo, então a receita acabava com uma categoria de despesa
 * colada nela.
 */
export function chaveDaCategoria(label: string, kind: 'income' | 'expense'): string {
  return `${kind}|${label}`
}

/** Desfaz a chave. O rótulo pode conter `|`, então só o primeiro separa. */
export function lerChaveDaCategoria(chave: string): LabelKind {
  const corte = chave.indexOf('|')
  return {
    kind: chave.slice(0, corte) === 'income' ? 'income' : 'expense',
    label: chave.slice(corte + 1),
  }
}

/**
 * Os rótulos de categoria do arquivo, um por tipo em que aparecem.
 *
 * Um rótulo que só aparece como despesa rende uma entrada; um que aparece dos
 * dois lados rende duas, e cada uma escolhe a sua categoria. A ordem é a de
 * aparição, para a tela listar na mesma sequência do arquivo.
 */
export function labelKinds(rows: ImportRow[]): LabelKind[] {
  const vistos = new Map<string, LabelKind>()

  for (const row of rows) {
    // Transferência não tem categoria: o dinheiro não foi para lugar nenhum,
    // só trocou de conta.
    if (row.kind === 'transfer') continue
    const label = row.categoryLabel.trim()
    if (!label) continue
    const chave = chaveDaCategoria(label, row.kind)
    if (!vistos.has(chave)) vistos.set(chave, { label, kind: row.kind })
  }

  return [...vistos.values()]
}

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------

export interface ImportPlan {
  rows: ImportRow[]
  /** Rótulo do arquivo → id da conta, ou `CREATE`. */
  accounts: Record<string, string>
  /**
   * Rótulo **com o tipo** (ver `chaveDaCategoria`) → id da categoria, `CREATE`
   * ou `IGNORE`. Com o tipo na chave, "Empréstimo" que sai e "Empréstimo" que
   * entra podem apontar para categorias diferentes, como devem.
   */
  categories: Record<string, string>
  /** Conta usada quando a linha não traz rótulo nenhum. */
  fallbackAccountId: string
}

/**
 * Agrupa as parcelas espalhadas pelo arquivo.
 *
 * O extrato traz uma linha por parcela — `Geladeira (5/48)` e `(4/48)` são
 * linhas distintas do mesmo financiamento. Dar a elas o mesmo
 * `installment_group_id` é o que permite ao app tratá-las como uma compra só,
 * inclusive apagar tudo de uma vez.
 */
function installmentGroups(rows: ImportRow[]): Map<string, string> {
  const grupos = new Map<string, string>()
  for (const row of rows) {
    if (!row.installment) continue
    const chave = chaveDoGrupo(row.description, row.installment.total)
    if (!grupos.has(chave)) grupos.set(chave, uid())
  }
  return grupos
}

/** Nome e total de parcelas: o que identifica uma compra parcelada no arquivo. */
function chaveDoGrupo(descricao: string, total: number): string {
  return `${normalizeText(descricao)}|${total}`
}

/**
 * Cria as contas que o arquivo cita e o app não tem.
 *
 * Todas antes do primeiro lançamento: cada linha precisa do id para apontar, e
 * criar sob demanda dentro do laço faria a mesma conta nascer duas vezes.
 */
async function criarContasQueFaltam(
  escolhas: Record<string, string>,
  criar: (draft: Omit<Account, keyof BaseRow>) => Promise<Account>,
  aoCriar: () => void,
): Promise<{ ids: Map<string, string>; criadas: number }> {
  const ids = new Map<string, string>()
  let criadas = 0

  for (const [label, escolha] of Object.entries(escolhas)) {
    if (escolha !== CREATE) {
      ids.set(label, escolha)
      continue
    }

    const conta = await criar({
      name: label,
      kind: 'checking',
      bank: null,
      initial_balance_cents: 0,
      credit_limit_cents: null,
      closing_day: null,
      due_day: null,
      color: ACCOUNT_COLORS[criadas % ACCOUNT_COLORS.length]!,
      archived: false,
    })

    ids.set(label, conta.id)
    criadas++
    aoCriar()
  }

  return { ids, criadas }
}

/** O mesmo para as categorias, que ainda carregam o tipo na chave. */
async function criarCategoriasQueFaltam(
  escolhas: Record<string, string>,
  criar: (draft: Omit<Category, keyof BaseRow>) => Promise<Category>,
  aoCriar: () => void,
): Promise<{ ids: Map<string, string | null>; criadas: number }> {
  const ids = new Map<string, string | null>()
  let criadas = 0

  for (const [chave, escolha] of Object.entries(escolhas)) {
    if (escolha === IGNORE) {
      ids.set(chave, null)
      continue
    }
    if (escolha !== CREATE) {
      ids.set(chave, escolha)
      continue
    }

    const { label, kind } = lerChaveDaCategoria(chave)
    const categoria = await criar({
      name: label,
      kind,
      // Uma cor por categoria, girando a paleta — como as contas já faziam.
      // Enquanto todas nasciam do mesmo cinza, o gráfico "Onde foi o dinheiro"
      // saía monocromático e não dava para ler fatia nenhuma.
      color: CHART_PALETTE[criadas % CHART_PALETTE.length]!,
      icon: DEFAULT_ICON,
      // O próprio nome vira palavra-chave: a próxima importação (e o registro
      // rápido) já reconhecem essa categoria sozinhos.
      keywords: [normalizeText(label)],
    })

    ids.set(chave, categoria.id)
    criadas++
    aoCriar()
  }

  return { ids, criadas }
}

/** Para onde cada rótulo do arquivo aponta depois de contas e categorias prontas. */
export interface AlvosDaImportacao {
  /** Rótulo da conta → id. */
  contas: Map<string, string>
  /** Chave da categoria (rótulo + tipo) → id, ou `null` para "sem categoria". */
  categorias: Map<string, string | null>
  /** As contas que já existiam, para saber quais são cartão. */
  contasPorId: Map<string, Account>
  /** Conta usada quando a linha não traz rótulo nenhum. */
  fallbackAccountId: string
}

/**
 * As linhas revisadas viram lançamentos prontos para gravar.
 *
 * Função pura, e é o que ela tem de melhor: a tradução de uma linha de planilha
 * em lançamento — competência do cartão, as duas pontas da transferência, o
 * grupo do parcelamento, a categoria do tipo certo — é a parte que mais erra em
 * silêncio, e aqui ela pode ser testada sem banco nem tela.
 */
export function montarLancamentos(
  rows: ImportRow[],
  alvos: AlvosDaImportacao,
): Array<Omit<Transaction, keyof BaseRow>> {
  const grupos = installmentGroups(rows)
  const lancamentos: Array<Omit<Transaction, keyof BaseRow>> = []

  for (const row of rows) {
    const contaId = alvos.contas.get(row.accountLabel) ?? alvos.fallbackAccountId
    if (!contaId) continue

    // A transferência precisa das duas pontas. Sem a de destino — ou indo e
    // vindo da mesma conta — ela não é gravável, e gravar só a saída seria
    // inventar um gasto que não houve.
    const destinoId = row.kind === 'transfer' ? (alvos.contas.get(row.transferToLabel) ?? null) : null
    if (row.kind === 'transfer' && (!destinoId || destinoId === contaId)) continue

    // Conta recém-criada não está em `contasPorId` (a lista é a do render), mas
    // também não é cartão — só cartão muda a competência, então o `undefined`
    // aqui leva à competência pela data, que é o certo.
    const cartao = cardConfig(alvos.contasPorId.get(contaId))

    lancamentos.push({
      account_id: contaId,
      transfer_account_id: destinoId,
      category_id:
        row.kind === 'transfer'
          ? null
          : (alvos.categorias.get(chaveDaCategoria(row.categoryLabel, row.kind)) ?? null),
      kind: row.kind,
      amount_cents: row.amountCents,
      date: row.date,
      competence: competenceFor(row.date, cartao),
      description: row.description,
      tags: ['importado'],
      paid: row.paid,
      installment_group_id: row.installment
        ? (grupos.get(chaveDoGrupo(row.description, row.installment.total)) ?? null)
        : null,
      installment_n: row.installment?.n ?? null,
      installment_total: row.installment?.total ?? null,
      recurring_id: null,
      notes: row.detail,
    })
  }

  return lancamentos
}

export function useRunImport() {
  const { data: accounts, create: createAccount } = useAccounts()
  const { create: createCategory } = useCategories()
  const { createMany: createTransactions } = useTransactions()

  return async function runImport(
    plan: ImportPlan,
    onProgress?: (progress: ImportProgress) => void,
  ): Promise<ImportResult> {
    // O total conta contas e categorias novas junto dos lançamentos: são
    // gravações que também levam tempo, e deixá-las fora faria a barra ficar
    // parada no zero antes de começar a andar.
    const aCriar = (escolhas: Record<string, string>) =>
      Object.values(escolhas).filter((escolha) => escolha === CREATE).length
    const total = aCriar(plan.accounts) + aCriar(plan.categories) + plan.rows.length

    let feitos = 0
    const avancar = () => onProgress?.({ done: ++feitos, total })
    onProgress?.({ done: 0, total })

    const contas = await criarContasQueFaltam(
      plan.accounts,
      (draft) => createAccount.mutateAsync(draft),
      avancar,
    )
    const categorias = await criarCategoriasQueFaltam(
      plan.categories,
      (draft) => createCategory.mutateAsync(draft),
      avancar,
    )

    const lancamentos = montarLancamentos(plan.rows, {
      contas: contas.ids,
      categorias: categorias.ids,
      contasPorId: new Map(accounts.map((conta) => [conta.id, conta])),
      fallbackAccountId: plan.fallbackAccountId,
    })

    await createTransactions(lancamentos, (done) => onProgress?.({ done: feitos + done, total }))

    return {
      transactions: lancamentos.length,
      accountsCreated: contas.criadas,
      categoriesCreated: categorias.criadas,
    }
  }
}
