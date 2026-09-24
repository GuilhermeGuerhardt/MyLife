/**
 * As caixas de tarefa do Markdown, para poderem ser marcadas na leitura.
 *
 * Marcar uma tarefa é a coisa mais frequente que se faz num caderno de estudo,
 * e exigia trocar para o modo de edição e digitar um `x` entre colchetes — o
 * que joga o Markdown cru na cara de quem só queria riscar um item.
 *
 * A ligação entre o que foi clicado e a linha do texto é **por posição**, nunca
 * pelo conteúdo: duas tarefas com o mesmo nome são comuns numa lista de revisão,
 * e casar por texto marcaria a errada.
 */

/**
 * Item de tarefa: indentação livre, marcador `-`, `*`, `+` ou número, e o
 * colchete com espaço, `x` ou `X`.
 *
 * É a mesma forma que o `marked` reconhece como task list do GFM — as duas
 * pontas precisam concordar sobre o que conta, ou o ordinal desalinha.
 */
const TAREFA = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\]\s)/

/** Abertura ou fechamento de bloco cercado, com ``` ou ~~~. */
const CERCA = /^\s*(```|~~~)/

export interface LinhaDeTarefa {
  /** Índice da linha no texto, base zero. */
  linha: number
  marcada: boolean
}

/**
 * As linhas de tarefa, na ordem do documento.
 *
 * Bloco de código fica de fora: lá dentro `- [ ]` é o exemplo que a pessoa quis
 * mostrar, e o `marked` também não o transforma em caixa. Se uma ponta contasse
 * e a outra não, todo ordinal depois do bloco apontaria para a linha errada.
 */
export function linhasDeTarefa(markdown: string): LinhaDeTarefa[] {
  const linhas = markdown.split('\n')
  const achadas: LinhaDeTarefa[] = []
  let dentroDeCodigo = false

  for (const [i, texto] of linhas.entries()) {
    if (CERCA.test(texto)) {
      dentroDeCodigo = !dentroDeCodigo
      continue
    }
    if (dentroDeCodigo) continue

    const achado = TAREFA.exec(texto)
    if (achado) achadas.push({ linha: i, marcada: achado[2] !== ' ' })
  }

  return achadas
}

/**
 * Alterna a enésima tarefa do texto.
 *
 * `esperadaMarcada` é o estado que a tela acreditava ter no momento do clique.
 * Divergindo, devolve `null` e nada é escrito: numa operação que reescreve o
 * texto do usuário, não fazer nada é melhor que marcar a tarefa errada. O
 * desencontro só aconteceria num caso de borda que esta varredura não previu —
 * e é exatamente aí que escrever seria estrago silencioso.
 */
export function alternarTarefa(
  markdown: string,
  ordinal: number,
  esperadaMarcada: boolean,
): string | null {
  const tarefas = linhasDeTarefa(markdown)
  const alvo = tarefas[ordinal]
  if (!alvo || alvo.marcada !== esperadaMarcada) return null

  const linhas = markdown.split('\n')
  const original = linhas[alvo.linha]
  if (original === undefined) return null

  // Troca só o caractere entre os colchetes: indentação, marcador e texto da
  // linha ficam exatamente como estavam.
  linhas[alvo.linha] = original.replace(TAREFA, (_inteiro, antes: string, _estado, depois: string) =>
    `${antes}${alvo.marcada ? ' ' : 'x'}${depois}`,
  )

  return linhas.join('\n')
}

/** Quantas tarefas há e quantas estão feitas — para um resumo, se um dia valer. */
export function progressoDasTarefas(markdown: string): { feitas: number; total: number } {
  const tarefas = linhasDeTarefa(markdown)
  return { feitas: tarefas.filter((t) => t.marcada).length, total: tarefas.length }
}
