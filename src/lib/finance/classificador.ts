/**
 * Adivinhar a categoria de um lançamento pelo que você já categorizou antes.
 *
 * O extrato do banco não traz categoria — traz `PAG*IFOOD`, `UBER   *TRIP`,
 * `NETFLIX.COM`. Importar 300 linhas significava classificar 300 à mão, e
 * quase ninguém termina. Só que a resposta já está no aparelho: quem usa o app
 * há alguns meses tem centenas de lançamentos com a categoria escolhida por
 * ele mesmo, e "ifood" apareceu quarenta vezes em Alimentação.
 *
 * Daí o modelo ser o seu histórico e não um modelo de fora: acerta mais no seu
 * vocabulário — a padaria da esquina, o nome do seu salão —, responde
 * instantâneo, não custa nada, não depende de internet e nenhum dado sai da
 * máquina.
 *
 * A regra é uma palavra dominante, não uma soma de probabilidades. Vale menos
 * em teoria e muito mais na prática, porque a tela consegue dizer *por que*
 * sugeriu — "por ifood" —, e uma sugestão que se explica é uma sugestão que dá
 * para conferir em lote. Na dúvida ela se cala: numa importação de 300 linhas,
 * uma categoria errada aplicada em silêncio custa mais caro do que nenhuma.
 */

export type TipoClassificavel = 'income' | 'expense'

export interface LancamentoJaClassificado {
  description: string
  kind: string
  category_id: string | null
}

export interface Sugestao {
  categoryId: string
  /** A palavra que sustentou o palpite, para a tela mostrar. */
  chave: string
  /** Quantas vezes essa evidência apareceu no histórico. */
  vezes: number
  /** `descricao` quando a frase inteira já foi classificada antes. */
  motivo: 'descricao' | 'palavra'
}

export interface Classificador {
  sugerir(description: string, kind: TipoClassificavel): Sugestao | null
  /** Quantos lançamentos sustentam o modelo. Zero = o app ainda não sabe nada. */
  base: number
}

/**
 * Uma evidência precisa ter aparecido duas vezes e concordar em 70% delas.
 *
 * Os dois números saíram de medição, não de gosto. Contra um extrato real de
 * 504 lançamentos — treinando nos 352 mais antigos e testando nos 152 mais
 * novos — exigir três ocorrências cobria 52% das linhas; exigir duas cobre 71%
 * com o mesmo acerto, 99%. Já baixar a concordância de 70% para 60% não ganha
 * cobertura nenhuma e passa a errar: é o limite que separa "sempre essa
 * categoria" de "geralmente".
 *
 * Uma ocorrência só fica de fora de propósito. É onde mora o engano de
 * digitação — uma ida ao mercado classificada em Lazer sem querer viraria regra
 * para todo mercado seguinte.
 */
const MIN_VEZES = 2
const MIN_DOMINIO = 0.7

/**
 * Palavras que aparecem em tudo e não dizem nada sobre o assunto.
 *
 * Quase toda é ruído de meio de pagamento — o que a maquininha ou o banco
 * carimbam na frente do nome real do lugar. Nomes de lugar, de marca e de
 * serviço ficam de fora da lista de propósito: são justamente o que carrega o
 * sinal.
 */
const VAZIAS = new Set([
  'pag',
  'pagamento',
  'pagto',
  'compra',
  'cartao',
  'debito',
  'credito',
  'parcela',
  'parc',
  'mensalidade',
  'cobranca',
  'recebimento',
  'ltda',
  'epp',
  'eireli',
  'com',
  'net',
  'www',
  'por',
  'para',
  'dos',
  'das',
  'nos',
  'nas',
  'uma',
  'que',
])

/** Sem acento, sem número, sem pontuação: só as palavras que carregam sentido. */
export function palavras(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((palavra) => palavra.length >= 3 && !VAZIAS.has(palavra))
}

/** Contagem de categorias para uma mesma evidência. */
type Contagem = Map<string, number>

function somar(indice: Map<string, Contagem>, chave: string, categoryId: string): void {
  const atual = indice.get(chave) ?? new Map<string, number>()
  atual.set(categoryId, (atual.get(categoryId) ?? 0) + 1)
  indice.set(chave, atual)
}

/** A categoria dominante de uma evidência, se houver uma. */
function dominante(contagem: Contagem): { categoryId: string; vezes: number } | null {
  let total = 0
  let melhor: { categoryId: string; vezes: number } | null = null

  for (const [categoryId, vezes] of contagem) {
    total += vezes
    if (!melhor || vezes > melhor.vezes) melhor = { categoryId, vezes }
  }

  if (!melhor || total < MIN_VEZES) return null
  return melhor.vezes / total >= MIN_DOMINIO ? melhor : null
}

interface Indices {
  frases: Map<string, Contagem>
  palavras: Map<string, Contagem>
}

function vazio(): Indices {
  return { frases: new Map(), palavras: new Map() }
}

/**
 * Lê o histórico e devolve quem sabe palpitar.
 *
 * Um índice por tipo: categoria de despesa e de receita são conjuntos
 * separados no app, e "empréstimo" que sai não é o "empréstimo" que entra.
 * Transferência fica fora — ela não tem categoria nenhuma, por definição.
 */
export function treinar(historico: LancamentoJaClassificado[]): Classificador {
  const porTipo = new Map<TipoClassificavel, Indices>([
    ['expense', vazio()],
    ['income', vazio()],
  ])
  let base = 0

  for (const lancamento of historico) {
    if (!lancamento.category_id) continue
    if (lancamento.kind !== 'expense' && lancamento.kind !== 'income') continue

    const indices = porTipo.get(lancamento.kind)!
    const termos = palavras(lancamento.description)
    if (termos.length === 0) continue

    base++
    somar(indices.frases, termos.join(' '), lancamento.category_id)
    // A palavra conta uma vez por lançamento: uma descrição que repete a mesma
    // palavra duas vezes não vale por dois.
    for (const palavra of new Set(termos)) somar(indices.palavras, palavra, lancamento.category_id)
  }

  return {
    base,

    sugerir(description, kind) {
      const indices = porTipo.get(kind)
      if (!indices) return null

      const termos = palavras(description)
      if (termos.length === 0) return null

      // A frase inteira primeiro: `NETFLIX.COM` visto quatro vezes em
      // Assinaturas é mais forte do que qualquer palavra solta dele.
      const porFrase = indices.frases.get(termos.join(' '))
      const exata = porFrase ? dominante(porFrase) : null
      if (exata) {
        return {
          categoryId: exata.categoryId,
          chave: description.trim(),
          vezes: exata.vezes,
          motivo: 'descricao',
        }
      }

      // Senão, a palavra mais vista entre as que têm uma categoria dominante.
      let melhor: Sugestao | null = null
      for (const palavra of new Set(termos)) {
        const contagem = indices.palavras.get(palavra)
        if (!contagem) continue

        const manda = dominante(contagem)
        if (!manda) continue

        if (!melhor || manda.vezes > melhor.vezes) {
          melhor = {
            categoryId: manda.categoryId,
            chave: palavra,
            vezes: manda.vezes,
            motivo: 'palavra',
          }
        }
      }

      return melhor
    },
  }
}
