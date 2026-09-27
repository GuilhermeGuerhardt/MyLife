import { describe, expect, it } from 'vitest'
import { atalho } from './atalho'

describe('rótulo de atalho', () => {
  it('escreve as teclas separadas por mais', () => {
    expect(atalho('mod+b')).toBe('Ctrl+B')
    expect(atalho('mod+shift+s')).toBe('Ctrl+Shift+S')
    expect(atalho('mod+alt+1')).toBe('Ctrl+Alt+1')
  })

  it('a tecla com nome fica por extenso', () => {
    expect(atalho('shift+enter')).toBe('Shift+enter')
  })
})
