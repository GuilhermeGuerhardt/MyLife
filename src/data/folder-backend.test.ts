import { describe, expect, it } from 'vitest'
import { PathBackend } from './folder-backend'

/**
 * O `PathBackend` monta caminhos de arquivo a partir da pasta escolhida. É
 * pouca lógica, mas é a que decide onde os dados da pessoa vão parar — e um
 * separador trocado grava `C:\\pasta/transactions.json`, que o Windows até
 * aceita e o Explorer mostra de um jeito que ninguém reconhece.
 */
describe('caminhos da pasta de trabalho', () => {
  it('usa a barra do próprio caminho', () => {
    const windows = new PathBackend('C:\\Users\\Guilherme\\Life')
    // @ts-expect-error método privado, exercitado de propósito
    expect(windows.caminhoDe('transactions.json')).toBe(
      'C:\\Users\\Guilherme\\Life\\transactions.json',
    )

    const unix = new PathBackend('/home/guilherme/Life')
    // @ts-expect-error método privado, exercitado de propósito
    expect(unix.caminhoDe('transactions.json')).toBe('/home/guilherme/Life/transactions.json')
  })

  it('não duplica a barra final', () => {
    const backend = new PathBackend('D:\\Life\\')
    // @ts-expect-error método privado, exercitado de propósito
    expect(backend.caminhoDe('life.json')).toBe('D:\\Life\\life.json')
  })

  it('mostra só o nome da pasta', () => {
    expect(new PathBackend('C:\\Users\\Guilherme\\OneDrive\\Life').name).toBe('Life')
    expect(new PathBackend('/home/g/dados/life').name).toBe('life')
    // Raiz de volume não tem trecho final: sobra o caminho inteiro.
    expect(new PathBackend('D:\\').name).toBe('D:')
  })

  it('a identidade é o caminho completo', () => {
    // Duas pastas chamadas "Life" em lugares diferentes não podem ser a mesma
    // coisa para quem lembra qual estava conectada.
    const a = new PathBackend('C:\\Um\\Life')
    const b = new PathBackend('C:\\Outro\\Life')
    expect(a.name).toBe(b.name)
    expect(a.key).not.toBe(b.key)
  })
})
