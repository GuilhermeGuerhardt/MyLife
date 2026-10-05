import { describe, expect, it } from 'vitest'
import type { FolderBackend } from './folder-backend'
import { FolderStore } from './folder-store'

/** Uma pasta de mentira: o nome do arquivo e o conteúdo dele. */
function pasta(arquivos: Record<string, string>): FolderBackend {
  return {
    name: 'teste',
    key: 'teste',
    read: async (nome) => arquivos[nome] ?? null,
    write: async (nome, conteudo) => {
      arquivos[nome] = conteudo
    },
    list: async () => Object.keys(arquivos),
  }
}

const TABELAS = ['transactions', 'accounts']

describe('conferir a pasta escolhida', () => {
  it('a pasta de um projeto é recusada antes de qualquer escrita', async () => {
    const arquivos = { 'package.json': '{}', 'README.md': '# projeto' }
    const resultado = await new FolderStore(pasta(arquivos)).verify(TABELAS)
    expect(resultado.ok).toBe(false)
    expect(Object.keys(arquivos)).toEqual(['package.json', 'README.md'])
  })

  it('pasta vazia é nova; pasta com manifesto do Life é usada', async () => {
    expect(await new FolderStore(pasta({})).verify(TABELAS)).toEqual({ ok: true, existing: false })
    const usada = { 'life.json': JSON.stringify({ app: 'life', version: 1 }), 'notas.txt': 'x' }
    expect(await new FolderStore(pasta(usada)).verify(TABELAS)).toEqual({ ok: true, existing: true })
  })
})
