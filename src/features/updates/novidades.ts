/**
 * O que mudou em cada versão, contado para quem usa e não para quem programa.
 *
 * O app se atualiza sozinho, e antes disto a pessoa reabria o programa com
 * recursos novos e nenhuma pista de que existiam. A página de release conta a
 * mesma história, mas ninguém abre o GitHub depois de clicar em "Atualizar".
 *
 * Só entra aqui o que muda o que dá para fazer. Refatoração, teste e correção
 * que ninguém chegou a ver não viram linha: uma lista honesta e curta é lida,
 * uma lista completa é fechada.
 */

export interface Novidade {
  versao: string
  titulo: string
  itens: string[]
}

/** Da mais nova para a mais antiga, que é a ordem em que aparecem. */
export const NOVIDADES: Novidade[] = [
  {
    versao: '0.6.0',
    titulo: 'Avisos, backup automático e o que se repete à vista',
    itens: [
      'Avisos no canto da tela, mesmo com o app minimizado: fatura perto de vencer, prova chegando, recorrente por lançar e os hábitos do dia. Ligue em Perfil.',
      'Backup automático: uma cópia por dia numa pasta sua, guardando as últimas semanas.',
      'Botão Estudar em cada curso e disciplina: o cronômetro fica no topo de todas as telas, tem modo Pomodoro, e o tempo da semana aparece no curso.',
      'A receber: anote a parte dos outros numa conta que você pagou e registre o reembolso quando o dinheiro voltar.',
      'Recorrentes mostra os parcelamentos em andamento e acha o que já se repete no seu histórico, inclusive parcela com data para acabar.',
      'Patrimônio mês a mês em Contas e cartões, saldo no fim de cada mês no gráfico de fluxo, e a Revisão do mês em Rotina.',
      'Em Lançamentos, marque vários de uma vez para pagar, desmarcar ou apagar. E as telas do Financeiro cabem no celular.',
    ],
  },
  {
    versao: '0.5.0',
    titulo: 'Cartão do jeito que a gente pensa e extrato conferido',
    itens: [
      'A compra no cartão fica no mês em que você comprou; a fatura aparece à parte, no mês em que vence.',
      'Fatura pode ser paga em partes, e só fica paga quando é paga de verdade.',
      'Conferência de extrato: compare o saldo do app com o do banco numa data e veja o que falta lançar.',
      'A Visão geral ganhou o saldo previsto do mês e um carrossel com o que vem pela frente.',
      'Na importação, o app reconhece o que se repete e aprende a categoria com o que você já classificou.',
      'O campo de valor escreve a vírgula sozinho.',
    ],
  },
  {
    versao: '0.4.0',
    titulo: 'Caderno novo, quadro de tarefas e um app mais limpo',
    itens: [
      'A fazer virou um quadro: arraste o cartão entre "A fazer" e "Feitas". As caixinhas que você escreve nas anotações entram nele sozinhas, e marcar em um lugar marca no outro.',
      'Excluir uma tarefa que veio do caderno pergunta de onde: só do quadro, ou a linha dentro da anotação também.',
      'O Caderno ganhou tabela, blocos que abrem e fecham, destaque, atalhos de teclado e a barra de formatação fixa, com só o texto rolando.',
      'Escreva [[ para ligar uma anotação na outra, e veja no rodapé quem cita a que você está lendo.',
      'Qualquer tela abre em janela separada, para arrastar até o outro monitor.',
      'Ao importar extrato, o app sugere a categoria de cada lançamento aprendendo com o que você já classificou.',
      'Em Perfil você desliga os módulos que não usa, e cada tela mostra um guia na primeira visita.',
    ],
  },
  {
    versao: '0.3.0',
    titulo: 'Importação que não duplica e cartão que diz onde caiu',
    itens: [
      'Transferência entre contas suas deixou de virar despesa e de inflar o mês.',
      'A prévia da importação reconhece o que já existe: o mesmo lançamento, a parcela e a previsão de um recorrente.',
      'Lançamento que cai na fatura do mês seguinte agora avisa em qual caiu, com atalho para ver aquele mês.',
    ],
  },
  {
    versao: '0.2.0',
    titulo: 'Financeiro completo, caderno unificado e atualização automática',
    itens: [
      'O programa passou a se atualizar sozinho, com aviso no canto e nada baixado sem você mandar.',
      'Recorrentes, orçamento, quitação de fatura e exportação em CSV.',
      'O Caderno virou um módulo só, com links entre anotações.',
      'Oito temas, refeições salvas e certificado no cartão do curso.',
    ],
  },
]

/**
 * Compara duas versões no formato `x.y.z`.
 *
 * Devolve negativo quando `a` é anterior a `b`. Comparar como texto diria que
 * "0.10.0" vem antes de "0.9.0", e a lista de novidades sairia errada na
 * décima versão.
 */
export function comparar(a: string, b: string): number {
  const partes = (versao: string) => versao.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const [x, y] = [partes(a), partes(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const diferenca = (x[i] ?? 0) - (y[i] ?? 0)
    if (diferenca !== 0) return diferenca
  }
  return 0
}

/**
 * O que a pessoa ainda não viu.
 *
 * `vista` é a última versão que ela abriu. Vindo de uma instalação que pulou
 * duas versões, as duas aparecem, porque para ela tudo isso é novo.
 */
export function novidadesDesde(vista: string, atual: string): Novidade[] {
  return NOVIDADES.filter(
    (novidade) => comparar(novidade.versao, vista) > 0 && comparar(novidade.versao, atual) <= 0,
  )
}

// ---------------------------------------------------------------------------
// Onde fica a marca do que já foi lido
// ---------------------------------------------------------------------------

const CHAVE = 'life:versao-vista'

export function versaoVista(): string | null {
  try {
    return localStorage.getItem(CHAVE)
  } catch {
    return null
  }
}

export function marcarVersaoVista(versao: string): void {
  try {
    localStorage.setItem(CHAVE, versao)
  } catch {
    // Sem localStorage a novidade volta a aparecer na próxima abertura.
  }
}
