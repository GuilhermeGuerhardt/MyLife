import { describe, expect, it } from 'vitest'
import {
  afetadasPorRenomear,
  chaveTitulo,
  indicePorTitulo,
  linkEmAberto,
  linksDoTexto,
  renomearNosTextos,
  retrolinks,
  type NotaLigavel,
} from './links'

const nota = (id: string, title: string, content = ''): NotaLigavel => ({ id, title, content })

describe('títulos', () => {
  it('ignora acento, caixa e espaço sobrando', () => {
    expect(chaveTitulo('  Arquitetura   HEXAGONAL ')).toBe('arquitetura hexagonal')
    expect(chaveTitulo('Injeção de Dependência')).toBe(chaveTitulo('injecao de dependencia'))
  })
})

describe('links do texto', () => {
  it('extrai na ordem, sem repetir', () => {
    const texto = 'Ver [[Rust: traits]] e [[Padrões]]. De novo [[rust: TRAITS]].'
    expect(linksDoTexto(texto)).toEqual(['Rust: traits', 'Padrões'])
  })

  it('ignora o que está dentro de bloco de código', () => {
    const texto = 'Antes [[Vale]]\n\n```\nconst x = [[NaoVale]]\n```\n\nDepois [[Tambem]]'
    expect(linksDoTexto(texto)).toEqual(['Vale', 'Tambem'])
  })

  it('ignora código em linha', () => {
    expect(linksDoTexto('Use `[[isto]]` para linkar, como em [[Aquilo]]')).toEqual(['Aquilo'])
  })

  it('link vazio ou quebrado não conta', () => {
    expect(linksDoTexto('[[]] e [[\nquebrado]] e [[ ]]')).toEqual([])
  })
})

describe('índice por título', () => {
  it('resolve ignorando acento e caixa', () => {
    const indice = indicePorTitulo([nota('n1', 'Injeção de Dependência')])
    expect(indice.get(chaveTitulo('injecao de dependencia'))?.id).toBe('n1')
  })

  it('título repetido: a primeira vence', () => {
    const indice = indicePorTitulo([nota('n1', 'Grafos'), nota('n2', 'grafos')])
    expect(indice.get('grafos')?.id).toBe('n1')
  })
})

describe('retrolinks', () => {
  const alvo = nota('alvo', 'Arquitetura hexagonal')
  const outras = [
    nota('n1', 'Camadas', 'O mesmo princípio de [[Arquitetura hexagonal]], mas na classe.'),
    nota('n2', 'Projeto', 'Segui [[arquitetura HEXAGONAL]] para isolar o parser.'),
    nota('n3', 'Nada a ver', 'Texto sem link nenhum.'),
  ]

  it('acha quem cita, ignorando acento e caixa', () => {
    expect(retrolinks(alvo, outras).map((r) => r.nota.id)).toEqual(['n1', 'n2'])
  })

  it('traz o trecho em volta, sem os colchetes', () => {
    const trecho = retrolinks(alvo, outras)[0]!.trecho
    expect(trecho).toContain('Arquitetura hexagonal')
    expect(trecho).not.toContain('[[')
  })

  it('não conta a própria anotação', () => {
    const propria = nota('alvo', 'Arquitetura hexagonal', 'Eu mesma cito [[Arquitetura hexagonal]].')
    expect(retrolinks(alvo, [propria])).toEqual([])
  })

  it('uma entrada por anotação, mesmo citando várias vezes', () => {
    const repetida = nota('n4', 'Repete', '[[Arquitetura hexagonal]] e de novo [[Arquitetura hexagonal]]')
    expect(retrolinks(alvo, [repetida])).toHaveLength(1)
  })

  it('citação dentro de código não conta', () => {
    const emCodigo = nota('n5', 'Exemplo', '```\n[[Arquitetura hexagonal]]\n```')
    expect(retrolinks(alvo, [emCodigo])).toEqual([])
  })
})

describe('renomear', () => {
  it('troca só o link que aponta para o título antigo', () => {
    const texto = 'Ver [[Grafos]] e [[Árvores]].'
    expect(renomearNosTextos(texto, 'Grafos', 'Teoria dos grafos')).toBe(
      'Ver [[Teoria dos grafos]] e [[Árvores]].',
    )
  })

  it('casa ignorando acento e caixa', () => {
    expect(renomearNosTextos('[[injecao]]', 'Injeção', 'DI')).toBe('[[DI]]')
  })

  it('lista só as anotações que realmente mudam', () => {
    const notas = [
      nota('n1', 'A', 'cita [[Grafos]]'),
      nota('n2', 'B', 'não cita nada'),
      nota('n3', 'C', 'cita [[grafos]] também'),
    ]
    const afetadas = afetadasPorRenomear(notas, 'Grafos', 'Teoria dos grafos')
    expect(afetadas.map((a) => a.nota.id)).toEqual(['n1', 'n3'])
    expect(afetadas[0]!.conteudo).toBe('cita [[Teoria dos grafos]]')
  })

  it('renomear para o mesmo título não mexe em nada', () => {
    const notas = [nota('n1', 'A', 'cita [[Grafos]]')]
    expect(afetadasPorRenomear(notas, 'Grafos', 'grafos')).toEqual([])
  })
})

describe('link em aberto (autocompletar)', () => {
  it('pega o que foi digitado depois do [[', () => {
    const texto = 'Ver [[arqu'
    expect(linkEmAberto(texto, texto.length)).toEqual({ termo: 'arqu', inicio: 4 })
  })

  it('logo após abrir, o termo é vazio', () => {
    expect(linkEmAberto('Ver [[', 6)).toEqual({ termo: '', inicio: 4 })
  })

  it('link já fechado não está em aberto', () => {
    const texto = 'Ver [[Grafos]] '
    expect(linkEmAberto(texto, texto.length)).toBeNull()
  })

  it('quebra de linha encerra', () => {
    const texto = 'Ver [[arqu\noutra linha'
    expect(linkEmAberto(texto, texto.length)).toBeNull()
  })

  it('sem [[ nenhum, nada', () => {
    expect(linkEmAberto('texto comum', 5)).toBeNull()
  })

  it('usa o [[ mais recente antes do cursor', () => {
    const texto = '[[Fechado]] e [[novo'
    expect(linkEmAberto(texto, texto.length)).toEqual({ termo: 'novo', inicio: 14 })
  })
})

describe('link não fechado', () => {
  it('um [[ esquecido não engole o parágrafo até o próximo ]]', () => {
    const texto = 'Ver [[arqu, muito texto aqui, e depois [[Grafos]] no fim.'
    expect(linksDoTexto(texto)).toEqual(['Grafos'])
  })

  it('o mesmo vale nos retrolinks', () => {
    const alvo = nota('alvo', 'Grafos')
    const citando = nota('n1', 'A', 'Ver [[esqueci de fechar e [[Grafos]] aqui')
    expect(retrolinks(alvo, [citando]).map((r) => r.nota.id)).toEqual(['n1'])
  })
})

describe('trecho do retrolink', () => {
  it('não deixa colchete solto quando o corte parte um link ao meio', () => {
    const alvo = nota('alvo', 'Grafos')
    const longa = nota(
      'n1',
      'Longa',
      `Cita [[Grafos]] aqui e depois ${'x'.repeat(40)} [[Um titulo bem longo que sera cortado]]`,
    )
    const trecho = retrolinks(alvo, [longa])[0]!.trecho
    expect(trecho).not.toContain('[[')
    expect(trecho).not.toContain(']]')
  })
})
