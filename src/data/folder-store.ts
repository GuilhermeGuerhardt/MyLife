/**
 * Pasta de trabalho no disco, via File System Access API.
 *
 * O navegador guarda uma referência à pasta que você escolheu (um handle) e o
 * app passa a ler e gravar ali. Apontando para dentro do Google Drive ou do
 * OneDrive, a sincronização entre computadores é do próprio serviço.
 *
 * **Onde isso funciona.** A API existe no Chrome e no Edge, no desktop.
 * Firefox e Safari não a implementam, e no celular ela não existe — nem no
 * Chrome do Android. Por isso o modo pasta é uma opção, nunca o padrão: o app
 * precisa continuar inteiro em quem não pode usá-la.
 *
 * **Permissão.** O handle sobrevive ao fechar o navegador, mas a permissão de
 * escrita não: a cada nova sessão o Chrome exige um clique para reconceder.
 * Por isso a reconexão é oferecida como um botão, e não tentada sozinha ao
 * abrir — pedir permissão sem gesto do usuário é recusado pelo navegador.
 */

import {
  MANIFEST_FILE,
  buildManifest,
  checkManifest,
  deviceName,
  parseTableFile,
  serializeTable,
  tableFilename,
} from '@/lib/workspace/files'

// A tipagem do DOM ainda não cobre o seletor de pastas nem as permissões.
interface PermissionRequest {
  mode?: 'read' | 'readwrite'
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      id?: string
      mode?: 'read' | 'readwrite'
      startIn?: string
    }) => Promise<FileSystemDirectoryHandle>
  }

  interface FileSystemHandle {
    queryPermission?: (descriptor?: PermissionRequest) => Promise<PermissionState>
    requestPermission?: (descriptor?: PermissionRequest) => Promise<PermissionState>
  }
}

export function isFolderSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

// ---------------------------------------------------------------------------
// Persistência do handle (IndexedDB — localStorage não guarda objetos assim)
// ---------------------------------------------------------------------------

const DB_NAME = 'life-workspace'
const STORE = 'handles'
const HANDLE_KEY = 'directory'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbSet(value: FileSystemDirectoryHandle | null): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    if (value) tx.objectStore(STORE).put(value, HANDLE_KEY)
    else tx.objectStore(STORE).delete(HANDLE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function idbGet(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb()
  const value = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).get(HANDLE_KEY)
    request.onsuccess = () => resolve((request.result as FileSystemDirectoryHandle) ?? null)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return value
}

// ---------------------------------------------------------------------------
// Leitura e escrita
// ---------------------------------------------------------------------------

export class FolderStore {
  /** Escritas em fila por tabela: duas gravações simultâneas no mesmo arquivo
   *  perderiam uma das duas, porque cada uma reescreve o arquivo inteiro. */
  private queues = new Map<string, Promise<unknown>>()

  constructor(readonly handle: FileSystemDirectoryHandle) {}

  get name(): string {
    return this.handle.name
  }

  private serialize<T>(table: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(table) ?? Promise.resolve()
    const next = previous.then(task, task)
    this.queues.set(
      table,
      next.catch(() => undefined),
    )
    return next
  }

  async readTable(table: string): Promise<unknown[]> {
    try {
      const file = await this.handle.getFileHandle(tableFilename(table))
      return parseTableFile(await (await file.getFile()).text(), table)
    } catch (error) {
      // Arquivo que ainda não existe é tabela ainda não usada, não erro.
      if (error instanceof DOMException && error.name === 'NotFoundError') return []
      throw error
    }
  }

  async writeTable(table: string, rows: unknown[]): Promise<void> {
    await this.serialize(table, () => this.write(table, rows))
  }

  /**
   * Lê, altera e grava como uma operação só.
   *
   * Ler e gravar em chamadas separadas abriria espaço para dois registros
   * rápidos lerem o mesmo arquivo e o segundo gravar por cima do primeiro —
   * cada escrita reescreve o arquivo inteiro. A fila por tabela fecha isso.
   */
  async mutate<T>(
    table: string,
    change: (rows: unknown[]) => { rows: unknown[]; result: T },
  ): Promise<T> {
    return this.serialize(table, async () => {
      const { rows, result } = change(await this.readTable(table))
      await this.write(table, rows)
      return result
    })
  }

  private async write(table: string, rows: unknown[]): Promise<void> {
    const file = await this.handle.getFileHandle(tableFilename(table), { create: true })
    const writable = await file.createWritable()
    await writable.write(serializeTable(rows))
    await writable.close()
  }

  /** Grava o manifesto, marcando a pasta como pasta do Life. */
  async writeManifest(): Promise<void> {
    const manifest = buildManifest(deviceName(navigator.userAgent), new Date().toISOString())
    const file = await this.handle.getFileHandle(MANIFEST_FILE, { create: true })
    const writable = await file.createWritable()
    await writable.write(`${JSON.stringify(manifest, null, 2)}\n`)
    await writable.close()
  }

  /**
   * Confere o manifesto antes de qualquer escrita. Pasta vazia é aceita — é
   * quem está começando; pasta de outro app é recusada.
   */
  async verify(): Promise<{ ok: true; existing: boolean } | { ok: false; error: string }> {
    try {
      const file = await this.handle.getFileHandle(MANIFEST_FILE)
      const check = checkManifest(JSON.parse(await (await file.getFile()).text()))
      return check.ok ? { ok: true, existing: true } : { ok: false, error: check.error }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return { ok: true, existing: false }
      }
      return { ok: false, error: 'Não foi possível ler o arquivo life.json da pasta.' }
    }
  }

  /** Quantas linhas há em cada tabela — usado para mostrar o que a pasta tem. */
  async summary(tables: readonly string[]): Promise<Array<{ table: string; count: number }>> {
    const entries = await Promise.all(
      tables.map(async (table) => ({ table, count: (await this.readTable(table)).length })),
    )
    return entries.filter((entry) => entry.count > 0).sort((a, b) => b.count - a.count)
  }
}

async function hasWritePermission(
  handle: FileSystemDirectoryHandle,
  request: boolean,
): Promise<boolean> {
  const options: PermissionRequest = { mode: 'readwrite' }

  // Navegador que expõe o seletor mas não os métodos de permissão já entrega
  // o handle autorizado; não há o que conferir.
  if (!handle.queryPermission) return true
  if ((await handle.queryPermission(options)) === 'granted') return true

  if (!request || !handle.requestPermission) return false
  return (await handle.requestPermission(options)) === 'granted'
}

/** Abre o seletor de pastas. Precisa ser chamado a partir de um clique. */
export async function pickFolder(): Promise<FolderStore | null> {
  if (!isFolderSupported()) return null
  const handle = await window.showDirectoryPicker!({ id: 'life-workspace', mode: 'readwrite' })
  if (!(await hasWritePermission(handle, true))) return null

  await idbSet(handle)
  return new FolderStore(handle)
}

/**
 * Recupera a pasta da sessão anterior.
 *
 * Com `request: false` só devolve algo se a permissão ainda estiver de pé —
 * serve para o boot do app, onde não há gesto do usuário. Com `true`, mostra o
 * pedido de permissão do navegador e precisa vir de um clique.
 */
export async function restoreFolder(request: boolean): Promise<FolderStore | null> {
  if (!isFolderSupported()) return null

  const handle = await idbGet().catch(() => null)
  if (!handle) return null

  if (!(await hasWritePermission(handle, request))) return null
  return new FolderStore(handle)
}

/** Existe uma pasta lembrada, mesmo que ainda sem permissão nesta sessão? */
export async function hasRememberedFolder(): Promise<boolean> {
  return (await idbGet().catch(() => null)) !== null
}

export async function forgetFolder(): Promise<void> {
  await idbSet(null)
}
