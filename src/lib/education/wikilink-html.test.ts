import { describe, expect, it } from 'vitest'
import { comWikilinks } from './wikilink-html'

const existe = (titulo: string) => titulo === 'Arquitetura'

describe('o [[link]] na anotação formatada', () => {
  it('vira âncora com o título no atributo', () => {
    const html = comWikilinks('<p>Ver [[Arquitetura]] aqui.</p>', { existe })
    expect(html).toContain('data-nota="Arquitetura"')
    expect(html).toContain('>Arquitetura</a>')
  })

  it('o que ainda não existe ganha a marca de vazio', () => {
    expect(comWikilinks('<p>[[Sem dono]]</p>', { existe })).toContain('nota-link-vazio')
  })

  /** O exemplo de código é o que alguém quis mostrar, não um link. */
  it('dentro de código continua texto', () => {
    const html = comWikilinks('<pre><code>[[Arquitetura]]</code></pre>', { existe })
    expect(html).not.toContain('<a')
    expect(html).toContain('[[Arquitetura]]')
  })

  it('não mexe num link que já existe', () => {
    const pronto = '<a href="#nota" data-nota="Arquitetura">[[Arquitetura]]</a>'
    expect(comWikilinks(pronto, { existe })).toBe(pronto)
  })

  it('escapa o que viria a ser etiqueta', () => {
    expect(comWikilinks('<p>[[a<b>c]]</p>', { existe })).not.toContain('<b>c')
  })
})
