// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { ehJanelaSecundaria } from './janela-solta'

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => false }))
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ label: 'main' }) }))

const comOpener = (valor: Window | null) =>
  Object.defineProperty(window, 'opener', { value: valor, configurable: true, writable: true })

afterEach(() => comOpener(null))

describe('janela secundária, no navegador', () => {
  it('a janela que ninguém abriu é a principal', () => {
    comOpener(null)
    expect(ehJanelaSecundaria()).toBe(false)
  })

  /**
   * `opener` sobrevive à navegação dentro da janela filha — foi o que fez esta
   * checagem substituir a marca no endereço, que se perdia no primeiro clique
   * do menu.
   */
  it('a janela aberta por outra se reconhece como secundária', () => {
    comOpener(window)
    expect(ehJanelaSecundaria()).toBe(true)
  })
})
