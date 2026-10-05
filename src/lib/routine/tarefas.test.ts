import { describe, expect, it } from 'vitest'
import {
  colunaDe,
  semAsOcultas,
  filtrar,
  mudaDeColuna,
  separarEmColunas,
  montarLista,
  ordenar,
  prazoEmPalavras,
  resumir,
  type ItemDeTarefa,
} from './tarefas'

const propria = (id: string, title: string, over: Partial<{ done: boolean; date: string | null }> = {}) => ({
  id,
  title,
  done: false,
  date: null,
  ...over,
})

const item = (over: Partial<ItemDeTarefa>): ItemDeTarefa => ({
  chave: 'x',
  titulo: 'x',
  feita: false,
  data: null,
  origem: { tipo: 'propria', id: 'x' },
  ...over,
})

describe('a lista juntando as duas origens', () => {
  it('traz a tarefa da tela e a da anotação na mesma lista', () => {
    const lista = montarLista(
      [propria('t1', 'Renovar o seguro')],
      [{ id: 'n1', title: 'Aula 3', tarefas: [{ ordinal: 0, texto: 'ler o capítulo', feita: false }] }],
    )

    expect(lista.map((i) => i.titulo)).toEqual(['ler o capítulo', 'Renovar o seguro'])
    expect(lista.find((i) => i.titulo === 'ler o capítulo')!.origem).toEqual({
      tipo: 'nota',
      id: 'n1',
      titulo: 'Aula 3',
      ordinal: 0,
    })
  })

  it('a chave distingue duas tarefas da mesma anotação', () => {
    const lista = montarLista(
      [],
      [
        {
          id: 'n1',
          title: 'Aula',
          tarefas: [
            { ordinal: 0, texto: 'a', feita: false },
            { ordinal: 1, texto: 'b', feita: false },
          ],
        },
      ],
    )
    expect(new Set(lista.map((i) => i.chave)).size).toBe(2)
  })

  /** Caixa vazia é linha que alguém começou e não escreveu. */
  it('caixa sem texto não entra', () => {
    const lista = montarLista([], [{ id: 'n1', title: 'Aula', tarefas: [{ ordinal: 0, texto: '  ', feita: false }] }])
    expect(lista).toEqual([])
  })
})

describe('ordem', () => {
  it('pendente antes de feita', () => {
    const ordenada = ordenar([
      item({ chave: 'a', titulo: 'a', feita: true }),
      item({ chave: 'b', titulo: 'b', feita: false }),
    ])
    expect(ordenada.map((i) => i.chave)).toEqual(['b', 'a'])
  })

  it('com prazo antes de sem prazo, e a mais próxima primeiro', () => {
    const ordenada = ordenar([
      item({ chave: 'sem', titulo: 'sem' }),
      item({ chave: 'depois', titulo: 'depois', data: '2026-10-10' }),
      item({ chave: 'antes', titulo: 'antes', data: '2026-10-01' }),
    ])
    expect(ordenada.map((i) => i.chave)).toEqual(['antes', 'depois', 'sem'])
  })

  it('sem prazo, em ordem alfabética', () => {
    const ordenada = ordenar([item({ chave: 'z', titulo: 'Zebra' }), item({ chave: 'a', titulo: 'Água' })])
    expect(ordenada.map((i) => i.chave)).toEqual(['a', 'z'])
  })
})

describe('filtro e resumo', () => {
  const lista = [
    item({ chave: '1', feita: false, data: '2026-09-20' }),
    item({ chave: '2', feita: false }),
    item({ chave: '3', feita: true }),
    item({ chave: '4', feita: false, origem: { tipo: 'nota', id: 'n', titulo: 'Aula', ordinal: 0 } }),
  ]

  it('mostra só o que foi pedido', () => {
    expect(filtrar(lista, 'pendentes')).toHaveLength(3)
    expect(filtrar(lista, 'feitas')).toHaveLength(1)
    expect(filtrar(lista, 'todas')).toHaveLength(4)
  })

  it('conta o que a tela mostra no topo', () => {
    expect(resumir(lista, '2026-09-26')).toEqual({
      pendentes: 3,
      feitas: 1,
      atrasadas: 1,
      doCaderno: 1,
    })
  })

  it('feita e vencida não conta como atrasada', () => {
    const vencidaFeita = [item({ chave: '1', feita: true, data: '2026-01-01' })]
    expect(resumir(vencidaFeita, '2026-09-26').atrasadas).toBe(0)
  })
})

describe('o prazo em palavras', () => {
  const hoje = '2026-09-26'

  it('diz o que importa, que é quanto falta', () => {
    expect(prazoEmPalavras('2026-09-25', hoje)).toBe('atrasada')
    expect(prazoEmPalavras('2026-09-26', hoje)).toBe('hoje')
    expect(prazoEmPalavras('2026-09-27', hoje)).toBe('amanhã')
    expect(prazoEmPalavras('2026-09-30', hoje)).toBe('em 4 dias')
  })

  it('longe demais vira data mesmo', () => {
    expect(prazoEmPalavras('2026-12-24', hoje)).toBe('24/12')
  })
})


describe('quadro', () => {
  const lista = montarLista(
    [
      { id: 'a', title: 'Renovar seguro', done: false, date: null },
      { id: 'b', title: 'Pagar boleto', done: true, date: null },
    ],
    [
      {
        id: 'n1',
        title: 'Aula 3',
        tarefas: [{ ordinal: 0, texto: 'Refazer a lista', feita: false }],
      },
    ],
  )

  it('separa pelo estado, sem perder ninguém', () => {
    const quadro = separarEmColunas(lista)
    expect(quadro.pendentes.map((i) => i.titulo).sort()).toEqual(['Refazer a lista', 'Renovar seguro'])
    expect(quadro.feitas.map((i) => i.titulo)).toEqual(['Pagar boleto'])
    expect(quadro.pendentes.length + quadro.feitas.length).toBe(lista.length)
  })

  it('mantém a ordem que a lista já tinha', () => {
    const quadro = separarEmColunas(lista)
    const posicao = (titulo: string) => lista.findIndex((i) => i.titulo === titulo)
    expect(posicao(quadro.pendentes[0]!.titulo)).toBeLessThan(posicao(quadro.pendentes[1]!.titulo))
  })

  it('diz em que coluna cada cartão está', () => {
    expect(colunaDe(lista.find((i) => i.titulo === 'Renovar seguro')!)).toBe('pendentes')
    expect(colunaDe(lista.find((i) => i.titulo === 'Pagar boleto')!)).toBe('feitas')
  })

  it('soltar na mesma coluna não muda nada', () => {
    const pendente = lista.find((i) => !i.feita)!
    expect(mudaDeColuna(pendente, 'pendentes')).toBe(false)
    expect(mudaDeColuna(pendente, 'feitas')).toBe(true)
  })

  it('vale para o cartão que veio do caderno também', () => {
    const daNota = lista.find((i) => i.origem.tipo === 'nota')!
    expect(colunaDe(daNota)).toBe('pendentes')
    expect(mudaDeColuna(daNota, 'feitas')).toBe(true)
  })
})

describe('tarefas tiradas do quadro', () => {
  const lista = montarLista(
    [{ id: 'a', title: 'Renovar seguro', done: false, date: null }],
    [
      {
        id: 'n1',
        title: 'Aula 3',
        tarefas: [
          { ordinal: 0, texto: 'Exemplo da apostila', feita: false },
          { ordinal: 1, texto: 'Refazer a lista', feita: false },
        ],
      },
      {
        id: 'n2',
        title: 'Aula 4',
        tarefas: [{ ordinal: 0, texto: 'Exemplo da apostila', feita: false }],
      },
    ],
  )

  const ocultas = [{ nota: 'n1', texto: 'Exemplo da apostila' }]

  it('tira do quadro só a tarefa apontada', () => {
    expect(semAsOcultas(lista, ocultas).map((i) => i.titulo).sort()).toEqual([
      'Exemplo da apostila',
      'Refazer a lista',
      'Renovar seguro',
    ])
  })

  it('não confunde texto igual em outra anotação', () => {
    const restantes = semAsOcultas(lista, ocultas)
    const sobrou = restantes.find((i) => i.titulo === 'Exemplo da apostila')
    expect(sobrou?.origem.tipo === 'nota' && sobrou.origem.id).toBe('n2')
  })

  it('nunca esconde tarefa escrita na própria tela', () => {
    const tentativa = [{ nota: 'a', texto: 'Renovar seguro' }]
    expect(semAsOcultas(lista, tentativa)).toHaveLength(lista.length)
  })

  it('sobrevive a uma caixinha nova escrita acima', () => {
    const depois = montarLista(
      [],
      [
        {
          id: 'n1',
          title: 'Aula 3',
          tarefas: [
            { ordinal: 0, texto: 'Caixinha nova', feita: false },
            { ordinal: 1, texto: 'Exemplo da apostila', feita: false },
            { ordinal: 2, texto: 'Refazer a lista', feita: false },
          ],
        },
      ],
    )
    expect(semAsOcultas(depois, ocultas).map((i) => i.titulo).sort()).toEqual([
      'Caixinha nova',
      'Refazer a lista',
    ])
  })
})
