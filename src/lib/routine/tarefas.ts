/**
 * A lista de tarefas, vindo de dois lugares.
 *
 * Metade é escrita na própria tela: "renovar o seguro", "ligar para o
 * dentista" — o que não é de curso, não se repete e não tem valor em dinheiro.
 * A outra metade já estava no caderno, como `- [ ]` no meio de uma anotação de
 * aula, onde ninguém mais voltava para ver.
 *
 * Juntar as duas é o ponto: uma lista só responde "o que eu tenho que fazer",
 * e marcar aqui marca lá dentro da anotação. Duas listas seriam dois lugares
 * para procurar a mesma coisa — e o segundo sempre fica esquecido.
 */

export type OrigemDaTarefa =
  | { tipo: 'propria'; id: string }
  | { tipo: 'nota'; id: string; titulo: string; ordinal: number }

export interface ItemDeTarefa {
  /** Única na lista inteira; serve de chave de render e de alvo do clique. */
  chave: string
  titulo: string
  feita: boolean
  /** Prazo, quando tem. */
  data: string | null
  origem: OrigemDaTarefa
}

export interface TarefaPropria {
  id: string
  title: string
  done: boolean
  date: string | null
}

export interface NotaComTarefas {
  id: string
  title: string
  tarefas: Array<{ ordinal: number; texto: string; feita: boolean }>
}

export function montarLista(
  proprias: TarefaPropria[],
  notas: NotaComTarefas[],
): ItemDeTarefa[] {
  const daTela: ItemDeTarefa[] = proprias.map((tarefa) => ({
    chave: `propria:${tarefa.id}`,
    titulo: tarefa.title,
    feita: tarefa.done,
    data: tarefa.date,
    origem: { tipo: 'propria', id: tarefa.id },
  }))

  const doCaderno: ItemDeTarefa[] = notas.flatMap((nota) =>
    nota.tarefas
      // Caixa sem texto é linha que alguém começou e não escreveu: mostrar um
      // item em branco na lista não ajuda ninguém.
      .filter((tarefa) => tarefa.texto.trim() !== '')
      .map((tarefa) => ({
        chave: `nota:${nota.id}:${tarefa.ordinal}`,
        titulo: tarefa.texto,
        feita: tarefa.feita,
        // A tarefa escrita no meio do texto não tem prazo: quem quer prazo
        // escreve na lista.
        data: null,
        origem: {
          tipo: 'nota' as const,
          id: nota.id,
          titulo: nota.title,
          ordinal: tarefa.ordinal,
        },
      })),
  )

  return ordenar([...daTela, ...doCaderno])
}

/**
 * Pendente antes de feita; com prazo antes de sem prazo; a mais atrasada no
 * topo.
 *
 * O que já foi feito desce mas não some: riscar e ver a lista encolher é
 * metade da graça, e some de vez só quando a pessoa filtrar.
 */
export function ordenar(itens: ItemDeTarefa[]): ItemDeTarefa[] {
  return [...itens].sort((a, b) => {
    if (a.feita !== b.feita) return a.feita ? 1 : -1
    if (a.data && b.data) return a.data.localeCompare(b.data)
    if (a.data) return -1
    if (b.data) return 1
    return a.titulo.localeCompare(b.titulo, 'pt-BR')
  })
}

export type FiltroDeTarefa = 'pendentes' | 'feitas' | 'todas'

export function filtrar(itens: ItemDeTarefa[], filtro: FiltroDeTarefa): ItemDeTarefa[] {
  if (filtro === 'todas') return itens
  return itens.filter((item) => item.feita === (filtro === 'feitas'))
}

/**
 * As tarefas do caderno que o usuário tirou do quadro.
 *
 * Casa por anotação e texto, nunca por posição: escrever uma caixinha nova
 * acima empurraria todas as outras e esconderia a tarefa errada.
 *
 * Nada some sozinho. Só sai do quadro o que a pessoa mandou sair, e a caixinha
 * continua escrita na anotação — de lá ela só sai apagando a linha.
 */
export interface TarefaOculta {
  nota: string
  texto: string
}

export function estaOculta(item: ItemDeTarefa, ocultas: readonly TarefaOculta[]): boolean {
  if (item.origem.tipo !== 'nota') return false
  const nota = item.origem.id
  return ocultas.some((oculta) => oculta.nota === nota && oculta.texto === item.titulo)
}

export function semAsOcultas(
  itens: readonly ItemDeTarefa[],
  ocultas: readonly TarefaOculta[],
): ItemDeTarefa[] {
  return itens.filter((item) => !estaOculta(item, ocultas))
}

export function apenasAsOcultas(
  itens: readonly ItemDeTarefa[],
  ocultas: readonly TarefaOculta[],
): ItemDeTarefa[] {
  return itens.filter((item) => estaOculta(item, ocultas))
}

/**
 * O quadro: o que falta de um lado, o que saiu do outro.
 *
 * Duas colunas e não três. A tarefa escrita dentro de uma anotação é uma
 * caixinha marcada ou desmarcada, e não existe "fazendo" no meio de um
 * `- [ ]` — uma terceira coluna funcionaria para metade dos cartões e ficaria
 * proibida para a outra metade.
 */
export type ColunaDeTarefa = 'pendentes' | 'feitas'

export interface QuadroDeTarefas {
  pendentes: ItemDeTarefa[]
  feitas: ItemDeTarefa[]
}

export function separarEmColunas(itens: ItemDeTarefa[]): QuadroDeTarefas {
  return {
    pendentes: itens.filter((item) => !item.feita),
    feitas: itens.filter((item) => item.feita),
  }
}

/** Em que coluna o cartão está agora. */
export function colunaDe(item: ItemDeTarefa): ColunaDeTarefa {
  return item.feita ? 'feitas' : 'pendentes'
}

/**
 * Se soltar o cartão nesta coluna muda alguma coisa.
 *
 * Soltar onde já estava é o gesto mais comum de todos — a pessoa começa a
 * arrastar, se arrepende e solta no mesmo lugar. Gravar nessa hora marcaria a
 * tarefa como feita sem ninguém ter pedido.
 */
export function mudaDeColuna(item: ItemDeTarefa, destino: ColunaDeTarefa): boolean {
  return colunaDe(item) !== destino
}

export interface ResumoDeTarefas {
  pendentes: number
  feitas: number
  atrasadas: number
  /** Quantas vieram do caderno — é o que justifica a coluna de origem. */
  doCaderno: number
}

export function resumir(itens: ItemDeTarefa[], hoje: string): ResumoDeTarefas {
  return {
    pendentes: itens.filter((i) => !i.feita).length,
    feitas: itens.filter((i) => i.feita).length,
    atrasadas: itens.filter((i) => !i.feita && i.data !== null && i.data < hoje).length,
    doCaderno: itens.filter((i) => i.origem.tipo === 'nota').length,
  }
}

/** Como a data aparece na linha: o que importa é o quanto falta, não o dia. */
export function prazoEmPalavras(data: string, hoje: string): string {
  if (data < hoje) return 'atrasada'
  if (data === hoje) return 'hoje'

  const dias = Math.round(
    (Date.parse(`${data}T12:00:00`) - Date.parse(`${hoje}T12:00:00`)) / 86_400_000,
  )
  if (dias === 1) return 'amanhã'
  if (dias <= 7) return `em ${dias} dias`

  const [, mes, dia] = data.split('-')
  return `${dia}/${mes}`
}
