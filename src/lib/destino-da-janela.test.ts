// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'
import { aplicarDestinoDaJanela, DESTINO } from './destino-da-janela'

const abrirEm = (endereco: string) => window.history.replaceState(null, '', endereco)

describe('destino da janela recém-aberta', () => {
  beforeEach(() => abrirEm('/'))

  it('troca o index pelo destino antes de o roteador ler', () => {
    abrirEm(`/index.html?${DESTINO}=${encodeURIComponent('/janela/nota/abc')}`)
    aplicarDestinoDaJanela()
    expect(window.location.pathname).toBe('/janela/nota/abc')
  })

  it('devolve a rota com os parâmetros dela', () => {
    abrirEm(`/index.html?${DESTINO}=${encodeURIComponent('/financeiro?janela=1')}`)
    aplicarDestinoDaJanela()
    expect(window.location.pathname + window.location.search).toBe('/financeiro?janela=1')
  })

  it('sem destino, não mexe no endereço', () => {
    abrirEm('/caderno')
    aplicarDestinoDaJanela()
    expect(window.location.pathname).toBe('/caderno')
  })

  /** Endereço de fora não manda a janela para lugar nenhum. */
  it('ignora destino que não seja um caminho interno', () => {
    abrirEm(`/index.html?${DESTINO}=${encodeURIComponent('https://exemplo.com')}`)
    aplicarDestinoDaJanela()
    expect(window.location.pathname).toBe('/index.html')
  })
})
