/**
 * O que cada módulo explica na primeira visita.
 *
 * Não é a lista de tudo que a tela faz — botão com nome claro se explica
 * sozinho. É o punhado de coisas que ninguém descobre por conta: que o peso usa
 * média de sete dias, que `[[` liga uma anotação na outra, que a importação
 * continua rodando se você sair da tela. Três ou quatro por módulo; a quinta
 * ninguém lê.
 *
 * Texto, e não um passo a passo apontando para botões: a tela muda a cada versão
 * e um guia que aponta para um botão que se mexeu é pior do que nenhum.
 */

export interface PassoDoTutorial {
  titulo: string
  texto: string
  /**
   * Seletor do que o holofote ilumina. Sem ele, o passo aparece centrado.
   *
   * Aponta para `data-tour`, nunca para classe: classe é decoração e muda
   * quando alguém mexe no estilo, levando o guia junto sem ninguém perceber.
   */
  alvo?: string
}

export interface Tutorial {
  /** Rota do módulo, como em `NAV`. */
  rota: string
  titulo: string
  resumo: string
  passos: PassoDoTutorial[]
}

export const TUTORIAIS: Tutorial[] = [
  {
    rota: '/',
    titulo: 'Este é o seu painel',
    resumo: 'A abertura junta o resumo de cada módulo em cartões.',
    passos: [
      {
        titulo: 'Escolha os cartões',
        texto: 'Em “Personalizar” você liga, desliga e reordena o que aparece aqui.',
        alvo: '[data-tour="acao"]',
      },
      {
        titulo: 'Registre de qualquer tela',
        texto: 'Ctrl K abre o registro rápido: peso, treino, gasto ou hábito sem sair do lugar.',
        alvo: '[data-tour="registro-rapido"]',
      },
      {
        titulo: 'Só o que você usa',
        texto:
          'Em Perfil › Módulos você desliga módulos inteiros, e os cartões deles saem daqui também.',
        alvo: '[data-tour="menu"]',
      },
    ],
  },
  {
    rota: '/saude',
    titulo: 'Saúde',
    resumo: 'Peso, treino e comida no mesmo lugar, para um alimentar o outro.',
    passos: [
      {
        titulo: 'O peso é média de 7 dias',
        texto:
          'Registre todo dia sem medo: o gráfico segue a média, então retenção de água não vira tendência.',
        alvo: '[data-tour="acao"]',
      },
      {
        titulo: 'Atividade em minutos',
        texto:
          'Escolha o exercício e o tempo; o gasto sai da intensidade dele e do seu peso atual, não de um número fixo.',
      },
      {
        titulo: 'O plano calcula o alvo',
        texto: 'Diga a meta e o prazo, e o app diz quantas calorias por dia e em quanto tempo dá.',
      },
      {
        titulo: 'Refeição que repete',
        texto: 'Salve o prato de sempre em Alimentação e ele volta com um clique no dia seguinte.',
      },
    ],
  },
  {
    rota: '/faculdade',
    titulo: 'Faculdade',
    resumo: 'O semestre: disciplinas, notas, faltas e o que vence.',
    passos: [
      {
        titulo: 'Comece pelas disciplinas',
        texto: 'Cadastre o curso e as matérias do semestre; o resto pendura nelas.',
        alvo: '[data-tour="acao"]',
      },
      {
        titulo: 'Nota e falta viram conta',
        texto:
          'Lançando as avaliações, o app mostra de quanto você precisa na próxima e quantas faltas ainda cabem.',
      },
      {
        titulo: 'Prazo não fica escondido',
        texto: 'Prova e entrega com data aparecem na Agenda e no painel de abertura.',
      },
      {
        titulo: 'A anotação é no Caderno',
        texto: 'O conteúdo de aula mora no Caderno, onde uma anotação se liga na outra.',
      },
    ],
  },
  {
    rota: '/cursos',
    titulo: 'Cursos',
    resumo: 'O que você estuda por fora: curso online, livro, trilha.',
    passos: [
      {
        titulo: 'Aula por aula',
        texto: 'Marque a aula assistida e o progresso do curso anda junto.',
        alvo: '[data-tour="acao"]',
      },
      {
        titulo: 'De onde continuar',
        texto: 'O cartão “Próxima aula” no painel diz onde você parou. Ligue ele em Personalizar.',
      },
      {
        titulo: 'Cronômetro de estudo',
        texto:
          'O botão Estudar liga um cronômetro que fica no topo de todas as telas, com Pomodoro se quiser. Vale também nas disciplinas da Faculdade.',
      },
    ],
  },
  {
    rota: '/caderno',
    titulo: 'Caderno',
    resumo: 'Um caderno só, para a aula, o curso e o que você estuda por conta.',
    passos: [
      {
        titulo: 'Ligue uma anotação na outra',
        texto:
          'Digite [[ e escolha o título: nasce um link, e a anotação citada passa a listar quem cita ela.',
        alvo: '[data-tour="acao"]',
      },
      {
        titulo: 'Atalhos de sempre',
        texto:
          'Ctrl B, Ctrl I e Ctrl K para link. Ctrl Alt T faz um bloco que abre e fecha, e Ctrl Alt D um destaque.',
      },
      {
        titulo: 'Tela cheia de texto',
        texto:
          'O botão de janela abre a anotação numa janela à parte, que você arrasta para o outro monitor.',
      },
      {
        titulo: 'Tarefa no meio da aula',
        texto:
          'A caixinha que você escrever aqui aparece em Rotina › A fazer, e marcar lá marca aqui.',
      },
    ],
  },
  {
    rota: '/financeiro',
    titulo: 'Financeiro',
    resumo: 'Onde o dinheiro entra, sai e some sem você ver.',
    passos: [
      {
        titulo: 'A compra fica no mês dela',
        texto:
          'A compra no cartão aparece no mês em que você comprou. A fatura é a soma delas e aparece à parte, no mês em que vence.',
        alvo: '[data-tour="acao"]',
      },
      {
        titulo: 'Importar não trava a tela',
        texto:
          'Solte o extrato do banco em Importar: ele roda no canto da tela e você continua usando o app.',
      },
      {
        titulo: 'O que se repete, se repete sozinho',
        texto:
          'Cadastre em Recorrentes e a previsão do mês já vem montada. Lá também ficam os parcelamentos e o que já se repete no seu histórico.',
      },
      {
        titulo: 'Orçamento avisa antes',
        texto: 'Defina o limite por categoria e o app mostra o que está estourando no mês.',
      },
    ],
  },
  {
    rota: '/rotina',
    titulo: 'Rotina',
    resumo: 'O que se repete toda semana e o que precisa ser feito uma vez.',
    passos: [
      {
        titulo: 'Hábito é sequência',
        texto: 'Marque o dia e o que interessa aparece: quantos dias seguidos você manteve.',
        alvo: '[data-tour="acao"]',
      },
      {
        titulo: 'Uma lista de tarefas só',
        texto:
          'A fazer junta o que você escreve aqui com as caixinhas espalhadas pelas anotações do Caderno.',
      },
      {
        titulo: 'Agenda cruza os módulos',
        texto:
          'Prova, entrega, vencimento e prazo no mesmo calendário, com filtro por área.',
      },
      {
        titulo: 'O mês numa tela',
        texto:
          'Revisão do mês põe gasto, treino, estudo e hábitos lado a lado, comparados com o mês anterior.',
      },
    ],
  },
  {
    rota: '/perfil',
    titulo: 'Perfil',
    resumo: 'Seus dados, a cara do app e o que fazer com o arquivo.',
    passos: [
      {
        titulo: 'Deixe só o que você usa',
        texto: 'Em Módulos, desligue os que não interessam. Nada é apagado: religar devolve tudo.',
      },
      {
        titulo: 'Tema por aparelho',
        texto: 'A paleta vale para este computador, então dá para ter claro aqui e escuro no outro.',
      },
      {
        titulo: 'Backup é um arquivo',
        texto:
          'Exporte tudo num arquivo só e guarde onde quiser; importar devolve do mesmo jeito. No app instalado, o backup automático faz isso todo dia.',
      },
      {
        titulo: 'Avisos fora do app',
        texto:
          'Ligue os avisos e o app lembra da fatura, da prova e do hábito com um balão no canto, mesmo minimizado.',
      },
    ],
  },
]

/**
 * Qual tutorial vale para esta tela.
 *
 * Pelo módulo, não pela tela: as sete telas do Financeiro são o mesmo assunto, e
 * um cartão novo em cada uma seriam sete interrupções. A busca é pelo prefixo
 * mais longo — `/rotina/tarefas` é Rotina —, e a raiz casa só com ela mesma,
 * senão seria dona de todas.
 */
export function tutorialDaRota(pathname: string): Tutorial | null {
  const candidatos = TUTORIAIS.filter(
    (tutorial) =>
      pathname === tutorial.rota ||
      (tutorial.rota !== '/' && pathname.startsWith(`${tutorial.rota}/`)),
  )

  return candidatos.sort((a, b) => b.rota.length - a.rota.length)[0] ?? null
}
