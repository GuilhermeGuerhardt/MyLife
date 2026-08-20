/**
 * Os dois jeitos de alcançar a pasta de trabalho.
 *
 * O `FolderStore` cuida da parte difícil — fila de escrita por tabela, leitura
 * e gravação como operação única, manifesto — e nada disso muda entre navegador
 * e programa de desktop. O que muda é só ler e gravar um arquivo de texto, que
 * é exatamente o que esta interface isola.
 *
 * No navegador, a File System Access API: existe só no Chrome e no Edge, guarda
 * a pasta como um handle opaco e exige um clique para reconceder permissão a
 * cada sessão. No desktop, um caminho de texto e três comandos em Rust: sem
 * permissão para reconceder, sem limite de navegador, e a pasta pode estar em
 * qualquer volume.
 */

import { invoke, isTauri } from '@tauri-apps/api/core'

export interface FolderBackend {
  /** Nome curto, para mostrar na tela. */
  readonly name: string
  /** Identidade estável, do jeito que der para guardar e reabrir depois. */
  readonly key: string
  /** `null` quando o arquivo não existe — ausência não é erro. */
  read(filename: string): Promise<string | null>
  write(filename: string, content: string): Promise<void>
}

// ---------------------------------------------------------------------------
// Navegador
// ---------------------------------------------------------------------------

export class HandleBackend implements FolderBackend {
  constructor(readonly handle: FileSystemDirectoryHandle) {}

  get name(): string {
    return this.handle.name
  }

  get key(): string {
    return this.handle.name
  }

  async read(filename: string): Promise<string | null> {
    try {
      const file = await this.handle.getFileHandle(filename)
      return await (await file.getFile()).text()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') return null
      throw error
    }
  }

  async write(filename: string, content: string): Promise<void> {
    const file = await this.handle.getFileHandle(filename, { create: true })
    const writable = await file.createWritable()
    await writable.write(content)
    await writable.close()
  }
}

// ---------------------------------------------------------------------------
// Programa de desktop
// ---------------------------------------------------------------------------

export class PathBackend implements FolderBackend {
  constructor(readonly path: string) {}

  get name(): string {
    // O último trecho do caminho é o nome da pasta. A barra do Windows e a do
    // resto do mundo aparecem misturadas dependendo de quem montou o caminho.
    const partes = this.path.split(/[\\/]/).filter(Boolean)
    return partes[partes.length - 1] ?? this.path
  }

  get key(): string {
    return this.path
  }

  private caminhoDe(filename: string): string {
    const separador = this.path.includes('\\') ? '\\' : '/'
    return `${this.path.replace(/[\\/]+$/, '')}${separador}${filename}`
  }

  async read(filename: string): Promise<string | null> {
    return invoke<string | null>('ler_texto', { caminho: this.caminhoDe(filename) })
  }

  async write(filename: string, content: string): Promise<void> {
    await invoke('gravar_texto', { caminho: this.caminhoDe(filename), conteudo: content })
  }
}

export function pastaExiste(path: string): Promise<boolean> {
  return invoke<boolean>('pasta_existe', { caminho: path })
}

/** O desktop sempre suporta; o navegador só com a File System Access API. */
export function folderSupported(): boolean {
  if (isTauri()) return true
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}
